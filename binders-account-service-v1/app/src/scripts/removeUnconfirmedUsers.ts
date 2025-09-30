/* eslint-disable no-console */
import { BackendAccountServiceClient, BackendUserServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ManageMemberTrigger } from "@binders/client/lib/clients/accountservice/v1/contract";

const SCRIPT = "remove-unconfirmed-users";
const config = BindersConfig.get();

const getOptions = () => {
    if (process.argv.length !== 3) {
        console.log(`Usage: node ${__filename} <ACCOUNTID>`);
        process.exit(1);
    }
    return {
        accountId: process.argv[2]
    };
};

async function getAccountServiceClient() {
    return BackendAccountServiceClient.fromConfig(config, SCRIPT);
}

async function getUserServiceClient() {
    return BackendUserServiceClient.fromConfig(config, SCRIPT);
}

async function getAccountMembers(accountId): Promise<string[]> {
    const client = await getAccountServiceClient();
    const account = await client.getAccount(accountId);
    return account.members;
}

async function filterConfirmed(userIds: string[]): Promise<string[]> {
    const client = await getUserServiceClient();
    const users = await client.findUserDetailsForIds(userIds);
    return users.filter(u => !u.lastOnline)
        .map(u => u.id);
}

async function slicedFilterConfirmed(userIds: string[]): Promise<string[]> {
    const BATCH_SIZE = 100;
    let combinedFiltered = [];
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
        const slice = userIds.slice(i, i + BATCH_SIZE);
        const filteredSlice = await filterConfirmed(slice);
        combinedFiltered = combinedFiltered.concat(filteredSlice);
    }
    return combinedFiltered;
}

async function cleanUsersFromAccount(accountId: string, memberIds: string[]) {
    let processed = 0;
    const totalToProcess = memberIds.length;
    const accountClient = await getAccountServiceClient();
    await memberIds.reduce( async (reduced, memberId) => {
        await reduced;
        await accountClient.removeMember(accountId, memberId, ManageMemberTrigger.SCRIPT);
        processed++;
        if (processed % 50 === 0) {
            console.log(`Progress: ${processed} / ${totalToProcess}`);
        }
    }, Promise.resolve());
}

async function doIt() {
    const options = getOptions();
    const accountId = options.accountId;
    const members = await getAccountMembers(accountId);
    console.log(`Got ${members.length} members in the account`);
    const filtered = await slicedFilterConfirmed(members);
    if (filtered.length === 0) {
        console.log("Nothing to remove.");
        return;
    }
    console.log(`Going to remove ${filtered.length} members.`);
    await cleanUsersFromAccount(accountId, filtered);
}

doIt()
    .then(
        () => {
            console.log("All done!");
            process.exit(0);
        },
        (error) => {
            console.error("!!!! Something went wrong");
            console.error(error);
            process.exit(1);
        }
    );

// tslint:enable:no-console
