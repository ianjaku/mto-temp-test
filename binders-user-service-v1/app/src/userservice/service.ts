import * as clientContract from "@binders/client/lib/clients/userservice/v1/contract";
import {
    AccountServiceContract,
    FEATURE_CEVA,
    FEATURE_GROUP_OWNERS,
    ManageMemberTrigger
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    Acl,
    AclResourcePermission,
    AssigneeGroup,
    AssigneeType,
    AuthorizationServiceContract,
    PermissionName,
    ResourceType
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import {
    Application,
    UserGroupActionType
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import {
    AuthenticatedSession,
    EntityNotFound,
    Unauthorized
} from "@binders/client/lib/clients/model";
import {
    BackendAccountServiceClient,
    BackendCredentialServiceClient,
    BackendNotificationServiceClient,
    BackendRepoServiceClient,
    BackendRoutingServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import {
    Binder,
    BindersRepositoryServiceContract,
    DocumentCollection
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    CanBeManagedByResponse,
    CevaUser,
    GroupMap,
    IUserTag,
    MultiGetGroupMembersOptions,
    UserAccess,
    UserCreationMethod
} from "@binders/client/lib/clients/userservice/v1/contract";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import {
    DeviceTargetUserLinkRepository,
    MongoDeviceTargetUserLinkRepositoryFactory
} from "./repositories/deviceTargetUserLinks";
import { IUserTagRepository, MongoUserTagRepositoryFactory } from "./repositories/userTags";
import { InvalidArgument, InvalidOperation } from "@binders/client/lib/util/errors";
import { InvitationEmailFail, LoginNotAvailable, User, userModelToInterface } from "./models/user";
import { Logger, LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import {
    Login,
    UserIdentifier
} from "@binders/binders-service-common/lib/authentication/identity";
import { Mailer, MockedUserMailer, UserMailgunMailer } from "./mailer/mailer";
import {
    MongoPreferenceRepositoryFactory,
    UserPreferenceRepository
} from "./repositories/preferences";
import {
    MongoScriptRunStatRepositoryFactory,
    ScriptRunStatRepository
} from "./repositories/scriptrunstats";
import {
    MongoTermsAcceptanceRepositoryFactory,
    TermsAcceptanceRepository
} from "./repositories/termsAcceptance";
import {
    MongoUserImportActionRepositoryFactory,
    UserImportActionRepository,
    toModelUserImportResult
} from "./repositories/userimportactions";
import { MongoUserRepositoryFactory, UserRepository } from "./repositories/users";
import { MongoUsergroupRepositoryFactory, UsergroupRepository } from "./repositories/usergroups";
import {
    MongoWhitelistedEmailRepositoryFactory,
    WhitelistedEmailRepository
} from "./repositories/whitelistedemails";
import {
    ReaderBranding,
    RoutingServiceContract
} from "@binders/client/lib/clients/routingservice/v1/contract";
import {
    Usergroup,
    UsergroupDetails,
    UsergroupIdentifier,
    usergroupModelToClient
} from "./models/usergroup";
import {
    buildUserName,
    createDeviceUserEmail,
    isUsergroupId
} from "@binders/client/lib/clients/userservice/v1/helpers";
import {
    findAccountIdByUserIdAndDomain,
    isCustomDevDomain,
    isEditorLikeDomain
} from "@binders/binders-service-common/lib/util/domains";
import { getEditorLocation, getReaderLocation } from "@binders/client/lib/util/domains";
import { isDev, isProduction } from "@binders/client/lib/util/environment";
import { partition, pick } from "ramda";
import {
    BackendAuthorizationServiceClient
} from "@binders/binders-service-common/lib/authorization/backendclient";
import { Config } from "@binders/client/lib/config/config";
import {
    CredentialServiceContract
} from "@binders/client/lib/clients/credentialservice/v1/contract";
import { Client as HubspotClient } from "@hubspot/api-client";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import LaunchDarklyService from "@binders/binders-service-common/lib/launchdarkly/server";
import { NotAllowed } from "./errorhandler";
import {
    NotificationServiceClient
} from "@binders/client/lib/clients/notificationservice/v1/client";
import { SAMLSSOConfig } from "@binders/binders-service-common/lib/authentication/saml-sso/config";
import { ScriptRunStat } from "./models/scriptrunstats";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { UserImportAction } from "./models/userimportaction";
import { UserImportResult } from "./models/userimportresult";
import { UserNotFound } from "@binders/client/lib/clients/userservice/v1/errors";
import { WhitelistedEmail } from "./models/whitelistedemail";
import { buildTermsVersionsMap } from "./helpers/terms";
import { extractTitle } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import {
    getOrCreateLaunchDarklyService
} from "@binders/binders-service-common/lib/persistentcache/helpers/singletonDependencies";
import i18next from "@binders/client/lib/i18n";
import { importCevaUsers } from "./ceva/import";
import { isManualToLogin } from "@binders/client/lib/util/user";
import mongoose from "mongoose";
import { resolveDeviceUserIds } from "./helpers/deviceusers";
import { shouldServiceBeMocked } from "@binders/binders-service-common/lib/testutils/util";
import { syncEntraGroupMembers } from "./sync-entra/syncEntra";
import {
    validateSSOAccountSettingsForSyncEntraJob
} from "@binders/client/lib/clients/accountservice/v1/validation";
import {
    verifyActorIsAdminOnAllChangedUserAccounts
} from "@binders/binders-service-common/lib/middleware/authorization";

export type AuditLogCallback = (userGroupAction: UserGroupActionType, userGroupId: string, userId?: string) => void;

function toClientUser(user: User, userTags: IUserTag[] = [], userTokens: Record<string, string> = {}): clientContract.User {
    const id = user.id.value();
    return {
        id,
        login: user.login.value(),
        displayName: user.displayName,
        firstName: user.firstName,
        lastName: user.lastName,
        created: user.created,
        updated: user.updated,
        lastOnline: user.lastOnline,
        bounced: user.bounced,
        type: user.type,
        licenseCount: user.licenseCount,
        userTags,
        invitationToken: userTokens[id],
        isPasswordless: user.isPasswordless,
        creationMethod: user.creationMethod,
    };
}

function toModelUser(user: clientContract.User): User {
    const userId = UserIdentifier.from(user.id);
    const login = Login.from(user.login);
    return new User(
        userId,
        login,
        user.displayName,
        user.firstName,
        user.lastName,
        user.created,
        user.updated,
        user.lastOnline,
        user.bounced,
        user.type,
        user.licenseCount,
        user.isPasswordless,
        user.creationMethod,
    );
}

function toClientUserImportResult(userImportResult: UserImportResult): clientContract.UserImportResult {
    return {
        user: {
            id: userImportResult.userId,
            login: userImportResult.login,
            displayName: userImportResult.displayName,
            firstName: userImportResult.firstName,
            lastName: userImportResult.lastName,
            lastOnline: userImportResult.lastOnline,
        },
        exception: userImportResult.exception,
        invitationLink: userImportResult.invitationLink,
        invitationLinkSentDate: userImportResult.invitationLinkSentDate
    };
}

function toClientUserImportAction(userImportAction: UserImportAction): clientContract.UserImportAction {
    return {
        accountId: userImportAction.accountId,
        importDate: userImportAction.importDate,
        userImportResults: userImportAction.userImportResults.map(toClientUserImportResult)
    };
}

function usergroupDetailsModelToClient(usergroup: Usergroup, users: User[], userTagsByUserId: Record<string, IUserTag[]> = {}): clientContract.UsergroupDetails {
    return {
        group: usergroupModelToClient(usergroup),
        memberCount: users.length,
        members: users.map(u => toClientUser(
            u,
            userTagsByUserId[u.id.value()] ?? [])
        )
    };
}

const maybeAddProtocol = (link: string): string => {
    if (link.startsWith("http")) {
        return link;
    }
    const prefix = isDev() ? "http://" : "https://";
    return `${prefix}${link}`;
}

export class UserService implements clientContract.UserServiceContract {

    constructor(
        private userRepository: UserRepository,
        private userPreferenceRepository: UserPreferenceRepository,
        private usergroupRepository: UsergroupRepository,
        private userImportActionRepository: UserImportActionRepository,
        private whitelistedEmailRepository: WhitelistedEmailRepository,
        private scriptRunStatRepository: ScriptRunStatRepository,
        private termsAcceptanceRepository: TermsAcceptanceRepository,
        private userTagRepository: IUserTagRepository,
        private deviceTargetUserLinkRepository: DeviceTargetUserLinkRepository,
        private accountServiceContract: AccountServiceContract,
        private credentialServiceContract: CredentialServiceContract,
        private routingServiceContract: RoutingServiceContract,
        private authorizationServiceContract: AuthorizationServiceContract,
        private repositoryServiceContract: BindersRepositoryServiceContract,
        private notificationServiceClient: NotificationServiceClient,
        private mailer: Mailer,
        private manualtoLocation: string,
        private editorLocation: string,
        private logger: Logger,
        private config: Config,
        private readonly launchDarkly: LaunchDarklyService,
    ) { }

    private createInvitationLink(userId: string, domain: string): Promise<Array<string>> {
        return this.credentialServiceContract.createOneTimeToken(userId, 30)
            .then(token => {
                const readerLocation = getReaderLocation(domain, this.manualtoLocation);
                return [userId, `${readerLocation}/invite/${token}?domain=${domain}`];
            });
    }

    private async createResetPasswordLink(userId: string, domain: string, application: Application): Promise<string> {
        const token = await this.credentialServiceContract.createOneTimeToken(userId, 1);
        const isReader = application === Application.READER;
        const location = isReader ?
            getReaderLocation(domain, this.manualtoLocation) :
            getEditorLocation(domain, this.editorLocation);
        const withoutDomainSuffix = maybeAddProtocol(`${location}/reset/${token}`);
        if (isProduction()) {
            return withoutDomainSuffix;
        }
        return `${withoutDomainSuffix}?domain=${domain}`;
    }

    private getAccountName(accountId: string): Promise<string> {
        return this.accountServiceContract.getAccount(accountId)
            .then(account => account.name);
    }


    getBouncedEmails(lastDate?: Date): Promise<Array<clientContract.BouncedEmail>> {
        return this.mailer.getBounced(lastDate);
    }


    checkIfEmailBounced(address: string): Promise<clientContract.BouncedEmail> {
        return this.mailer.getBouncedInfo(address);
    }

    private sendInvitationMail(user: clientContract.User, accountId: string, domain: string, language?: string): Promise<clientContract.UserImportResult> {
        if (domain === undefined) {
            return Promise.reject(new Error("Invalid domain!"));
        }
        return Promise.all([
            this.createInvitationLink(user.id, domain),
            this.getAccountName(accountId),
            this.getPreferences(user.id),
            this.getBrandingForMail(domain),
        ])
            .then(([invitationLinkKeyValue, accountName, preferences, readerBranding]) => {
                const preferedReaderLanguage = preferences && preferences.readerLanguages && preferences.readerLanguages[0];
                const preferedLanguage = language || preferedReaderLanguage;
                return this.mailer.sendInvitationEmail(user.login, invitationLinkKeyValue[1], accountName, domain, readerBranding, accountId, preferedLanguage)
                    .then(() => {
                        return <clientContract.UserImportResult>{ user, invitationLink: invitationLinkKeyValue[1], invitationLinkSentDate: new Date() };
                    })
                    .catch(error => {
                        this.logger.error(error.message, "sendInvitationMails");
                        return <clientContract.UserImportResult>{ user, exception: error.message };
                    });
            });
    }

    private async sendResetPasswordMail(user: clientContract.User, userId: string, domain: string, application?: Application, language?: string): Promise<clientContract.UserImportResult> {
        const app = application === Application.EDITOR ? Application.EDITOR : Application.READER;
        const [passwordResetLink, readerBranding] = await Promise.all([
            this.createResetPasswordLink(userId, domain, app),
            this.getBrandingForMail(domain),
        ])
        try {
            await this.mailer.sendResetPasswordEmail(user.login, passwordResetLink, domain, language, readerBranding, buildUserName(user, { preferFirstName: true, noFallbackToId: true }));
        } catch (error) {
            this.logger.error(error.message, "sendResetPasswordMail");
            return <clientContract.UserImportResult>{
                user,
                exception: error.message || error.toString(),
            };
        }
        return <clientContract.UserImportResult>{ user, invitationLink: passwordResetLink, invitationLinkSentDate: new Date() };
    }

    private sendInvitationMails(users: clientContract.User[], accountId: string, domain: string, language?: string): Promise<clientContract.UserImportResult[]> {
        const invitationMailPromises: Promise<clientContract.UserImportResult>[] = [];
        for (const user of users) {
            invitationMailPromises.push(this.sendInvitationMail(user, accountId, domain, language));
        }
        return Promise.all(invitationMailPromises);
    }

    private createInvitationLinks(users: clientContract.User[], domain: string): Promise<string[][]> {
        const invitationLinksPromises: Promise<string[]>[] = [];
        for (const user of users.filter(u => !u.lastOnline)) { // don't create an invitation link for active users
            invitationLinksPromises.push(this.createInvitationLink(user.id, domain));
        }
        return Promise.all(invitationLinksPromises);
    }

    async inviteUser(login: string, accountId: string, domain: string, language?: string): Promise<clientContract.User> {
        try {
            await this.validateDomain(domain);
            const savedUser = await this.userRepository.getUserByLogin(login);
            const result = await this.sendInvitationMail(toClientUser(savedUser), accountId, domain, language);
            if (result.exception) {
                this.logger.error(`sendInvitationMail failed with ${JSON.stringify(result.exception)}`, "inviteUser");
                throw new InvitationEmailFail(result.exception);
            }
            return result.user;
        } catch (error) {
            this.logger.error(`inviteUser failed with ${JSON.stringify(error.message)}`, "inviteUser");
            this.logger.logException(error, "inviteUser")
            if (error.name === EntityNotFound.errorName) {
                const newUser = User.create({ login: new Login(login), displayName: login });
                const savedUser = await this.userRepository.saveUser(newUser);
                try {
                    // Create one time token
                    const result = await this.sendInvitationMail(toClientUser(savedUser), accountId, domain, language);
                    if (result.exception) {
                        throw new InvitationEmailFail(result.exception);
                    }
                    return result.user;
                } catch (err) {
                    this.logger.logException(err, "inviteUser")
                    this.logger.error(`retried sendInvitationMail failed with ${JSON.stringify(err.message)}`, "inviteUser");
                    return undefined;
                }
            }
            throw error;
        }
    }

    async sendPasswordResetLinkTo(logins: string[], accountId: string, domain: string, language?: string): Promise<Array<clientContract.UserImportResult>> {
        await this.validateDomain(domain);
        const getUserPromises: Promise<User>[] = [];
        for (const login of logins) {
            getUserPromises.push(this.userRepository.getUserByLogin(login));
        }
        const users = await Promise.all(getUserPromises)
        return this.sendInvitationMails(users.map(u => toClientUser(u)), accountId, domain, language);
    }

    async searchGroups(
        accountId: string,
        term: string,
        options: clientContract.SearchOptions
    ): Promise<clientContract.UsergroupSearchResult> {
        const groupSearchResult = await this.usergroupRepository.search({ accountId, nameRegex: term }, options);
        return {
            hitCount: groupSearchResult.hitCount,
            hits: groupSearchResult.hits.map(usergroupModelToClient)
        };
    }

    async searchUsersByTerm(
        accountId: string,
        term: string,
        options: clientContract.UsersSearchByQueryOptions,
    ): Promise<clientContract.UserSearchResult> {

        const account = await this.accountServiceContract.getAccount(accountId);
        const { needsEditorAccess } = options;
        const userSearchResult = await this.userRepository.search(account.members, term, options);

        let userHits;

        if (needsEditorAccess) {
            if (options.maxResults > 100) {
                throw new Error("maxResults must be <= 100 when using needsEditorAccess");
            }
            userHits = [];
            for (const user of userSearchResult.hits) {
                const hasEditorAccess = await this.authorizationServiceContract.hasAvailableEditorAccount(
                    [accountId],
                    user.id.value()
                );
                if (hasEditorAccess) {
                    userHits.push(user);
                }
            }
        } else {
            userHits = userSearchResult.hits;
        }

        return {
            hitCount: userHits.length,
            hits: userHits.map(u => toClientUser(u))
        };
    }

    async sendPasswordResetLink(logins: string[], accountId: string, language?: string): Promise<Array<clientContract.UserImportResult>> {
        const getUserPromises: Promise<User>[] = [];
        for (const login of logins) {
            getUserPromises.push(this.userRepository.getUserByLogin(login));
        }
        const users = await Promise.all(getUserPromises);
        const domainFilter = (await this.routingServiceContract.getDomainFiltersForAccounts([accountId])).pop();
        if (!domainFilter || !domainFilter.domain) {
            throw new Error("no domain filters set for account");
        }
        return this.sendInvitationMails(users.map(u => toClientUser(u)), accountId, domainFilter.domain, language);
    }

    async sendMePasswordResetLink(login: string, application: Application, domain?: string, language?: string): Promise<void> {
        try {
            await this.validateDomain(domain);
            const user = await this.userRepository.getUserByLogin(login);
            const userId = user.id.value();
            await findAccountIdByUserIdAndDomain(userId, domain, this.routingServiceContract, this.accountServiceContract);
            await this.sendResetPasswordMail(toClientUser(user), userId, domain, application, language);
        } catch (e) {
            if (e.name === EntityNotFound.name) {
                this.logger.error(`Trying to reset password for non-existing user: ${login}`, "password-reset");
            } else {
                this.logger.logException(e, "password-reset");
            }
        }
    }

    private async validateDomain(domain: string | undefined): Promise<void> {
        if (!domain) {
            throw new InvalidArgument("Missing domain");
        }
        if (isEditorLikeDomain(domain) || isCustomDevDomain(domain)) {
            return;
        }
        const domainFilter = await this.routingServiceContract.getDomainFilterByDomain(domain);
        if (!domainFilter) {
            throw new InvalidArgument(`Unknown domain ${domain}`);
        }
    }

    listUserImportActions(accountId: string): Promise<Array<clientContract.UserImportAction>> {
        return this.userImportActionRepository.listUserImportActions(accountId)
            .then(userImportActions => {
                const userIdsInImports = [];
                for (const action of userImportActions) {
                    userIdsInImports.push(...action.userImportResults.filter(r => r.userId).map(r => {
                        return UserIdentifier.build(r.userId).caseOf({
                            left: (error) => {
                                this.logger.error(error.message, "listUserImportActions");
                            },
                            right: (userIdObject) => userIdObject
                        });
                    }));
                }
                return this.userRepository.findUserDetailsForIds(userIdsInImports)
                    .then(userDetails => {
                        return userImportActions.map(action => {
                            return {
                                accountId,
                                importDate: action.importDate,
                                userImportResults: action.userImportResults.map(result => {
                                    const userDetail = userDetails.find(u => u.id.value && u.id.value() === result.userId);
                                    return {
                                        user: {
                                            id: result.userId,
                                            login: result.login,
                                            displayName: userDetail ?
                                                userDetail.displayName :
                                                (result.displayName || ""),
                                            firstName: userDetail ?
                                                userDetail.firstName :
                                                (result.firstName || ""),
                                            lastName: userDetail ?
                                                userDetail.lastName :
                                                (result.lastName || ""),
                                            userTags: result.userTags
                                        },
                                        exception: result.exception,
                                        invitationLink: result.invitationLink,
                                        invitationLinkSentDate: result.invitationLinkSentDate
                                    };
                                })
                            };
                        });
                    });
            });
    }

    async removeUserFromAccountUsergroups(accountId: string, userId: string, auditLogCallback?: AuditLogCallback): Promise<void> {
        const usergroupDetails = await this.usergroupRepository.getUsergroups(accountId);
        await this.removeUserAsGroupOwner(usergroupDetails, userId, accountId);
        await this.removeUserAsGroupMember(usergroupDetails, userId, accountId, auditLogCallback);
        await this.deviceTargetUserLinkRepository.clearEntriesFor(accountId, userId);
    }

    private async removeUserAsGroupOwner(usergroupsDetails: UsergroupDetails[], userId: string, accountId: string): Promise<void> {
        const idsOfGroupsWhereUserIsOwner = usergroupsDetails
            .filter(usergroupDetails => usergroupDetails.group.ownerUserIds?.includes(userId))
            .map(usergroupDetails => usergroupDetails.group.id.value());
        for (const groupId of idsOfGroupsWhereUserIsOwner) {
            await this.usergroupRepository.removeUserFromGroupOwners(accountId, groupId, userId);
        }
    }

    private async removeUserAsGroupMember(usergroupsDetails: UsergroupDetails[], userId: string, accountId: string, auditLogCallback?: AuditLogCallback): Promise<void> {
        const idsOfGroupsContainingUser = usergroupsDetails
            .filter(usergroupDetails => usergroupDetails.members.some(uid => uid.value() === userId))
            .map(usergroupDetails => usergroupDetails.group.id.value());
        for (const groupId of idsOfGroupsContainingUser) {
            await this.removeGroupMember(accountId, groupId, userId);
            if (typeof auditLogCallback === "function") {
                auditLogCallback(UserGroupActionType.USER_GROUP_MEMBER_REMOVED, groupId, userId);
            }
        }
    }

    private async getUserFilterFromAccounts(accountIds: string[]): Promise<Set<string>> {
        const users = new Set<string>();
        if (accountIds.length === 0) {
            return users;
        }
        const accounts = await this.accountServiceContract.findAccountsForIds(accountIds);
        for (const account of accounts) {
            account.members.forEach(member => users.add(member));
        }
        return users;
    }

    async searchUsersBackend(
        query: clientContract.UserQuery,
        options: clientContract.SearchOptions
    ): Promise<clientContract.UserSearchResult> {
        const searchResult = await this.userRepository.searchUsers(query, options);
        return {
            hitCount: searchResult.hitCount,
            hits: searchResult.hits.map(h => toClientUser(h))
        }
    }

    async searchUsergroups(
        query: clientContract.UsergroupQuery,
        options: clientContract.SearchOptions,
    ): Promise<clientContract.UsergroupSearchResult> {
        const searchResult = await this.usergroupRepository.search(query, options);
        return {
            hitCount: searchResult.hitCount,
            hits: searchResult.hits.map(h => usergroupModelToClient(h)),
        }
    }

    async searchUsers(
        query: clientContract.UserQuery,
        options: clientContract.SearchOptions,
        accountFilters?: string[],
        userId?: string
    ): Promise<clientContract.UserSearchResult> {
        /* accountFilters are checked for permissions in the routes so we can assume all ids are allowed */
        const accountIds = accountFilters || await this.getEditorAccountIdsForUserId(userId);
        if (accountIds.length === 0) {
            return {
                hits: [],
                hitCount: 0
            }
        }
        const [userFilterSet, searchResult] = await Promise.all([
            this.getUserFilterFromAccounts(accountIds),
            this.userRepository.searchUsers(query, options)
        ]);
        const hits = searchResult.hits
            .filter(user => userFilterSet.has(user.id.value()))
            .map(h => toClientUser(h));
        return {
            hits,
            hitCount: hits.length
        };
    }

    private async getEditorAccountIdsForUserId(userId: string): Promise<string[]> {
        if (!userId) return [];
        const accounts = await this.authorizationServiceContract.getAccountsForEditor(userId);
        return accounts.map(account => account.accountId);
    }

    async createGroup(
        accountId: string,
        name: string,
        options: Partial<clientContract.IGroupCreateOptions>,
        auditLogCallback?: AuditLogCallback,
    ): Promise<clientContract.Usergroup> {
        const isReadonly = !!(options && options.readonly);
        const group = Usergroup.create(name, isReadonly);
        const newGroup = await this.usergroupRepository.saveUsergroup(accountId, group);
        if (typeof auditLogCallback === "function") {
            auditLogCallback(UserGroupActionType.USER_GROUP_CREATED, newGroup.id.value());
        }
        return usergroupModelToClient(newGroup);
    }

    getGroups(accountId: string): Promise<clientContract.Usergroup[]> {
        return this.usergroupRepository.getUsergroups(accountId)
            .then(modelGroupDetails => modelGroupDetails.map(modelGroupDetail => usergroupModelToClient(modelGroupDetail.group)));
    }

    async removeGroup(
        accountId: string,
        groupId: string,
        auditLogCallback?: AuditLogCallback,
    ): Promise<boolean> {
        const id = new UsergroupIdentifier(groupId);
        const userGroup = await this.usergroupRepository.getUsergroup(accountId, id);
        const success = await this.usergroupRepository.deleteUsergroup(accountId, id);
        if (success) {
            const membersIds = userGroup.members.map(m => m.value());
            await this.authorizationServiceContract.handleCacheOnGroupMemberRemoval(accountId, groupId, membersIds);
            this.authorizationServiceContract.removeUsergroupFromAccount(accountId, groupId);
            this.credentialServiceContract.saveADGroupMapping(null, groupId, accountId);
            this.notificationServiceClient.deleteNotificationTargets(groupId, accountId);
            if (typeof auditLogCallback === "function") {
                auditLogCallback(UserGroupActionType.USER_GROUP_DELETED, groupId);
            }
        }
        try {
            await this.repositoryServiceContract.removeOwnerIdFromItemOwnershipForAccount(groupId, accountId);
        } catch (e) {
            this.logger.error(`Failed to remove the groupId ${groupId} from ownership on all items on ${accountId}`, "remove-group");
        }
        return success;
    }

    async updateGroupOwners(accountId: string, groupId: string, userIds: string[]): Promise<void> {
        const adminGroupId = await this.authorizationServiceContract.getAdminGroup(accountId);
        if (groupId === adminGroupId) {
            throw new InvalidOperation("Cannot change owners of admin group");
        }
        return this.usergroupRepository.updateGroupOwners(accountId, groupId, userIds);
    }

    async getManageableGroups(
        accountId: string,
        actorUserId: string,
        options: Partial<clientContract.ManageableGroupQueryOptions> = {},
        isBackend = false
    ): Promise<clientContract.Usergroup[]> {
        const { adminUserIds, adminGroupId } = await this.getAccountAdminGroupAndIds(accountId);
        let allGroups = await this.getGroups(accountId);

        allGroups = options.includeAutoManagedGroups ?
            allGroups :
            allGroups.filter(g => !g.isAutoManaged);

        allGroups = options.includeAccountAdminGroup ?
            allGroups :
            allGroups.filter(g => g.id !== adminGroupId);

        if (adminUserIds.includes(actorUserId) || isBackend || await this.shouldSupportContentAdminAnalytics(actorUserId, accountId)) {
            return allGroups;
        }
        const accountFeatures = await this.accountServiceContract.getAccountFeatures(accountId);
        if (!accountFeatures.includes(FEATURE_GROUP_OWNERS)) {
            return [];
        }
        return allGroups.filter(group => group.ownerUserIds?.includes(actorUserId));
    }

    private async shouldSupportContentAdminAnalytics(userId: string, accountId: string): Promise<boolean> {
        return await this.launchDarkly.getFlag(LDFlags.SUBCOLLECTION_ANALYTICS) &&
            await this.isSubcollectionContentAdmin(userId, accountId);
    }

    private async isSubcollectionContentAdmin(userId: string, accountId: string): Promise<boolean> {
        const resourceGroups = await this.authorizationServiceContract.findAllowedResourceGroups(
            userId,
            ResourceType.DOCUMENT,
            PermissionName.ADMIN,
            true,
            accountId
        );
        // Ignore empty resource groups
        return resourceGroups.some(resourceGroup => resourceGroup.ids.length > 0);
    }

    async canBeManagedBy(managedUserAccountId: string, managedUserIds: string[], groupOwnerId: string): Promise<CanBeManagedByResponse> {
        const managedUserUserGroups = await this.getGroupsForUsers(managedUserIds, managedUserAccountId);
        const groupOwnerManagedGroups = await this.getManageableGroups(managedUserAccountId, groupOwnerId);
        const groupOwnerManagedGroupIds = new Set(groupOwnerManagedGroups.map(g => g.id));
        const userIsManagedByGroupOwner = (userId: string): boolean => {
            const userGroups = managedUserUserGroups[userId] ?? [];
            return userGroups.some(ug => groupOwnerManagedGroupIds.has(ug.id));
        };
        const userIdAndManageableStatusPairs = managedUserIds.map(managedUserId => [managedUserId, userIsManagedByGroupOwner(managedUserId)]);
        return Object.fromEntries(userIdAndManageableStatusPairs);
    }

    updateGroupName(accountId: string, groupId: string, name: string): Promise<clientContract.Usergroup> {
        return this.usergroupRepository.getUsergroup(accountId, new UsergroupIdentifier(groupId))
            .then(currentUsergroupDetails => {
                const updatedUsergroup = currentUsergroupDetails.group.updateName(name);
                return this.usergroupRepository.saveUsergroup(accountId, updatedUsergroup)
                    .then(usergroupModelToClient);
            });
    }

    getGroupMembers(accountId: string, groupId: string): Promise<clientContract.UsergroupDetails> {
        return this.usergroupRepository.getUsergroup(accountId, new UsergroupIdentifier(groupId))
            .then(modelGroupDetails => this.userRepository.findUserDetailsForIds(modelGroupDetails.members)
                .then(users => usergroupDetailsModelToClient(modelGroupDetails.group, users)));
    }

    async multiGetGroupMembers(
        accountId: string,
        groupIds: string[],
        options?: MultiGetGroupMembersOptions,
    ): Promise<clientContract.UsergroupDetails[]> {
        const allAccountGroups = await this.usergroupRepository.getUsergroups(
            accountId,
            groupIds.map(id => new UsergroupIdentifier(id)),
        );

        const result: clientContract.UsergroupDetails[] = [];

        const memberUserIds = allAccountGroups.flatMap(g => g.members);
        const memberUsers = await this.userRepository.findUserDetailsForIds(memberUserIds);
        const userTagsByUserId = options?.includeUserTags ?
            await this.getUserTagsForUserIds(memberUserIds.map(id => id.value())) :
            {};

        for (const groupDetails of allAccountGroups) {
            const groupMemberIds = groupDetails.members.map(id => id.value());
            const users = memberUsers.filter(u => groupMemberIds.includes(u.id.value()));
            result.push(usergroupDetailsModelToClient(groupDetails.group, users, userTagsByUserId));
        }

        return result;
    }

    async multiGetGroupMemberIds(accountId: string, groupIds: string[]): Promise<clientContract.UsergroupMembersMap> {
        if (!groupIds.length) {
            return {};
        }
        const usergroups = await this.usergroupRepository.getUsergroups(accountId, groupIds.map(id => new UsergroupIdentifier(id)));
        return usergroups.reduce((reduced, usergroup) => {
            reduced[usergroup.group.id.value()] = usergroup.members.map(id => id.value());
            return reduced;
        }, {});
    }

    async addGroupMember(accountId: string, groupId: string, userId: string): Promise<void> {
        await this.ensureEditorCreatedUsersAreNotMadeAccountAdmins(accountId, groupId, [userId]);
        await this.authorizationServiceContract.handleCacheOnGroupMemberRemoval(accountId, groupId, [userId], true);
        return this.usergroupRepository.addGroupMemberInAccount(accountId, new UsergroupIdentifier(groupId), new UserIdentifier(userId));
    }

    private async ensureEditorCreatedUsersAreNotMadeAccountAdmins(accountId: string, groupId: string, userIds: string[]): Promise<void> {
        const uniqueUserIds = new Set(userIds);
        const adminGroupId = await this.authorizationServiceContract.getAdminGroup(accountId);
        if (adminGroupId !== groupId) {
            return;
        }
        const foundUsers = await this.userRepository.getUsers([...uniqueUserIds]);
        if (foundUsers.length !== uniqueUserIds.size) {
            const foundUserIds = new Set(foundUsers.map(user => user.id.value()));
            for (const userId of uniqueUserIds) {
                if (!foundUserIds.has(userId)) {
                    throw new UserNotFound(userId);
                }
            }
        }
        const foundUsersNotAllowedToBecomeAdmins = foundUsers.some(user => user.creationMethod === UserCreationMethod.EDITOR);
        if (foundUsersNotAllowedToBecomeAdmins) {
            throw new NotAllowed(i18next.t(TK.User_NotAllowedAsAccountAdmin));
        }
    }

    async addGroupMembers(
        accountId: string,
        groupId: string,
        userIds: string[],
        replaceInGroup = false,
        auditLogCallback?: AuditLogCallback
    ): Promise<void> {
        await this.ensureEditorCreatedUsersAreNotMadeAccountAdmins(accountId, groupId, userIds);
        await this.authorizationServiceContract.handleCacheOnGroupMemberRemoval(accountId, groupId, userIds, true);
        const { removedMembers } = await this.usergroupRepository.addGroupMembersInAccount(accountId, groupId, userIds, replaceInGroup);
        removedMembers.forEach(userId => auditLogCallback?.(UserGroupActionType.USER_GROUP_MEMBER_REMOVED, groupId, userId));
        userIds.forEach(userId => auditLogCallback?.(UserGroupActionType.USER_GROUP_MEMBER_ADDED, groupId, userId));
    }

    async removeGroupMember(accountId: string, groupId: string, userId: string): Promise<void> {
        await this.authorizationServiceContract.handleCacheOnGroupMemberRemoval(accountId, groupId, [userId], true);
        return this.usergroupRepository.removeGroupMemberInAccount(accountId, new UsergroupIdentifier(groupId), new UserIdentifier(userId));
    }

    async multiAddGroupMembers(
        accountId: string,
        userGroupsQuery: clientContract.IUserGroupsQuery,
        userIds: string[],
        options: clientContract.IMultiAddMembersOptions,
        auditLogCallback?: AuditLogCallback,
    ): Promise<clientContract.Usergroup[]> {
        const { doSync, createGroupIfDoesntExist, makeNewUsergroupReadonly, makeNewUsergroupAutoManaged } = options;
        const existingGroups = await this.usergroupRepository.multiget(accountId, userGroupsQuery);
        let usergroups = [];

        const ensureUserGroups = async () => {

            let isNoGroupsFoundErr;
            if (createGroupIfDoesntExist) {
                const readonly = !!makeNewUsergroupReadonly;
                const autoManaged = !!makeNewUsergroupAutoManaged;
                if ("names" in userGroupsQuery) {
                    for (const name of userGroupsQuery.names) {
                        const existingGroup = existingGroups.find(ug => ug.name === name);
                        if (existingGroup) {
                            usergroups.push(existingGroup);
                            continue;
                        }
                        const usergroup = await this.usergroupRepository.saveUsergroup(accountId, Usergroup.create(name, readonly, autoManaged));
                        usergroups.push(usergroup);
                        if (typeof auditLogCallback === "function") {
                            auditLogCallback(UserGroupActionType.USER_GROUP_CREATED, usergroup.id.value());
                        }
                    }
                } else {
                    // if queried by something else than names, we cannot create the groups here
                    isNoGroupsFoundErr = true;
                }
            } else {
                isNoGroupsFoundErr = !userGroupsQuery.names || !existingGroups.length;
                usergroups = existingGroups;
            }
            if (isNoGroupsFoundErr) {
                throw new Error(`Cannot perform multiadd: No usergroups found with query ${JSON.stringify(userGroupsQuery)}`);
            }
        };

        try {
            await ensureUserGroups();
        }
        catch (e) {
            this.logger.error(e.message, "multiAddGroupMembers");
            return [];
        }

        const usergroupsWithDetails = await this.usergroupRepository.getUsergroups(accountId, usergroups.map(ug => ug.id));
        if (doSync) {
            const usergroupsForAccount = await this.usergroupRepository.getUsergroups(accountId);
            for (const uGroup of usergroupsForAccount) {
                if (uGroup.group.isAutoManaged) {
                    continue;
                }
                if (!usergroupsWithDetails.some(g => g.group.id.value() == uGroup.group.id.value())) {
                    userIds.forEach(uid => {
                        this.removeGroupMember(accountId, uGroup.group.id.value(), uid);
                        if (typeof auditLogCallback === "function") {
                            auditLogCallback(UserGroupActionType.USER_GROUP_MEMBER_REMOVED, uGroup.group.id.value(), uid);
                        }
                    });
                }
            }
        }
        const addedUserGroups: clientContract.Usergroup[] = [];
        for (const usergroup of usergroupsWithDetails) {
            const usergroupMembersIds = new Set(usergroup.members.map(member => member.value()));
            const membersToAdd = userIds.filter(userId => !usergroupMembersIds.has(userId));
            if (membersToAdd.length > 0) {
                const groupId = usergroup.group.id.value();
                try {
                    await this.addGroupMembers(accountId, groupId, userIds, false, auditLogCallback);
                } catch (e) {
                    this.logger.error(`Failed to add users to group: ${groupId}. Reason: ${e}`, "multi-add-group-members");
                    continue;
                }
            }
            const addedUsergroup = usergroupModelToClient(usergroup.group);
            addedUserGroups.push(addedUsergroup);
        }
        return addedUserGroups;
    }

    confirmUser(login: string): Promise<clientContract.User> {
        return this.userRepository.getUserByLogin(login)
            .then((user: User) => {
                const clientUser: clientContract.User = toClientUser(user);
                return Promise.resolve(clientUser);
            });
    }

    createUser(
        login: string,
        displayName: string,
        firstName = "",
        lastName = "",
        type: clientContract.UserType = clientContract.UserType.Individual,
        licenseCount = 1,
        allowDuplicate = false,
        isPasswordless = false,
    ): Promise<clientContract.User> {
        const repo = this.userRepository;
        return Login.build(login).caseOf({
            left: (error) => Promise.reject<clientContract.User>(error),
            right: (loginObject: Login) => {
                return repo.isLoginAvailable(loginObject)
                    .then(available => {
                        if (available) {
                            const user = User.create({
                                login: loginObject, displayName, firstName, lastName, type, licenseCount, isPasswordless
                            });
                            return repo.saveUser(user);
                        }
                        if (allowDuplicate) {
                            return repo.getUserByLogin(login);
                        }
                        throw new LoginNotAvailable(login.toLowerCase());
                    })
                    .then(toClientUser);
            }
        });
    }

    async createDeviceTargetUsers(names: string[], accountId: string, deviceUserLogin: string): Promise<clientContract.CreateDeviceTargetUserResult> {
        const domainFilters = await this.routingServiceContract.getDomainFiltersForAccounts([accountId]);
        if (!domainFilters?.length) {
            throw new Error("Cannot create device target users for accounts without a domain");
        }
        const domain = domainFilters[0].domain;

        const logins = names.map(
            name => createDeviceUserEmail(name, deviceUserLogin, domain)
        );
        const existingUsers = await this.getUsersByLogins(logins);

        const createUserPromises = names.map(name => {
            const login = createDeviceUserEmail(name, deviceUserLogin, domain);
            if (existingUsers.some(user => user.login === login)) return null;
            return this.createUser(login, name, "", "", undefined, undefined, undefined, true);
        }).filter(v => v != null);
        const createdUsers = await Promise.all(createUserPromises);

        const users = [...createdUsers, ...existingUsers];
        const [account] = await this.accountServiceContract.addMembers(
            accountId,
            users.map(u => u.id),
            ManageMemberTrigger.ASSIGNED_AS_DEVICE_TARGET_USER,
        );
        return {
            newUsers: users,
            accountMembers: account.members,
        };
    }

    private async getAccountAdminGroupAndIds(accountId: string): Promise<{ adminUserIds: string[], adminGroupId: string }> {
        const adminGroupId = await this.authorizationServiceContract.getAdminGroup(accountId);
        const accountAdmins = await this.authorizationServiceContract.getAccountAdmins(accountId);
        const accountAdminsSet = new Set<string>(accountAdmins);
        if (adminGroupId != null) {
            const group = await this.usergroupRepository.getUsergroup(accountId, new UsergroupIdentifier(adminGroupId));
            group.members.forEach(member => {
                accountAdminsSet.add(member.value());
            });
        }
        return {
            adminUserIds: Array.from(accountAdminsSet),
            adminGroupId: adminGroupId,
        }
    }

    async assignDeviceTargetUsers(
        accountId: string,
        deviceUserId: string,
        userAndGroupIds: string[],
        usergroupIntersections: string[][] = [],
    ): Promise<clientContract.DeviceTargetUserLink[]> {
        const rejectedUsers: string[] = [];

        const alUsersAndGroupsIds = [...new Set([...userAndGroupIds, ...usergroupIntersections.flat()])]
        const accountIdMap = await this.accountServiceContract.getAccountIdsForUsersAndGroups(alUsersAndGroupsIds);
        for (const [id, itsAccountIds] of Object.entries(accountIdMap)) {
            if (!itsAccountIds.includes(accountId)) {
                rejectedUsers.push(id);
            }
        }

        if (rejectedUsers.length > 0) {
            this.logger.warn(`Following users couldn't be assigned to the device user due to not existing or being in a different account ${JSON.stringify(rejectedUsers)}`, "assignDeviceTargetUsers")
            throw new Unauthorized("Not allowed to assign provided target users");
        }

        if (!usergroupIntersections.flat().every(isUsergroupId)) {
            this.logger.warn(`Received invalid group IDs in ${JSON.stringify({ usergroupIntersections })}`, "assignDeviceTargetUsers");
            throw new InvalidArgument("Not allowed to join provided groups");
        }

        const [usergroupIds, userIds] = partition(isUsergroupId, userAndGroupIds);
        const users = await this.userRepository.getUsers(userIds);
        const nonMtUsers = users.filter(u => !isManualToLogin(u.login.value()));

        await this.deviceTargetUserLinkRepository.setDeviceTargetUsers(
            accountId,
            deviceUserId,
            [
                ...nonMtUsers.map(u => u.id.value()),
                ...usergroupIds,
            ],
            usergroupIntersections,
        );
        return this.getDeviceTargetUserLinks(accountId);
    }

    async getUserByLogin(login: string): Promise<clientContract.User> {
        const user = await this.userRepository.getUserByLogin(login);
        return toClientUser(user);
    }

    private async getUsersByLogins(logins: string[]): Promise<clientContract.User[]> {
        const users = await this.userRepository.getUsersByLogins(logins);
        return users.map(user => toClientUser(user));
    }

    async handleUserExists(
        accountId: string,
        user: User,
    ): Promise<Partial<clientContract.UserImportResult>> {
        const account = await this.accountServiceContract.getAccount(accountId);
        let skipInsert = false;
        if (!(account.members.includes(user.id.value()))) {
            await this.accountServiceContract.addMembers(
                accountId,
                [user.id.value()],
                ManageMemberTrigger.USER_IMPORT,
            );
            skipInsert = true;
        }
        return {
            user,
            exception: "Login already exists",
            skipInsert,
        };
    }

    async importCevaUsers(users: CevaUser[], accountId: string, replaceInGroup: boolean, userId?: string): Promise<clientContract.UserImportAction> {
        if (!userId) {
            throw new Unauthorized("Public imports are not allowed");
        }
        const accountFeatures = await this.accountServiceContract.getAccountFeatures(accountId)
        if (!accountFeatures.includes(FEATURE_CEVA)) {
            throw new Error("Feature `ceva` not enabled for the account");
        }
        return importCevaUsers(
            users,
            accountId,
            userId,
            replaceInGroup,
            this.usergroupRepository,
            this.userRepository,
            this.userTagRepository,
            this.userImportActionRepository,
            this.accountServiceContract,
            this,
            this.logger
        );
    }

    async importUsers(
        users: clientContract.User[],
        accountId: string,
        domain: string,
        usergroupId = "",
        replaceInGroup = false,
        allGroups: GroupMap,
        fromUserId?: string,
        fromUserIp?: string | string[],
        fromUserAgent?: string,
        auditLogCallback?: AuditLogCallback,
    ): Promise<clientContract.UserImportAction> {
        const userRepo = this.userRepository;
        const userCreationPromises: Array<Promise<clientContract.UserImportResult>> = [];
        const loginsInBatch = new Set<string>();

        const usersToAddToGroupMap: Record<string, UserIdentifier[]> = {};
        for (const user of users) {
            let importResult = <clientContract.UserImportResult>{ user, importDate: new Date() };
            Login.build(user.login).caseOf({
                left: (error) => {
                    userCreationPromises.push(new Promise((resolve) => {
                        importResult.exception = error.message;
                        resolve(importResult);
                    }));
                },
                right: (loginObject: Login) => {
                    userCreationPromises.push(
                        // eslint-disable-next-line no-async-promise-executor
                        new Promise(async (resolve) => {
                            let userWithThisLogin: User;
                            try {
                                userWithThisLogin = await userRepo.getUserByLogin(loginObject.value());
                            } catch (err) {
                                if (!EntityNotFound) {
                                    this.logger.error(err, "import-users");
                                }
                            }
                            if (userWithThisLogin) {
                                importResult = {
                                    ...importResult,
                                    ...(await this.handleUserExists(accountId, userWithThisLogin)),
                                };

                                user.groups.forEach(g => {
                                    const gId = allGroups[g];
                                    if (usersToAddToGroupMap[gId]) {
                                        usersToAddToGroupMap[gId] = [...usersToAddToGroupMap[gId], userWithThisLogin.id];
                                    } else {
                                        usersToAddToGroupMap[gId] = [userWithThisLogin.id];
                                    }
                                });
                            } else {
                                const { displayName, firstName, lastName } = user;
                                const newUser = User.create({ login: loginObject, displayName, firstName, lastName });
                                user.groups.forEach(g => {
                                    const gId = allGroups[g];
                                    if (usersToAddToGroupMap[gId]) {
                                        usersToAddToGroupMap[gId] = [...usersToAddToGroupMap[gId], newUser.id];
                                    } else {
                                        usersToAddToGroupMap[gId] = [newUser.id];
                                    }
                                });
                                if (!loginsInBatch.has(user.login)) {
                                    loginsInBatch.add(user.login);
                                    importResult.user = newUser;
                                }
                            }
                            resolve(importResult);
                        })
                    );
                }
            });
        }


        const createResults = await Promise.all(userCreationPromises);

        const [toInsertResults, toSkipResults, errorResults] = createResults.reduce((acc, result) => {
            if (result.exception) {
                if (result.skipInsert) {
                    acc[1].push(result);
                } else {
                    acc[2].push(result);
                }
                return acc;
            }
            acc[0].push(result);
            return acc;
        }, [[], [], []]);

        const toInsertUsers = toInsertResults.map(r => r.user);

        const toSkipUsers = toSkipResults.map(r => toClientUser(r.user));

        const insertedUsers = await userRepo.insertUsers(toInsertUsers);
        const insertedUsersClient = insertedUsers.map(u => toClientUser(u));
        const importedUsers = [...toSkipUsers, ...insertedUsersClient];

        await Promise.all(
            Object.keys(usersToAddToGroupMap).map(async gId => {
                const groupId = new UsergroupIdentifier(gId);
                const userIds = usersToAddToGroupMap[gId];
                const uidValues = userIds.map(u => u.value());
                await this.addGroupMembers(
                    accountId,
                    groupId.value(),
                    uidValues,
                    replaceInGroup,
                    auditLogCallback,
                );
            })
        );
        const userIdsToBeAdded: string[] = createResults
            .filter(r => r.user)
            .map(r => r.user.id.value());

        // add users to account
        await this.accountServiceContract.addMembers(
            accountId,
            userIdsToBeAdded.map(uid => uid),
            ManageMemberTrigger.USER_IMPORT,
            fromUserId,
            fromUserIp,
            fromUserAgent,
        );


        // add users to usergroup
        if (usergroupId && usergroupId !== "-1") {
            await this.addGroupMembers(
                accountId,
                usergroupId,
                userIdsToBeAdded,
                replaceInGroup,
                auditLogCallback,
            );
        }

        // insert userpreferences based on language in csv
        const userPreferences = insertedUsersClient
            .filter(clientUser => (
                users.some(user => user.login === clientUser.login))
            ).map(u => ({
                userId: u.id,
                readerLanguages: [users.find(user => user.login === u.login).preferredLanguage],
                defaultAnalyticsRange: undefined
            })
            );
        await this.userPreferenceRepository.insertPreferences(userPreferences);

        // create the import results array
        const importResults = importedUsers.map(user => {
            return <clientContract.UserImportResult>{ user, importDate: new Date() }
        });

        // populate the import results with the invitation links
        const invitationLinksKeyValues = await this.createInvitationLinks(importedUsers, domain);
        for (const invLinkKeyValue of invitationLinksKeyValues) {
            const importResult = importResults.find(r => r.user.id && r.user.id === invLinkKeyValue[0]);
            if (importResult) {
                importResult.invitationLink = invLinkKeyValue[1];
            }
        }

        const results = [...errorResults, ...importResults];
        const userImportAction = new UserImportAction(
            accountId,
            new Date().toISOString(),
            results.map(r => toModelUserImportResult(r))
        );
        await this.userImportActionRepository.insertUserImportAction(userImportAction);
        return toClientUserImportAction(userImportAction);
    }

    getPreferences(userId: string): Promise<clientContract.UserPreferences> {
        return this.withValidUserId(userId,
            userIdObject => this.userPreferenceRepository.getPreferences(userIdObject)
        );
    }

    async getPreferencesMulti(userIds: string[]): Promise<{ [userId: string]: clientContract.UserPreferences }> {
        const allPreferences = await this.userPreferenceRepository.getPreferencesMulti(userIds.map(id => new UserIdentifier(id)));
        return allPreferences.reduce((acc, preferences) => ({
            ...acc,
            [preferences.userId]: preferences,
        }), {});
    }

    async getBrandingForMail(domain?: string): Promise<ReaderBranding | undefined> {
        return domain && await this.routingServiceContract.getBrandingForReaderDomain(domain);
    }

    getUser(id: string): Promise<clientContract.User> {
        return this.withValidUserId(id,
            userId => this.userRepository.getUser(userId)
                .then(toClientUser)
        );
    }

    async getUsers(ids: string[]): Promise<clientContract.User[]> {
        const userIds = ids.filter(UserIdentifier.isUserId);

        // If group ids are passed, return the members of those groups
        const groupIds = ids.filter(UsergroupIdentifier.isUsergroupId);
        if (groupIds.length > 0) {
            const groupIdentifiers = groupIds.map(id => new UsergroupIdentifier(id));
            const groups = await this.usergroupRepository.getUsergroupsById(groupIdentifiers);
            const userIdsFromGroups = groups.map(g => g.members).flat();
            userIds.push(...userIdsFromGroups.map(id => id.value()))
        }

        return await this.userRepository.getUsers(userIds).then(users => users.map(u => toClientUser(u)));
    }


    listUsers(): Promise<clientContract.User[]> {
        return this.userRepository
            .listUsers()
            .then(users => users.map(u => toClientUser(u)));
    }

    async getTermsToAccept(userId: string): Promise<clientContract.ITermsMap> {
        const termsVersionsMap = buildTermsVersionsMap(this.logger);
        return this.withValidUserId(
            userId,
            async userIdObject => {
                const acceptancesForUser = await this.termsAcceptanceRepository.getTermsAcceptancesForUser(userIdObject);
                return Object.keys(termsVersionsMap).reduce((reduced, accountId) => {
                    const termsInfo = termsVersionsMap[accountId];
                    if (acceptancesForUser.some(acc =>
                        acc.accountId === accountId &&
                        acc.acceptedTermsVersion === termsInfo.version
                    )) {
                        return reduced;
                    }
                    return {
                        ...reduced,
                        [accountId]: termsInfo,
                    };
                }, {});
            }
        );
    }

    async saveTermsAcceptance(userId: string, accountId: string, version: string): Promise<void> {
        await this.withValidUserId(userId,
            async userIdObject => {
                await this.termsAcceptanceRepository.saveTermsAcceptance(
                    userIdObject,
                    accountId,
                    version,
                );
            }
        );
    }

    async getTermsInfo(accountId: string): Promise<clientContract.ITermsInfo> {
        const termsVersionsMap = buildTermsVersionsMap(this.logger);
        return termsVersionsMap[accountId];
    }

    async multiGetUsersAndGroups(
        accountId: string,
        ids: string[],
        includeDeleted = false
    ): Promise<Array<clientContract.User | clientContract.Usergroup>> {
        const [userIds, userGroupIds] = ids.reduce((reduced, id) => {
            if (UsergroupIdentifier.isUsergroupId(id)) {
                reduced[1].push(new UsergroupIdentifier(id));
            } else if (UserIdentifier.isUserId(id)) {
                reduced[0].push(id);
            }
            return reduced;
        }, [[], []]);
        const users: User[] = (userIds.length && await this.userRepository.getUsers(userIds, includeDeleted)) || [];
        const usergroupDetails = (userGroupIds.length && (await this.usergroupRepository.getUsergroups(accountId, userGroupIds, includeDeleted))) || [];
        const usergroups: Usergroup[] = usergroupDetails.map(ugd => ugd.group);
        const clientUsers = users.map(u => toClientUser(u));
        const clientUsergroups = usergroups.map(g => usergroupModelToClient(g));
        return [...clientUsers, ...clientUsergroups];
    }

    async myDetails(session: AuthenticatedSession): Promise<clientContract.UserDetails> {
        const [user, preferences, termsToAccept, canAccessBackend] = await Promise.all([
            this.whoAmI(session),
            this.getPreferences(session.userId),
            this.getTermsToAccept(session.userId),
            this.authorizationServiceContract.canAccessBackend(session.userId),

        ]);
        const isAllowedToChangePassword = await this.credentialServiceContract.hasPassword(user.id);
        return {
            user,
            preferences,
            termsToAccept,
            canAccessBackend,
            sessionId: session.sessionId,
            isAllowedToChangePassword,
        };
    }

    savePreferences(userId: string, partialPreferences: Partial<clientContract.UserPreferences>): Promise<clientContract.UserPreferences> {
        return this.withValidUserId(userId,
            async userIdObject => {
                const preferences = {
                    ...(await this.userPreferenceRepository.getPreferences(userIdObject)),
                    userId,
                };
                return this.userPreferenceRepository.savePreferences(userIdObject, { ...preferences, ...partialPreferences });
            }
        );
    }

    async updateUser(user: clientContract.User, accountId?: string, actorId?: string): Promise<clientContract.User> {
        if (!actorId) {
            throw new Unauthorized("Missing actorId");
        }

        if (actorId !== "backend") {
            await this.verifyChangedUserBelongsToAccount(user.id, accountId);
            await verifyActorIsAdminOnAllChangedUserAccounts(this.accountServiceContract, user.id, actorId);
        }
        const updatedUser = toModelUser(user);
        return this.performUserUpdate(updatedUser, accountId, actorId);
    }

    private async verifyChangedUserBelongsToAccount(userId: string, accountId?: string) {
        if (!accountId) {
            return;
        }
        const accountIds = await this.accountServiceContract.getAccountIdsForUser(userId);
        if (!accountIds.includes(accountId)) {
            throw new Unauthorized("Not allowed to change users that don't belong to current account.");
        }
    }

    private async performUserUpdate(userNewData: User, accountId?: string, actorId?: string) {
        const userOldData = await this.userRepository.getUser(userNewData.id);
        const isLoginChange = !userOldData.login.equals(userNewData.login);
        if (
            userNewData.type !== userOldData.type &&
            userNewData.type === clientContract.UserType.Device &&
            isManualToLogin(userNewData.login.value())
        ) {
            throw new Unauthorized("Manual.to users cannot be set as a device");
        }
        if (isLoginChange) {
            this.verifyManualToLoginChange(userOldData);
            this.verifyManualToLoginChange(userNewData);
            await this.verifyLoginAvailable(userOldData, userNewData);
            this.verifySelfLoginChange(userOldData, actorId);
        }
        const updatedUser = await this.userRepository.saveUser(userNewData);
        if (isLoginChange) {

            let readerBranding;
            let domain;
            if (accountId) {
                const domainFilters = [...await this.routingServiceContract.getDomainFiltersForAccounts([accountId])];
                domain = domainFilters[0]?.domain;
                readerBranding = await this.getBrandingForMail(domain);
            }

            await this.credentialServiceContract.updateLogin(updatedUser.id.value(), updatedUser.login.value())
                .catch((err) => this.logger.error(
                    `Failed propagating change to credential service: ${JSON.stringify(err)}`, "loginUpdate"));

            await this.sendLoginChangeEmail(
                userNewData.login.value(),
                userOldData.login.value(),
                domain,
                readerBranding,
                buildUserName(userModelToInterface(userNewData), { preferFirstName: true, noFallbackToId: true, }),
            );
        }
        return toClientUser(updatedUser);
    }

    private verifyManualToLoginChange(user: User) {
        const login = user.login.value().toLowerCase();
        // Allow anonymizing the e2e login for reuse
        if (isManualToLogin(login) && !isManualToE2eLogin(login)) {
            throw new Unauthorized("Not allowed to change @manual.to logins");
        }
    }

    private verifySelfLoginChange(userOldData: User, actorId?: string) {
        if (actorId && actorId === userOldData.id.value()) {
            throw new Unauthorized("Not allowed to change own login");
        }
    }

    private async verifyLoginAvailable(userOldData: User, userNewData: User) {
        try {
            const userWithLogin = await this.userRepository.getUserByLogin(userNewData.login.value());
            if (!userWithLogin.id.equals(userOldData.id)) {
                throw new LoginNotAvailable(userWithLogin.login.value());
            }
        } catch (error) {
            if (!(error instanceof UserNotFound)) {
                throw error;
            }
        }
    }

    private async sendLoginChangeEmail(login: string, oldLogin: string, domain = "", readerBranding?: ReaderBranding, firstName?: string) {
        try {
            await this.mailer.sendLoginChangeEmail(login, oldLogin, domain, readerBranding, firstName);
        } catch (error) {
            this.logger.warn(`Failed to send login change email. Reason ${JSON.stringify(error)}`, "loginUpdate");
        }
        // Separate try catch so that if one fails, the other will still be ran
        try {
            await this.mailer.sendLoginRemovedEmail(oldLogin, domain, readerBranding, firstName);
        } catch (error) {
            this.logger.warn(`Failed to send login removed email. Reason ${JSON.stringify(error)}`, "loginUpdate");
        }
    }

    whoAmI(session: AuthenticatedSession): Promise<clientContract.User> {
        const userIdObject = new UserIdentifier(session.userId);
        return this.userRepository.getUser(userIdObject).then(toClientUser);
    }

    updateLastOnline(userId: string): Promise<void> {
        const userIdObject = new UserIdentifier(userId);
        return this.userRepository.updateLastOnline(userIdObject);
    }

    withValidUserId<T>(userId: string, process: (uid: UserIdentifier) => Promise<T>): Promise<T> {
        return UserIdentifier.build(userId).caseOf({
            left: (error) => Promise.reject<T>(error),
            right: (userIdObject) => process(userIdObject)
        });
    }

    async getUserTagsForUserIds(userIds: string[]): Promise<Record<string, IUserTag[]>> {
        const userTags = await this.userTagRepository.getAllForUserIds(userIds);
        return userTags.reduce<Record<string, IUserTag[]>>((map, userTag) => {
            if (map[userTag.id] == null) {
                map[userTag.id] = [userTag];
            } else {
                map[userTag.id].push(userTag);
            }
            return map;
        }, {});
    }

    async findUserDetailsForIds(userIds: Array<string>, skipDeleted?: boolean, userId?: string): Promise<Array<clientContract.User>> {
        let newUserIds = userIds;
        if (userId && userId !== "backend") {
            const userAdminAccounts = await this.accountServiceContract.getAccountsForUser(userId, { checkForAdminPermission: true });
            const userAdminAccountsMembers = userAdminAccounts.reduce((result, { members }) => {
                members.forEach(result.add, result);
                return result;
            }, new Set<string>())
            newUserIds = [];
            for (let i = 0; i < userIds.length; i++) {
                const userId = userIds[i];
                if (userAdminAccountsMembers.has(userId)) {
                    newUserIds.push(userId);
                }
            }
        }
        const idObjects = newUserIds.map(id => new UserIdentifier(id));
        const users = await this.userRepository.findUserDetailsForIds(idObjects, skipDeleted);

        const userTagsByUserId = await this.getUserTagsForUserIds(newUserIds);

        const userIdsInNeedOfToken = [];
        users.forEach(u => {
            if (!u.lastOnline) {
                userIdsInNeedOfToken.push(u.id.value());
            }
        })
        const tokens = userIdsInNeedOfToken.length > 0 ?
            await this.credentialServiceContract.getUsersTokens(userIdsInNeedOfToken) :
            [];

        const tokensById = tokens.reduce<Record<string, string>>((map, token) => {
            map[token.userId] = token.token;
            return map;
        }, {});

        return users.map(u => toClientUser(u, userTagsByUserId[u.id.value()] ?? [], tokensById));
    }

    async getDeviceTargetUserLinks(accountId: string): Promise<Array<clientContract.DeviceTargetUserLink>> {
        const links = await this.deviceTargetUserLinkRepository.findDeviceTargetUserLinks({ accountId });
        return resolveDeviceUserIds(
            links,
            groupIds => this.multiGetGroupMemberIds(accountId, groupIds),
        );
    }

    async getDeviceTargetIds(accountId: string, deviceUserId: string, expandGroups = false): Promise<string[]> {
        if (deviceUserId == null) throw new Error("DeviceUserId is required in getDeviceTargetIds");
        const link = await this.deviceTargetUserLinkRepository.getDeviceTargetUserLink(accountId, deviceUserId);
        if (!link) return [];
        const [deviceTargetUserLink] = await resolveDeviceUserIds(
            [link],
            groupIds => this.multiGetGroupMemberIds(accountId, groupIds),
        )
        const { resolvedUserIds } = deviceTargetUserLink;
        const deviceUserTargetIds = deviceTargetUserLink?.userIds ?? [];
        const [targetUsergroupIds, targetUserIds] = partition(isUsergroupId, deviceUserTargetIds);

        if (expandGroups) {
            targetUserIds.push(...resolvedUserIds)
        } else {
            targetUserIds.push(...targetUsergroupIds);
        }

        return [...new Set<string>(targetUserIds)];
    }

    async getGroupsForUser(userId: string, accountId: string): Promise<Array<clientContract.Usergroup>> {
        const userGroupsPerUser = await this.getGroupsForUsers([userId], accountId);
        return userGroupsPerUser[userId] || [];
    }

    async getGroupsForUsers(userIds: string[], accountId: string): Promise<clientContract.UsergroupsPerUser> {
        return this.usergroupRepository.getGroupsForUsers(
            userIds,
            accountId
        );
    }

    getGroupsForUserBackend(userId: string): Promise<Array<clientContract.Usergroup>> {
        return this.usergroupRepository.getGroupsForUser(new UserIdentifier(userId))
            .then(models => models.map(usergroupModelToClient));
    }

    insertWhitelistedEmail(
        accountId: string,
        domain: string,
        pattern: string,
        auditLogCallback?: (
            accountId: string,
            domain: string,
            pattern: string,
            activate: boolean,
        ) => void,
    ): Promise<clientContract.WhitelistedEmail> {
        const whitelistedEmail = new WhitelistedEmail(undefined, accountId, domain, pattern, true);
        if (typeof auditLogCallback === "function") {
            auditLogCallback(accountId, domain, pattern, true);
        }
        return this.whitelistedEmailRepository.insertWhitelistedEmail(whitelistedEmail);
    }

    async setWhitelistedEmailActive(
        id: string,
        active: boolean,
        accountId?: string,
        auditLogCallback?: (
            accountId: string,
            domain: string,
            pattern: string,
            activate: boolean,
        ) => void,
    ): Promise<void> {
        const whitelistedEmail = await this.whitelistedEmailRepository.getWhitelistedEmailById(id);
        if (typeof auditLogCallback === "function" && !!whitelistedEmail) {
            const { accountId, domain, pattern } = whitelistedEmail;
            auditLogCallback(accountId, domain, pattern, active);
        }
        return this.whitelistedEmailRepository.setWhitelistedEmailActive(id, active);
    }

    listWhitelistedEmails(accountId: string, filter: clientContract.IWhitelistedEmailFilter): Promise<Array<clientContract.WhitelistedEmail>> {
        return this.whitelistedEmailRepository.listWhitelistedEmails(accountId, filter);
    }


    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types,@typescript-eslint/no-explicit-any
    insertScriptRunStat(scriptName: string, data: any): Promise<ScriptRunStat> {
        return this.scriptRunStatRepository.insertScriptRunStat(new ScriptRunStat(scriptName, new Date(), data));
    }

    listScriptStats(scriptName: string): Promise<Array<ScriptRunStat>> {
        return this.scriptRunStatRepository.listScriptStats(scriptName);
    }

    getLatestScriptStats(scriptName: string): Promise<ScriptRunStat> {
        return this.scriptRunStatRepository.getLatestScriptStats(scriptName);
    }

    isEmailAllowedToSignup(accountId: string, domain: string, email: string): Promise<boolean> {
        return this.whitelistedEmailRepository.isEmailWhitelisted(accountId, domain, email)
            .then(allowed => {
                if (allowed) return true;
                return this.userImportActionRepository
                    .findUserImportActions({
                        accountId,
                        userImportResults: mongoose.trusted({ $regex: `.*${email}.*` }),
                    })
                    .then(actions => {
                        for (const action of actions) {
                            if (action.userImportResults.find(res => { return res.login === email && !!res.invitationLink; })) {
                                return true;
                            }
                        }
                        return false;
                    });
            });
    }

    async requestInvitation(
        accountId: string,
        domain: string,
        email: string,
        interfaceLanguage: string,
        fromUserAgent?: string,
        fromUserId?: string,
        fromUserIp?: string | string[],
    ): Promise<string> {
        await this.validateDomain(domain);
        const [allowed, account, user] = await Promise.all([
            this.isEmailAllowedToSignup(accountId, domain, email),
            this.accountServiceContract.getAccount(accountId),
            this.userRepository.searchUsers({ login: email }, {}).then(result => result.hits[0]),
        ]);
        const alreadyMember = user && (account.members.indexOf(user.id.value()) > -1);
        if (allowed && !alreadyMember) {
            const invitedUser = await this.inviteUser(email, accountId, domain);
            if (!invitedUser) {
                this.logger.error(`invitation request denied; could not save ${email} as User`, "request-invitation");
                return "500";
            }
            await this.accountServiceContract.addMember(
                accountId,
                invitedUser.id,
                ManageMemberTrigger.SELF_SIGNUP,
                false,
                fromUserId,
                fromUserIp,
                fromUserAgent,
            );
            await this.savePreferences(invitedUser.id, {
                userId: invitedUser.id,
                interfaceLanguage,
                defaultAnalyticsRange: undefined
            });
        } else {
            if (!allowed) {
                this.logger.error(`invitation request denied; email ${email} was not whitelisted nor was it successfully imported`, "request-invitation");
                return "403";
            }
            if (alreadyMember) {
                this.logger.error("invitation request denied; already an account member", "request-invitation");
                return "409";
            }
        }
        return "200";
    }

    async insertUserTag(userTag: IUserTag, options = { upsert: false }): Promise<void> {
        if (options.upsert) {
            await this.userTagRepository.upsertMulti([userTag]);
        } else {
            await this.userTagRepository.insert(userTag);
        }
    }

    async getUserTags(userId: string, filter: { context?: string; name?: string } = {}): Promise<IUserTag[]> {
        return await this.userTagRepository.getUserTags(userId, pick(["context", "name"], filter));
    }

    async listUsersAccess(accountId: string, userIds: string[], includePublicAdvertised = false): Promise<clientContract.UserAccessPerUser> {
        const userGroupsPerUser = await this.getGroupsForUsers(userIds, accountId);
        const allUserGroupsIds = Object.values(userGroupsPerUser).reduce((acc, userGroups) => [
            ...acc,
            ...userGroups.map(userGroup => userGroup.id),
        ], [] as string[]);
        const allAcls = await this.authorizationServiceContract.userDocumentsAcls(
            [...allUserGroupsIds, ...userIds],
            accountId,
        );

        const allItemIds = new Set<string>();

        const alcResourcePermissionsPerUser: Record<string, AclResourcePermission[]> = userIds.reduce((acc, userId) => {
            const userGroupsForUser = userGroupsPerUser[userId];
            const userIdAndGroupsIds = [...userGroupsForUser.map(g => g.id), userId];
            const userAcls = allAcls.filter(acl => acl.assignees.some(assignee => userIdAndGroupsIds.some(id => assignee.ids.includes(id))));
            const alcResourcePermissions = this.buildAclResourcePermissions(userAcls, userIdAndGroupsIds, userGroupsForUser);
            alcResourcePermissions.forEach(resourcePermission => allItemIds.add(resourcePermission.id));
            return {
                ...acc,
                [userId]: alcResourcePermissions,
            };
        }, {});

        const [allItems, itemsAncestors] = await Promise.all([
            this.repositoryServiceContract.findItems(
                { binderIds: Array.from(allItemIds) },
                { maxResults: allItemIds.size },
            ),
            this.repositoryServiceContract.getItemsAncestors(Array.from(allItemIds)),
        ]);
        const allItemIdsSet = allItems.reduce((acc, i) =>
            acc.set(i.id, i), new Map<string, DocumentCollection | Binder>()
        );

        const userAccessPerUser = userIds.reduce((acc, userId) => {
            const resourcePermissions = alcResourcePermissionsPerUser[userId];
            return {
                ...acc,
                [userId]: resourcePermissions.map(resourcePermission => {
                    const item = allItemIdsSet.get(resourcePermission.id);
                    return {
                        itemId: resourcePermission.id,
                        itemKind: item["kind"] || "document",
                        itemTitle: extractTitle(item),
                        itemLink: this.findItemLink(item, itemsAncestors),
                        role: resourcePermission.role,
                        groups: resourcePermission.groups,
                        restrictionSet: resourcePermission.restrictionSet,
                    }
                })
            }
        }, {});
        if (includePublicAdvertised) {
            const publicPermissionMaps = await this.authorizationServiceContract.findPublicResourceGroups(ResourceType.DOCUMENT, [PermissionName.VIEW], [accountId]);
            const publicItemIds = publicPermissionMaps.reduce<string[]>((acc, pMap) => {
                return acc.concat(
                    pMap.resources.reduce((innerAcc, resourceGroup) => innerAcc.concat(resourceGroup.ids), [] as string[])
                )
            }, []);

            const advertizedItems = await this.repositoryServiceContract.findItems({ ids: publicItemIds, accountId, showInOverview: true }, { maxResults: publicItemIds.length });
            userAccessPerUser["publicAdvertised"] = advertizedItems.map(item => ({
                itemId: item.id,
                itemKind: item["kind"] || "document",
                itemTitle: extractTitle(item),
            }));
        }
        return userAccessPerUser;
    }

    async listUserAccess(accountId: string, userId: string): Promise<UserAccess[]> {
        const userAccessPerUser = await this.listUsersAccess(accountId, [userId]);
        return userAccessPerUser[userId];
    }

    async deleteUser(userId: string): Promise<void> {
        await this.userRepository.deleteUser(new UserIdentifier(userId));
        await this.notificationServiceClient.deleteNotificationTargets(userId);
    }

    private buildAclResourcePermissions(
        acls: Acl[],
        ids: string[],
        userGroups: clientContract.Usergroup[],
    ): AclResourcePermission[] {
        return acls.reduce<AclResourcePermission[]>((all, acl) => {
            const assignee = this.findAclAssigneeById(acl, ids);
            const groups = assignee?.type === AssigneeType.USERGROUP ?
                this.userGroupsNamesForAssignee(userGroups, assignee) :
                "";
            acl.rules.forEach(rule => rule.resource.ids.forEach(id => {
                all.push({
                    id,
                    role: acl.roleId,
                    groups,
                    order: rule.permissions ? rule.permissions.length : 0,
                    restrictionSet: acl.restrictionSet,
                });
            }));
            return all;
        }, []).sort(this.sortResourcesPermissions);
    }

    private userGroupsNamesForAssignee(userGroups: clientContract.Usergroup[], assignee: AssigneeGroup): string {
        return assignee.ids.reduce<string[]>((groups, id) => {
            const userGroup = userGroups.find(group => group.id === id);
            return userGroup ? [...groups, userGroup.name] : groups;
        }, []).join(", ");
    }

    private findItemLink(item, ancestors) {
        const link = ancestors[item.id].reduce((link, anc) => `${anc}/${link}`, item.id)
        const path = (item["kind"] === "collection" ? "browse" : "documents");
        return `/${path}/${link}`;
    }

    private findAclAssigneeById(acl: Acl, ids: string[]): AssigneeGroup | undefined {
        return acl.assignees.find(assignee => (
            assignee.ids.some(assigneeId => ids.indexOf(assigneeId) > -1)
        ));
    }

    private sortResourcesPermissions(a: AclResourcePermission, b: AclResourcePermission): number {
        return b.order - a.order;
    }

    getUsersCreatedPerMonth(): Promise<clientContract.GlobalUserCreations> {
        return this.userRepository.getUsersCreatedPerMonth();
    }

    async getAccountIdsForGroups(groupIds: string[]): Promise<Record<string, string>> {
        const usergroups = await this.usergroupRepository.getUsergroupsById(groupIds.map(id => new UsergroupIdentifier(id)));
        return usergroups.reduce<Record<string, string>>((acc, usergroup) => {
            acc[usergroup.group.id.value()] = usergroup.group.accountId;
            return acc;
        }, {});
    }

    async createUserWithCredentials(
        login: string,
        displayName: string,
        clearTextPassword: string,
        accountId: string
    ): Promise<clientContract.User> {
        const loginObject = Login.from(login);
        const available = await this.userRepository.isLoginAvailable(loginObject);
        if (!available) {
            throw new LoginNotAvailable(login.toLowerCase());
        }
        const user = User.create({ login: loginObject, displayName, creationMethod: UserCreationMethod.EDITOR });
        const savedUser = await this.userRepository.saveUser(user);
        await Promise.all([
            this.credentialServiceContract.createCredential(
                savedUser.id.value(),
                savedUser.login.value(),
                clearTextPassword,
            ),
            this.accountServiceContract.addMember(
                accountId,
                savedUser.id.value(),
                ManageMemberTrigger.EDITOR,
                true,
            )
        ]);
        return toClientUser(savedUser);
    }

    async createHubspotIdentifyToken(userId?: string): Promise<{ token: string, email: string }> {
        if (!userId) throw new Unauthorized("User required");

        const apiToken = this.config.getString("hubspot.apiToken").getOrElse(null);
        const user = await this.userRepository.getUser(new UserIdentifier(userId));
        const hubspotClient = new HubspotClient({
            accessToken: apiToken
        });
        const { token } = await hubspotClient.conversations.visitorIdentification.generateApi.generateToken({
            email: user.login.value(),
            firstName: user.firstName ?? user.displayName,
            lastName: user.lastName,
        });

        return {
            token: token,
            email: user.login.value(),
        }
    }

    getMockedEmails(targetEmail: string): Promise<clientContract.MailMessage[]> {
        if (!(this.mailer instanceof MockedUserMailer)) {
            throw new Error("Mailer is not being mocked.");
        }
        return this.mailer.getSentEmails(targetEmail);
    }

    async syncEntraGroupMembers(accountId: string, options: clientContract.SyncEntraGroupMembersOptions): Promise<void> {
        const account = await this.accountServiceContract.getAccount(accountId);
        const settings = await this.accountServiceContract.getAccountSettings(accountId);
        const validationErrors = validateSSOAccountSettingsForSyncEntraJob(settings.sso.saml);

        if (validationErrors.length) {
            this.logger.warn(`SSO settings for account ${accountId} are not valid for Entra group sync: ${validationErrors.join(", ")}`, "syncEntraGroupMembers");
            return;
        }

        await syncEntraGroupMembers(
            account,
            settings,
            this.logger,
            {
                userRepository: this.userRepository,
                userTagRepository: this.userTagRepository,
                samlSSOConfig: await SAMLSSOConfig.fromConfig(this.config, "user-service"),
                userServiceClient: this,
                credentialServiceClient: this.credentialServiceContract,
                accountServiceClient: this.accountServiceContract,
            },
            options,
        );
    }
}

export class UserServiceFactory {

    private userRepositoryFactory: MongoUserRepositoryFactory;
    private userPreferencesRepositoryFactory: MongoPreferenceRepositoryFactory;
    private usergroupRepositoryFactory: MongoUsergroupRepositoryFactory;
    private userImportActionRepositoryFactory: MongoUserImportActionRepositoryFactory;
    private whitelistedEmailRepositoryFactory: MongoWhitelistedEmailRepositoryFactory;
    private scriptRunStatRepositoryFactory: MongoScriptRunStatRepositoryFactory;
    private termsAcceptanceRepositoryFactory: MongoTermsAcceptanceRepositoryFactory;
    private userTagRepositoryFactory: MongoUserTagRepositoryFactory;
    private deviceTargetUserLinkRepositoryFactory: MongoDeviceTargetUserLinkRepositoryFactory;

    build(logger: Logger): UserService {
        const userRepo = this.userRepositoryFactory.build(logger);
        const preferenceRepo = this.userPreferencesRepositoryFactory.build(logger);
        const usergroupRepo: UsergroupRepository = this.usergroupRepositoryFactory.build(logger);
        const userImportActionRepo: UserImportActionRepository = this.userImportActionRepositoryFactory.build(logger);
        const whitelistedEmailRepo: WhitelistedEmailRepository = this.whitelistedEmailRepositoryFactory.build(logger);
        const scriptRunStatRepo: ScriptRunStatRepository = this.scriptRunStatRepositoryFactory.build(logger);
        const termsAcceptanceRepo: TermsAcceptanceRepository = this.termsAcceptanceRepositoryFactory.build(logger);
        const userTagRepo: IUserTagRepository = this.userTagRepositoryFactory.build(logger);
        const deviceTargetUserLinkRepo: DeviceTargetUserLinkRepository = this.deviceTargetUserLinkRepositoryFactory.build(logger);

        return new UserService(
            userRepo, preferenceRepo,
            usergroupRepo,
            userImportActionRepo,
            whitelistedEmailRepo,
            scriptRunStatRepo,
            termsAcceptanceRepo,
            userTagRepo,
            deviceTargetUserLinkRepo,
            this.accountServiceContract,
            this.credentialServiceContract,
            this.routingServiceContract,
            this.authorizationServiceContract(logger),
            this.repositoryServiceContract,
            this.notificationClient,
            this.mailer,
            this.manualtoLocation,
            this.editorLocation,
            logger,
            this.config,
            this.launchDarkly,
        );
    }

    constructor(
        userCollectionConfig: CollectionConfig,
        preferenceCollectionConfig: CollectionConfig,
        usergroupCollectionConfig: CollectionConfig,
        userImportActionCollectionConfig: CollectionConfig,
        whitelistedEmailsCollectionConfig: CollectionConfig,
        scriptRunStatCollectionConfig: CollectionConfig,
        termsAcceptanceCollectionConfig: CollectionConfig,
        userTagCollectionConfig: CollectionConfig,
        deviceTargetUserLinkCollectionConfig: CollectionConfig,
        private readonly accountServiceContract: AccountServiceContract,
        private readonly credentialServiceContract: CredentialServiceContract,
        private readonly routingServiceContract: RoutingServiceContract,
        private readonly authorizationServiceContract: (logger?: Logger) => AuthorizationServiceContract,
        private readonly repositoryServiceContract: BindersRepositoryServiceContract,
        private readonly notificationClient: NotificationServiceClient,
        private readonly mailer: Mailer,
        private readonly manualtoLocation: string,
        private readonly editorLocation: string,
        logger: Logger,
        private readonly config: Config,
        private readonly launchDarkly: LaunchDarklyService,
    ) {
        this.userRepositoryFactory = new MongoUserRepositoryFactory(userCollectionConfig, logger);
        this.userPreferencesRepositoryFactory = new MongoPreferenceRepositoryFactory(preferenceCollectionConfig, logger);
        this.usergroupRepositoryFactory = new MongoUsergroupRepositoryFactory(usergroupCollectionConfig, logger);
        this.userImportActionRepositoryFactory = new MongoUserImportActionRepositoryFactory(userImportActionCollectionConfig, logger);
        this.whitelistedEmailRepositoryFactory = new MongoWhitelistedEmailRepositoryFactory(whitelistedEmailsCollectionConfig, logger);
        this.scriptRunStatRepositoryFactory = new MongoScriptRunStatRepositoryFactory(scriptRunStatCollectionConfig, logger);
        this.termsAcceptanceRepositoryFactory = new MongoTermsAcceptanceRepositoryFactory(termsAcceptanceCollectionConfig, logger);
        this.userTagRepositoryFactory = new MongoUserTagRepositoryFactory(userTagCollectionConfig, logger);
        this.deviceTargetUserLinkRepositoryFactory = new MongoDeviceTargetUserLinkRepositoryFactory(deviceTargetUserLinkCollectionConfig, logger);
    }

    static fromConfig(config: Config): Promise<UserServiceFactory> {
        const loginOption = getMongoLogin("user_service");
        const topLevelLogger = LoggerBuilder.fromConfig(config);

        const mailerPromise = shouldServiceBeMocked("mailer") ?
            Promise.resolve(new MockedUserMailer()) :
            UserMailgunMailer.fromConfig(config);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return Promise.all<any>([
            CollectionConfig.promiseFromConfig(config, "users", loginOption),
            CollectionConfig.promiseFromConfig(config, "userPreferences", loginOption),
            CollectionConfig.promiseFromConfig(config, "usergroups", loginOption),
            CollectionConfig.promiseFromConfig(config, "userImportActions", loginOption),
            CollectionConfig.promiseFromConfig(config, "whitelistedEmails", loginOption),
            CollectionConfig.promiseFromConfig(config, "scriptRunStats", loginOption),
            CollectionConfig.promiseFromConfig(config, "termsAcceptance", loginOption),
            CollectionConfig.promiseFromConfig(config, "userTags", loginOption),
            CollectionConfig.promiseFromConfig(config, "deviceTargetUserLinks", loginOption),
            BackendAccountServiceClient.fromConfig(config, "user-service"),
            BackendCredentialServiceClient.fromConfig(config, "user-service"),
            BackendRoutingServiceClient.fromConfig(config, "user-service"),
            BackendRepoServiceClient.fromConfig(config, "user-service"),
            mailerPromise,
            BackendAuthorizationServiceClient.createBuilderFromConfig(config, "user-service"),
            BackendNotificationServiceClient.fromConfig(config, "user-service", null),
            getOrCreateLaunchDarklyService(config),
        ]).then(([
            userCollectionConfig,
            userPreferencesCollectionConfig,
            usergroupCollectionConfig,
            userImportActionCollectionConfig,
            whitelistedEmailsCollectionConfig,
            scriptRunStatCollectionConfig,
            termsAcceptanceCollectionConfig,
            userTagCollectionConfig,
            deviceTargetUserLinkCollectionConfig,
            accountClient,
            credentialClient,
            routingClient,
            repositoryClient,
            mailer,
            authorizationClientBuilder,
            notificationClient,
            launchDarkly,
        ]) => {
            const manualtoLocation = isProduction() ? undefined : config.getString("services.manualto.externalLocation").get();
            const editorLocation = isProduction() ? undefined : config.getString("services.editor.externalLocation").get();

            return new UserServiceFactory(
                userCollectionConfig,
                userPreferencesCollectionConfig,
                usergroupCollectionConfig,
                userImportActionCollectionConfig,
                whitelistedEmailsCollectionConfig,
                scriptRunStatCollectionConfig,
                termsAcceptanceCollectionConfig,
                userTagCollectionConfig,
                deviceTargetUserLinkCollectionConfig,
                accountClient,
                credentialClient,
                routingClient,
                authorizationClientBuilder,
                repositoryClient,
                notificationClient,
                mailer,
                manualtoLocation,
                editorLocation,
                topLevelLogger,
                config,
                launchDarkly,
            );
        });
    }
}

function isManualToE2eLogin(login: string): boolean {
    return login === "e2e+123@manual.to";
}
