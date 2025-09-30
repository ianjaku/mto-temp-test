/* eslint-disable no-console */
import {
    ADMIN_ROLE_ID,
    CONTRIBUTOR_ROLE_ID,
    EDITOR_ROLE_ID,
    READER_ROLE_ID,
    REVIEWER_ROLE_ID
} from "@binders/binders-service-common/lib/authorization/role";
import {
    BackendAccountServiceClient,
    BackendUserServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import { Acl } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import {
    AuthorizationServiceClient
} from "@binders/client/lib/clients/authorizationservice/v1/client";
import {
    BackendAuthorizationServiceClient
} from "@binders/binders-service-common/lib/authorization/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import { writeFileSync } from "fs";


const config = BindersConfig.get();

const outFile = "/tmp/rolesPerAccount.csv";

// Note: accounts scoped to connected CRM customers

const getOptions = () => {
    if (process.argv.length < 3) {
        console.log(`Running for all pipedrive-connected accounts, to limit to a single account: node ${__filename} <ACCOUNTID>`);
        return { accountId: undefined };
    }
    const inclManualToUsers = process.argv.includes("--incl-mt");
    if (!inclManualToUsers) {
        console.log("Skipping manual.to users, to include them, append --incl-mt");
    }
    return {
        accountId: process.argv[2],
        inclManualToUsers,
    };
};

interface RoleOccurences {
    [role: string]: number;
}
interface RoleOccurencesPerAccount {
    [accountId: string]: RoleOccurences;
}

const SCRIPTNAME = "tallyRolesPerAccount";

const builtInRoles = {
    [ADMIN_ROLE_ID]: "admins",
    [EDITOR_ROLE_ID]: "editors",
    [REVIEWER_ROLE_ID]: "reviewers",
    [CONTRIBUTOR_ROLE_ID]: "contributors",
    [READER_ROLE_ID]: "readers",
};

function hasRole(userAndGroupIds: string[], roleId: string, acls: Acl[]): boolean {
    return acls.some(
        acl => acl.roleId === roleId &&
            acl.assignees.some(assignee => assignee.ids.some(id => userAndGroupIds.includes(id)))
    );
}

function getHighestRole(userAndGroupIds: string[], acls: Acl[]): string {
    for (const roleId of Object.keys(builtInRoles)) {
        if (hasRole(userAndGroupIds, roleId, acls)) {
            return builtInRoles[roleId]
        }
    }
    return undefined;
}

async function tallyRolesInAccount(
    account: Account,
    authorizationServiceClient: AuthorizationServiceClient,
    userServiceClient: UserServiceClient,
    inclManualToUsers: boolean,
    internalUserIds: string[],
): Promise<RoleOccurences> {
    console.log(`tallying roles in: ${account.name}...`);
    const accountAcls = await authorizationServiceClient.accountAcls(account.id);

    const allUserGroups = await userServiceClient.getGroups(account.id);
    const allUsergroupWithMembers = await userServiceClient.multiGetGroupMembers(account.id, allUserGroups.map(group => group.id));

    return account.members.reduce(async (accPromise, userId) => {

        if (!inclManualToUsers && internalUserIds.includes(userId)) {
            return accPromise;
        }

        const acc = await accPromise;
        const usergroups = allUsergroupWithMembers.filter(group => group.members.some(member => member.id === userId));
        const usergroupIds = usergroups.map(usergroup => usergroup.group.id);
        const userRole = getHighestRole([userId, ...usergroupIds], accountAcls);
        if (userRole) {
            acc[userRole] = (acc[userRole] || 0) + 1;
        }
        return acc;
    }, Promise.resolve({} as RoleOccurences));
}

async function getScopeAccounts(accountServiceClient: AccountServiceClient, accountId?: string) {
    if (accountId) {
        return [await accountServiceClient.getAccount(accountId)];
    }
    const customers = await accountServiceClient.listCustomers();
    const allAccounts = await accountServiceClient.listAccounts();
    const connectedCustomerAccountIds = customers.reduce((acc, customer) => {
        return [...acc, ...customer.accountIds];
    }, []);
    return connectedCustomerAccountIds
        .map((accountId) => allAccounts.find((account) => account.id === accountId));
}

const doIt = async () => {
    const accountServiceClient = await BackendAccountServiceClient.fromConfig(config, SCRIPTNAME);
    const authorizationServiceClient = await BackendAuthorizationServiceClient.fromConfig(config, SCRIPTNAME /*, { skipCache: true }*/);
    const userServiceClient = await BackendUserServiceClient.fromConfig(config, SCRIPTNAME);

    const { accountId, inclManualToUsers } = getOptions();

    const accounts = await getScopeAccounts(accountServiceClient, accountId);

    const internalUsers = !inclManualToUsers && await userServiceClient.searchUsers(
        {
            login: "^.*@manual.to$",
        },
        { maxResults: 99999 },
        accounts.map(account => account.id),
    );

    const resultMap = await accounts.reduce(async (accPromise, account) => {
        const acc = await accPromise;
        return {
            ...acc,
            [account.id]: await tallyRolesInAccount(
                account,
                authorizationServiceClient,
                userServiceClient,
                inclManualToUsers,
                (internalUsers?.hits?.map(user => user.id)) || undefined,
            ),
        };
    }, Promise.resolve({} as RoleOccurencesPerAccount));

    const csvHeaders = "accountid,accountname,admins,editors,reviewers,contributors,readers";
    const csv = Object.keys(resultMap).reduce((acc, accountId) => {
        const entry = resultMap[accountId];
        const accountName = accounts.find(account => account.id === accountId).name;
        return `${acc}\n${accountId},${accountName},${entry.admins || 0},${entry.editors || 0},${entry.reviewers || 0},${entry.contributors || 0},${entry.readers || 0}`;
    }, csvHeaders);

    writeFileSync(outFile, csv);
    console.log(`file written to: ${outFile}`);
}

doIt().then(
    () => {
        console.log("All done!");
        process.exit(0);
    },
    (err) => {
        console.error("Something went wrong!");
        console.error(err);
        process.exit(1);
    }
)