import {
    Account,
    ManageMemberTrigger
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { AccountUserSpecs, UserGroupSpecs, UserSpecs } from "./contract";
import {
    BackendAccountServiceClient,
    BackendCredentialServiceClient,
    BackendRoutingServiceClient,
    BackendUserServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { User, Usergroup } from "@binders/client/lib/clients/userservice/v1/contract";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import {
    UnCachedBackendAuthorizationServiceClient
} from "@binders/binders-service-common/lib/authorization/backendclient";
import { bold } from "@binders/client/lib/util/cli";
import { deUniqueLogin } from "./helpers";
import { log } from "../../shared/logging";

const config = BindersConfig.get();
interface EnsureAccountResult {
    accountId: string;
    accountName: string;
    domain: string;
    users?: User[];
    groups?: Usergroup[];
}

export async function ensureFeatures(accountId: string, features: string[]): Promise<void> {
    const accountServiceClient = await BackendAccountServiceClient.fromConfig(config, "acceptance-testing-setup");
    if (features && features.length) {
        log(` -- Setting features ${features.map(bold).join(", ")}`);
        await accountServiceClient.setAccountFeatures(accountId, features, { doReplace: true });
    }
}

export async function ensureAccountAndUsers(accountUserSpecs: AccountUserSpecs): Promise<EnsureAccountResult> {
    const {
        account: { name: accountName, domain, members, usergroups }
    } = accountUserSpecs;
    const accountServiceClient = await BackendAccountServiceClient.fromConfig(config, "acceptance-testing-setup");
    const userServiceClient = await BackendUserServiceClient.fromConfig(config, "acceptance-testing-setup");
    const credentialServiceClient = await BackendCredentialServiceClient.fromConfig(config, "acceptance-testing-setup");
    const authorizationServiceClient = await UnCachedBackendAuthorizationServiceClient.fromConfig(config, "acceptance-testing-setup");
    const routingServiceClient = await BackendRoutingServiceClient.fromConfig(config, "acceptance-testing-setup");
    const loginDict = new Map<string, User>();
    const ensuredGroups: Usergroup[] = [];

    const ensureAccountData = async () => {
        const { account, isNew } = await ensureAccount();
        for (const member of (members || [])) {
            const user = await ensureUser(account, isNew, member);
            loginDict.set(deUniqueLogin(member.login), user);
        }
        for (const usergroup of (usergroups || [])) {
            const group = await ensureUsergroup(account, usergroup);
            ensuredGroups.push(group);
        }
        return account.id;
    }

    const ensureAccount = async () => {
        const existingAccountArr = await accountServiceClient.findAccounts({ name: accountName });
        if (existingAccountArr.length) {
            const [existingAccount] = existingAccountArr;
            return { account: existingAccount, isNew: false };
        }
        log(`creating account ${accountName}`);
        const account = await accountServiceClient.createAccount(accountName, "standard", "2080-09-01", "2080-09-01", 999);
        if (domain) {
            log(`linking domain ${domain}`);
            await routingServiceClient.setDomainsForAccount(account.id, [domain]);
        }
        return { account, isNew: true };
    }

    const getUserByLogin = async (login: string) => {
        let user;
        try {
            user = await userServiceClient.getUserByLogin(login);
        }
        catch (e) {
            if (e.message.indexOf("User could not be found") === -1) {
                throw e;
            }
        }
        return user;
    }

    const addAccountMember = async (accountId: string, userId: string, isAdmin?: boolean, skipDefaultPermissions?: boolean) => {
        await accountServiceClient.addMember(
            accountId,
            userId,
            ManageMemberTrigger.ACCEPTANCE_TEST,
            skipDefaultPermissions
        );
        if (isAdmin) {
            authorizationServiceClient.addAccountAdmin(accountId, userId);
        }
    }

    const ensureUser = async (account: Account, isNewAccount: boolean, userSpecs: UserSpecs): Promise<User> => {
        const { name: userName, firstName, lastName, login, password, isAdmin, skipDefaultPermissions } = userSpecs;
        const existingUser = await getUserByLogin(login);
        if (!existingUser) {
            // user doesn't exist, create and add to account
            log(`creating user ${login}`);
            const user = await userServiceClient.createUser(login, userName, firstName, lastName);
            await credentialServiceClient.createCredential(user.id, login, password);
            await addAccountMember(account.id, user.id, isAdmin, skipDefaultPermissions);
            return user;
        }
        if (!isNewAccount) {
            // user exists and account isn't new, test if user is already a member and add in case they aren't
            const { members } = account;
            if (members.indexOf(existingUser.id) === -1) {
                await addAccountMember(account.id, existingUser.id, isAdmin, skipDefaultPermissions);
            }
            return existingUser;
        }
        // user exists and account is new, just add the user as member
        await addAccountMember(account.id, existingUser.id, isAdmin);
        return existingUser;
    }

    const ensureUsergroup = async (account: Account, usergroupSpecs: UserGroupSpecs): Promise<Usergroup> => {
        const { name, memberLogins } = usergroupSpecs;
        const groups = await userServiceClient.multiAddGroupMembers(
            account.id,
            { names: [name] },
            memberLogins.map(login => loginDict.get(login).id),
            {
                createGroupIfDoesntExist: true,
            }
        );
        return groups?.length && groups[0];
    }

    const accountId = await ensureAccountData();
    const users = Array.from(loginDict.values());
    return { accountId, accountName, domain, users, groups: ensuredGroups };
}
