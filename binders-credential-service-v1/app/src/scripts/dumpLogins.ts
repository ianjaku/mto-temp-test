/* eslint-disable no-console */
import {
    BackendAccountServiceClient,
    BackendUserServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import {
    MongoSessionRepository,
    MongoSessionRepositoryFactory
} from "../credentialservice/repositories/sessionRepository";
import { AuthenticatedSession } from "@binders/client/lib/clients/model"
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders"
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging"
import { UserIdentifier } from "@binders/binders-service-common/lib/authentication/identity"
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client"
import { info } from "@binders/client/lib/util/cli"
import { main } from "@binders/binders-service-common/lib/util/process"
import { writeFileSync } from "fs"

function getCutoffTimestamp(daysAgo?: number) {
    if (!daysAgo) {
        return 0;
    }
    const now = new Date().getTime();
    return now - daysAgo * 24 * 3600 * 1000;
}

async function getSessionsForUsers(userIds: string[], repo: MongoSessionRepository, daysAgo?: number): Promise<AuthenticatedSession[]> {
    const result = [];
    const cutOffTimestamp = getCutoffTimestamp(daysAgo);
    const total = userIds.length;
    let iteration = 1;
    for (const userId of userIds) {
        if (iteration % 100 === 0) {
            info(`Processing user ${iteration} of ${total}`);
        }
        const userSessions = await repo.getSessions(new UserIdentifier(userId));
        userSessions
            .filter( ses => {
                const sessionStartTimeStamp = new Date(ses.sessionStart).getTime();
                return sessionStartTimeStamp > cutOffTimestamp;
            })
            .forEach(ses => result.push(ses));
        iteration++;
    }
    return result;
}

function getOptions() {
    if (process.argv.length > 4 || process.argv.length < 3) {
        console.error(`Usage: node ${__filename} <ACCOUNTID> <DAYS_AGO>`);
        process.exit(1);
    }
    return {
        accountId: process.argv[2],
        daysAgo: process.argv[3] ? Number.parseInt(process.argv[3], 10) : undefined
    };
}

const userCache = {};
async function getLoginForUser(userId: string, client: UserServiceClient): Promise<string> {
    if (! (userId in userCache)) {
        const { login } = await client.getUser(userId);
        userCache[userId] = login;
    }
    return userCache[userId];
}

const SCRIPT_NAME = "dump-logins";

function getFileName(accountName: string, daysAgo?: number) {
    const parts = [
        "logins",
        accountName
    ];
    if (daysAgo) {
        parts.push("last", daysAgo.toString(), "days");
    }
    return `/tmp/${parts.join("-")}.csv`;
}

main(async() => {
    const { accountId, daysAgo } = getOptions();
    const config = BindersConfig.get();
    const logger = LoggerBuilder.fromConfig(config, SCRIPT_NAME);
    const factory: MongoSessionRepositoryFactory = await MongoSessionRepositoryFactory.fromConfig(config, logger);
    const repo: MongoSessionRepository = factory.build(logger);
    const accountClient = await BackendAccountServiceClient.fromConfig(config, SCRIPT_NAME);
    const account = await accountClient.getAccount(accountId);
    const sessions = await getSessionsForUsers(account.members, repo, daysAgo);
    const cmp = (left, right) => {
        return ( (left.sessionStart?.getTime() || 0) - (right.sessionStart?.getTime() || 0) );
    }
    sessions.sort(cmp);
    const userClient = await BackendUserServiceClient.fromConfig(config, SCRIPT_NAME);
    const rows = ["User,When,IdentityProvider"];
    for (const session of sessions) {
        const email = await getLoginForUser(session.userId, userClient);
        rows.push(`${email},${session.sessionStart.toISOString()},${session.identityProvider}`);
    }
    const filename = getFileName(account.name, daysAgo);
    writeFileSync(filename, rows.join("\n"));
    console.log(`File saved at ${filename}`);
})