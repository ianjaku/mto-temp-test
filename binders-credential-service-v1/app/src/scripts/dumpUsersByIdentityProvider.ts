/* eslint-disable no-console */
import {
    BackendAccountServiceClient,
    BackendUserServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import {
    MongoSessionRepository,
    MongoSessionRepositoryFactory
} from "../credentialservice/repositories/sessionRepository";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders"
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging"
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client"
import { main } from "@binders/binders-service-common/lib/util/process"
import { writeFile } from "fs/promises";

/*
* This script will dump an aggregated view of logins by identity provider for a given account.
* Requested by Bekaert Deslee in October 2024
* Once this information is available elsewhere, this script can be removed.
*/
function getCutoffTimestamp(daysAgo?: number) {
    if (!daysAgo) {
        return 0;
    }
    const now = Date.now();
    return now - daysAgo * 24 * 3600 * 1000;
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
    const sessionDataPoints = await repo.groupByIdentityProvider(account.members, new Date(getCutoffTimestamp(daysAgo)));
    const userClient = await BackendUserServiceClient.fromConfig(config, SCRIPT_NAME);
    const rows = ["login,identityProvider,count,last"];
    for (const sessionDataPoint of sessionDataPoints) {
        const login = await getLoginForUser(sessionDataPoint.userId, userClient);
        const row = `${login},${sessionDataPoint.identityProvider},${sessionDataPoint.count},${sessionDataPoint.last.toISOString()}`;
        rows.push(row);
    }
    await writeFile(getFileName(account.name, daysAgo), rows.join("\n"));
})