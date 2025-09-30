/* eslint-disable no-console */
import { BackendAccountServiceClient, BackendUserServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { UsergroupDetails } from "@binders/client/lib/clients/userservice/v1/contract";


const SCRIPT = "remove-unconfirmed-users";
const config = BindersConfig.get();
// ISS
const ACCOUNT_ID = "aid-1767f159-ca3e-48aa-961c-19d68f64ffca";
// Siemens
// const ACCOUNT_ID = "aid-f95adf13-0555-4a23-9724-efd8d1468487";
// const ACCOUNT_ID = "aid-0fb03b72-d6ed-4204-abbd-f64b8879b4a6";

const GROUP_NAME = "ISS Staff";
// const GROUP_NAME = "Non-designers";

async function getAccountServiceClient() {
    return BackendAccountServiceClient.fromConfig(config, SCRIPT);
}

async function getUserServiceClient() {
    return BackendUserServiceClient.fromConfig(config, SCRIPT);
}

async function getUsergroupDetails(accountId) {
    const client = await getUserServiceClient();
    const userGroups = await client.getGroups(accountId);
    return Promise.all(
        userGroups.map(usergroup => client.getGroupMembers(ACCOUNT_ID, usergroup.id, {maxResults: 100}))
    );
}
async function getGroupIds(accountId: string, groupName: string ): Promise<{toPick: UsergroupDetails, toSkip: UsergroupDetails[]}> {
    const userGroupDetails = await getUsergroupDetails(accountId);
    const toSkip: UsergroupDetails[] = [];
    let toPick: UsergroupDetails = undefined;
    for (let i = 0; i < userGroupDetails.length; i++) {
        const userGroup = userGroupDetails[i];
        if (userGroup.group.name === groupName) {
            if (toPick !== undefined) {
                throw new Error(`Found multiple usergroups with the same name: ${groupName}`);
            }
            toPick = userGroup;
        } else {
            toSkip.push(userGroup);
        }
    }
    if (toPick === undefined) {
        throw new Error(`Could not find usergroup with name ${groupName}`);
    }
    return {toPick, toSkip};
}

async function getAccountMembers(accountId: string): Promise<string[]> {
    const client = await getAccountServiceClient();
    const account = await client.getAccount(accountId);
    return account.members;
}

async function addGroupMember(accountId: string, groupId: string, userId: string) {
    const client = await getUserServiceClient();
    return client.addGroupMember(accountId, groupId, userId);
}

async function fixMembership(accountId: string, userId: string, toPick: UsergroupDetails, toSkip: UsergroupDetails[]) {
    console.log(`Checking user with id ${userId}`);
    const currentGroupOption = toSkip.find(
        groupDetails => groupDetails.members.filter(m => m.id === userId).length > 0
    );
    if (currentGroupOption !== undefined) {
        console.log(`Skipping, user is member of other group ${currentGroupOption.group.name}`);
        return;
    }
    if (toPick.members.find(m => m.id === userId)) {
        console.log("Skipping, user is member of target group");
        return;
    }
    return addGroupMember(accountId, toPick.group.id, userId);
}

async function fixMemberships(accountId: string, userIds: string[], toPick: UsergroupDetails, toSkip: UsergroupDetails[]) {
    return userIds.reduce( async (reduced, userId) => {
        await reduced;
        return fixMembership(accountId, userId, toPick, toSkip);
    }, Promise.resolve());
}

async function doIt() {
    const { toPick, toSkip } = await getGroupIds(ACCOUNT_ID, GROUP_NAME);
    const accountMembers = await getAccountMembers(ACCOUNT_ID);
    return fixMemberships(ACCOUNT_ID, accountMembers, toPick, toSkip);
}

doIt().then(
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
