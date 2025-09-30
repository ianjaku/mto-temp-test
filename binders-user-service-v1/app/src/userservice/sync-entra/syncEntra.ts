import {
    Account,
    AccountServiceContract,
    IAccountSettings,
    ManageMemberTrigger
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    GraphClientConnectionParams,
    GroupMember,
    MicrosoftGraphApiClient
} from "@binders/binders-service-common/lib/graph/microsoftApiClient";
import {
    SyncEntraGroupMembersOptions,
    UserServiceContract
} from "@binders/client/lib/clients/userservice/v1/contract";
import {
    CredentialServiceContract
} from "@binders/client/lib/clients/credentialservice/v1/contract";
import { IUserTagRepository } from "../repositories/userTags";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { SAMLSSOConfig } from "@binders/binders-service-common/lib/authentication/saml-sso/config";
import { User } from "../models/user";
import { UserRepository } from "../repositories/users";


function getAccountDetails(account: Account, settings: IAccountSettings, logger: Logger) {

    function assertTruthy(settingProp: { name: string, value: string | undefined }) {
        if (!settingProp.value) {
            const errorMsg = `Missing required setting: ${settingProp.name}`;
            logger.error(errorMsg, "sync-entra-group-member");
            throw new Error(errorMsg);
        }
    }
    assertTruthy({ name: "settings.sso.saml.tenantId", value: settings.sso?.saml?.tenantId });
    assertTruthy({ name: "settings.sso.saml.enterpriseApplicationId", value: settings.sso?.saml?.enterpriseApplicationId });
    assertTruthy({ name: "settings.sso.saml.enterpriseApplicationGroupReadSecret", value: settings.sso?.saml?.enterpriseApplicationGroupReadSecret });
    assertTruthy({ name: "settings.sso.saml.userGroupIdForUserManagement", value: settings.sso?.saml?.userGroupIdForUserManagement });
    return {
        id: account.id,
        members: account.members,
        samlSettings: {
            tenantId: settings.sso.saml.tenantId,
            clientId: settings.sso.saml.enterpriseApplicationId,
            secret: settings.sso.saml.enterpriseApplicationGroupReadSecret,
        },
        userGroupIdForUserManagement: settings.sso.saml.userGroupIdForUserManagement,
    };
}

async function getEntraGroupMembers(
    groupId: string,
    samlSettings: GraphClientConnectionParams,
    options: SyncEntraGroupMembersOptions,
    logger: Logger,
): Promise<GroupMember[]> {
    const entraUsersGraphClient = MicrosoftGraphApiClient.from(
        samlSettings, logger, { debugLogging: !!options.debug, defaultVersion: "beta" }
    );
    return entraUsersGraphClient.getGroupMembers(groupId);
}

async function getAccountUsers(userIds: string[], userRepository: UserRepository): Promise<Map<string, User>> {
    const resolvedExistingUsers = await userRepository.getUsers(userIds, false);
    return resolvedExistingUsers.reduce(
        (collector, user) => collector.set(user.login.value().toLowerCase(), user),
        new Map<string, User>()
    );
}

async function addAccountMembers(
    accountId: string,
    usersByLogin: Map<string, GroupMember>,
    samlSettings: GraphClientConnectionParams,
    samlSSOConfig: SAMLSSOConfig,
    logger: Logger,
    options: SyncEntraGroupMembersOptions,
): Promise<void> {
    logger.info(`${options.dryRun ? "Would" : "Will"} create in ${accountId} new accounts`, "sync-entra-group-member", { logins: [...usersByLogin.keys()] });
    const entraUsersGraphClient = MicrosoftGraphApiClient.from(samlSettings, logger, { debugLogging: !!options.debug });
    for (const [login, user] of usersByLogin) {
        const groupIds = await entraUsersGraphClient.getUserMemberOfGroupIds(user.id);
        logger.info(`${options.dryRun ? "Would" : "Will"} add ${login} to following groups`, "sync-entra-group-member", { groupIds });
        if (!options.dryRun) {
            const registeredUser = await samlSSOConfig.registerNewUser(login, login, user.displayName, samlSettings.tenantId, accountId);
            await samlSSOConfig.refreshGroupMemberships(accountId, registeredUser.id, groupIds, logger);
        }
    }
}

async function deleteAccountMembers(
    accountId: string,
    users: User[],
    deps: { userServiceClient: UserServiceContract, credentialServiceClient: CredentialServiceContract, accountServiceClient: AccountServiceContract },
    logger: Logger,
    options: SyncEntraGroupMembersOptions,
): Promise<void> {
    const nonAdminUsers: User[] = [];
    for (const user of users) {
        const userAccess = await deps.userServiceClient.listUserAccess(accountId, users[0].id.value());
        if (!userAccess.some(access => access.role === "Admin")) {
            nonAdminUsers.push(user);
        }
    }
    if (nonAdminUsers.length < users.length) {
        logger.info("Marked for deletion but skipped because they are admins in the account", "sync-entra-group-member", {
            logins: users.filter(u => !nonAdminUsers.includes(u)).map(u => u.login.value()),
        });
    }
    if (nonAdminUsers.length === 0) {
        logger.info("No users (left) to delete", "sync-entra-group-member");
        return;
    }
    logger.info(`${options.dryRun ? "Would" : "Will"} remove the following users from ${accountId}`, "sync-entra-group-member", { logins: [...nonAdminUsers.map(u => u.login.value())] });
    if (!options.dryRun) {
        await deps.credentialServiceClient.deleteADIdentityMappingForUsers(accountId, nonAdminUsers.map(u => u.id.value()));
        await deps.accountServiceClient.removeMembers(
            accountId,
            [...nonAdminUsers.map(u => u.id.value())],
            ManageMemberTrigger.SSO_SAML_SYNC_ENTRA_GROUP,
        );
    }
}

export async function syncEntraGroupMembers(
    account: Account,
    settings: IAccountSettings,
    logger: Logger,
    deps: {
        userRepository: UserRepository,
        userTagRepository: IUserTagRepository,
        samlSSOConfig: SAMLSSOConfig,
        userServiceClient: UserServiceContract,
        credentialServiceClient: CredentialServiceContract,
        accountServiceClient: AccountServiceContract,
    },
    options: SyncEntraGroupMembersOptions = { dryRun: false, debug: false },
): Promise<void> {
    const accountDetails = getAccountDetails(account, settings, logger);
    const entraGroupMembers = await getEntraGroupMembers(
        accountDetails.userGroupIdForUserManagement,
        accountDetails.samlSettings,
        options,
        logger,
    );
    if (options.debug) {
        logger.debug("Fetched the following entra group members", "sync-entra-group-member", { entraGroupMembers });
    }

    const accountUsersByLogin = await getAccountUsers(accountDetails.members, deps.userRepository);

    const usersOnlyInEntraGroup = new Map<string, GroupMember>();
    const userLoginsInBothEntraGroupAndManualTo = new Set<string>();
    entraGroupMembers.forEach(member => {
        if (accountUsersByLogin.has(member.login.toLowerCase())) {
            userLoginsInBothEntraGroupAndManualTo.add(member.login);
        } else {
            usersOnlyInEntraGroup.set(member.login, member);
        }
    });

    await addAccountMembers(account.id, usersOnlyInEntraGroup, accountDetails.samlSettings, deps.samlSSOConfig, logger, options);

    const usersOnlyInManualToWithAdTag = new Set<User>();
    const userLoginsOnlyInManualToWithoutAdTag = new Set<string>();
    const accountUsersWithCdsidFlagStatus = await deps.userTagRepository.getUsersTagStatus(accountDetails.members, "cdsid");
    for (const user of accountUsersByLogin.values()) {
        const userLogin = user.login.value();
        if (userLoginsInBothEntraGroupAndManualTo.has(userLogin)) {
            continue;
        }
        if (accountUsersWithCdsidFlagStatus.get(user.id.value())) {
            usersOnlyInManualToWithAdTag.add(user);
        } else {
            userLoginsOnlyInManualToWithoutAdTag.add(userLogin);
        }
    }
    logger.info(
        `Will keep ${userLoginsInBothEntraGroupAndManualTo.size + userLoginsOnlyInManualToWithoutAdTag.size}`,
        "sync-entra-group-member",
        { logins: [...userLoginsInBothEntraGroupAndManualTo, ...userLoginsOnlyInManualToWithoutAdTag] }
    );
    await deleteAccountMembers(account.id, Array.from(usersOnlyInManualToWithAdTag), deps, logger, options);
}