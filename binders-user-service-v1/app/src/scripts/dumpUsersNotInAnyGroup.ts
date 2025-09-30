/* eslint-disable no-console */
import {
    BackendAccountServiceClient,
    BackendUserServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders"

const getOptions = () => {
    const accountId = process.argv[2];
    if (!accountId) {
        console.error("Please provide an accountId.");
        process.exit(1);
    }
    return {
        accountId
    }
}

const getDeps = async () => {
    const config = BindersConfig.get();
    const userServiceClient = await BackendUserServiceClient.fromConfig(config, "export-usergroups-to-csv");
    const accountServiceClient = await BackendAccountServiceClient.fromConfig(config, "export-usergroups-to-csv");
    return {
        accountServiceClient,
        userServiceClient,
    };
}

const doIt = async () => {
    const { accountServiceClient, userServiceClient } = await getDeps();
    const { accountId } = getOptions();
    const [ account, allGroups ] = await Promise.all([
        accountServiceClient.getAccount(accountId),
        userServiceClient.getGroups(accountId)
    ]);
    const validGroupIds = allGroups
        .filter(g => !g.isAutoManaged)
        .map(g => g.id);
    const memberMap = await userServiceClient.multiGetGroupMemberIds(accountId, validGroupIds);
    const userIdSet = new Set<string>();
    for (const groupId in memberMap) {
        const members = memberMap[groupId];
        for (const member of members) {
            userIdSet.add(member);
        }
    }
    const notInAnyGroup = [];
    for (const userId of account.members) {
        if (!userIdSet.has(userId)) {
            notInAnyGroup.push(userId);
        }
    }
    const users = await userServiceClient.findUserDetailsForIds(notInAnyGroup);
    console.log("ID,LOGIN");
    for (const user of users) {
        console.log(`${user.id},${user.login}`);
    }
}

doIt()
    .then(
        () => {
            process.exit(0);
        },
        err => {
            console.error(err);
            process.exit(1);
        }
    )