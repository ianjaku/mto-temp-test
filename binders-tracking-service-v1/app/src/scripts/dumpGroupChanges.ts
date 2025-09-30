import {
    AuditLogType,
    IUserGroupAuditLogData,
    UserGroupActionType
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { AuditLogRepositoryFactory } from "../trackingservice/repositories/auditLogRepository";
import {
    BackendUserServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import { main } from "@binders/binders-service-common/lib/util/process";
import { writeFile } from "fs/promises";

const SCRIPT_NAME = "dumpGroupChanges";
const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config, SCRIPT_NAME);

const ACCOUNT_ID = "aid-fc8f8974-e7b6-40ca-a41b-36d01be75369";

async function getRepository() {
    const repoFactory = await AuditLogRepositoryFactory.fromConfig(config, logger);
    return repoFactory.build(logger);
}

const DEBUG = process.env.DEBUG;

function log(message: string) {
    if (DEBUG) {
        logger.info(message, SCRIPT_NAME);
    }
}
const userGroups = {};
async function getUsergroup(client: UserServiceClient, accountId: string, gid: string) {
    if (!gid) {
        return "";
    }
    if (!userGroups[gid]) {
        log(`Fetching groups for account ${accountId}`);
        const accountGroups = await client.getGroups(accountId);
        for (const accountGroup of accountGroups) {
            log(`Adding group ${accountGroup.id} ${accountGroup.name}`);
            userGroups[accountGroup.id] = accountGroup.name;
        }
    }
    return userGroups[gid] || gid;
}

const users = {};

async function getUser(client: UserServiceClient, uid: string) {
    if (!uid) {
        return "";
    }
    // eg. uid-testing
    if (uid.length < 16) {
        return uid;
    }
    if (!users[uid]) {
        try {
            log(`Fetching user ${uid}`);
            users[uid] = await client.getUser(uid);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error(e);
        }
    }
    return users[uid]?.login || uid;
}

main(async () => {
    const repo = await getRepository();
    const entries = await repo.findLogs({
        accountId: ACCOUNT_ID,
        logType: AuditLogType.USER_GROUP_UPDATE,
    });
    const userServiceClient = await BackendUserServiceClient.fromConfig(config, SCRIPT_NAME);
    const lines = ["Date,Action,UserGroup,User"];
    for (const entry of entries) {
        const data = entry.data as IUserGroupAuditLogData;
        const group = await getUsergroup(userServiceClient, entry.accountId.value(), data.userGroupId);
        const user = await getUser(userServiceClient, data.userId);
        const line = `${entry.timestamp.toISOString()},${UserGroupActionType[data.userGroupAction]},${group},${user}`;
        lines.push(line);
    }
    await writeFile("/tmp/group_changes.csv", lines.join("\n"));
});