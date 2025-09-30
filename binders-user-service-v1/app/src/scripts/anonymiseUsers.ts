import { BackendAccountServiceClient, BackendCredentialServiceClient, BackendUserServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { main } from "@binders/binders-service-common/lib/util/process";


/* eslint-disable no-console */

const SCRIPT_NAME = "anonymise-users";

const { log } = console;

const getOptions = () => {
    if (process.argv.length !== 3) {
        console.error(`Usage: node ${__filename} <ACCOUNT_OR_USER_ID>`);
        process.exit(1);
    }
    return {
        id: process.argv[2]
    };
};

async function getAllUniqueMembers(accountId: string): Promise<string[]> {
    const config = BindersConfig.get();
    const accountService = await BackendAccountServiceClient.fromConfig(config, SCRIPT_NAME);
    const { members } = await accountService.getAccount(accountId);
    const result = [];
    for (const member of members) {
        const userAccounts = await accountService.getAccountsForUser(member);
        const nonAnonymisedAccounts = userAccounts.filter(a => !a.isAnonymised);
        if (nonAnonymisedAccounts.length == 1) {
            result.push(member);
        }
    }
    return result;
}

async function anonymiseUsers (userIds: string[]): Promise<void> {
    const config = BindersConfig.get();
    const userService = await BackendUserServiceClient.fromConfig(config, SCRIPT_NAME);
    const credentialService = await BackendCredentialServiceClient.fromConfig(config, SCRIPT_NAME);
    for (const userId of userIds) {
        log(`Anonymising user ${userId}`);
        // email -> ${userId}@anonymous.manual.to
        // name -> userId
        // firstname / lastname -> ""
        const user = await userService.getUser(userId);
        user.login = `${userId}@anonymous.manual.to`;
        user.displayName = userId;
        user.firstName = "";
        user.lastName = "";
        await userService.updateUser(user);
        await credentialService.anonymizeCredential(userId);
    }
}

async function setIsAnonymised(accountId: string) {
    const config = BindersConfig.get();
    const accountService = await BackendAccountServiceClient.fromConfig(config, SCRIPT_NAME);
    console.log(await accountService.setAnonymised(accountId, true));
}

main(async () => {
    const { id } = getOptions();
    if (id.startsWith("aid-")) {
        const accountId = id;
        const users = await getAllUniqueMembers(accountId);
        await anonymiseUsers(users);
        await setIsAnonymised(accountId);
        return;
    }
    if (id.startsWith("uid-")) {
        await anonymiseUsers([id]);
        return;
    }
    throw new Error("Not a user or account id");
});

