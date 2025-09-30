/* eslint-disable no-console */
import * as fs from "fs";
import * as path from "path";
import { BackendAccountServiceClient, BackendUserServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { Event, IEventDAO } from "../trackingservice/models/event";
import { EventRepository, SingleTrackingRepositoryFactory } from "../trackingservice/repositories/eventRepository";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import { SearchOptions as BatchProcessSearchOptions } from "@binders/binders-service-common/lib/mongo/repository";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { EventType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import { fmtDateIso8601TZ } from "@binders/client/lib/util/date";
import { isDate } from "date-fns";
import { tmpdir } from "os";

const config = BindersConfig.get();
const loginOption = getMongoLogin("tracking_service");
const logger = LoggerBuilder.fromConfig(config);

const FLUSH_EVERY_N_PERCENT = 5;

const getOptions = () => {
    const { argv } = process;
    const hasOptions = argv.length > 2;
    const isTest = hasOptions ? argv.indexOf("--test") > -1 : false;
    return {
        isTest,
    };
};

const getEventsRepository = async () => {
    const collectionConfig = await CollectionConfig.promiseFromConfig(
        config,
        "tracking",
        loginOption,
    );
    const trackingRepositoryFactory = new SingleTrackingRepositoryFactory(collectionConfig, logger);
    const trackingRepository = trackingRepositoryFactory.build(logger);
    return trackingRepository;
}

type UserMap = Map<string, string>;

const getValidTimestamp = (event: Event | IEventDAO) => {
    if (event.timestampLogged && isDate(event.timestampLogged)) {
        return event.timestampLogged;
    } else {
        return event.timestamp;
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function appendToFile(fileHandler: any, content: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        fileHandler.write(content, (err) => {
            if (err) {
                console.log("ERROR", err);
                reject(err);
                return;
            }
            resolve();
        });
    });
}

// date userId

let flushCount = 0;

async function flush(results: Map<string, UserMap>) {
    const csv = Array.from(results.keys()).reduce((reduced, timeString) => {
        const userMap = results.get(timeString);
        for (const userId of Array.from(userMap.keys())) {
            reduced += `${userMap.get(userId)}\n`;
        }
        return reduced;
    }, "");
    const tmpFile = path.join(tmpdir(), "users-online.csv");
    const openFlag = flushCount === 0 ? "w" : "a";
    const handler = fs.createWriteStream(tmpFile, { flags: openFlag });
    const toWrite = flushCount === 0 ? `user_id,user_login,date,reader,editor,account_id,account_name\n${csv}` : csv;
    flushCount++;
    await appendToFile(handler, toWrite);
}

async function maybeFlush(perc: number, results: Map<string, UserMap>) {
    if (perc % FLUSH_EVERY_N_PERCENT === 0) {
        await flush(results);
        return true;
    }
    return false;
}

const logins = new Map<string, string>();
const accountNames = new Map<string, string>();
async function getUserLogin(userId: string, userClient: UserServiceClient) {
    if (!userId || userId === "public") {
        return "";
    }
    const memoizedLogin = logins.get(userId);
    if (!memoizedLogin) {
        try {
            const user = await userClient.getUser(userId);
            logins.set(userId, user.login);
            return user.login;
        } catch (e) {
            console.log(`error in getting user with id ${userId}: ${e.message}`);
            return "";
        }
    }
    return memoizedLogin;
}
async function getAccountName(accountId: string, accountClient: AccountServiceClient) {
    if (!accountId) {
        return "";
    }
    const memoizedAccountName = logins.get(accountId);
    if (!memoizedAccountName) {
        try {
            const account = await accountClient.getAccount(accountId);
            accountNames.set(accountId, account.name);
            return account.name;
        } catch (e) {
            console.log(`error in getting account with id ${accountId}: ${e.message}`);
            return "";
        }
    }
    return memoizedAccountName;
}

async function doIt(eventsRepo: EventRepository): Promise<void> {
    const eventFilter = {
        eventTypes: [EventType.USER_IS_ONLINE]
    };

    let eventsProcessed = 0;

    const searchOptions: BatchProcessSearchOptions = { orderByField: "_id", sortOrder: "ascending" };

    const results = new Map<string, UserMap>();

    const eventsToProcessCount = await eventsRepo.countEvents(eventFilter);
    console.log(`${eventsToProcessCount} user-is-online events to process; GO`);

    const userClient = await BackendUserServiceClient.fromConfig(config, "generate-user-online");
    const accountClient = await BackendAccountServiceClient.fromConfig(config, "generate-user-online");

    let percDone = 0;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async function doProcessEvents(eventDAOs: IEventDAO[], i: number) {
        if (!eventDAOs.length) {
            return;
        }
        for (const eventDAO of eventDAOs) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: { application }, account_id, user_id } = eventDAO as any;
            if (!user_id) {
                continue;
            }

            const ts = getValidTimestamp(eventDAO);
            const tsString = fmtDateIso8601TZ(new Date(ts));

            const userMap = results.get(tsString) || new Map<string, string>();
            const login = await getUserLogin(user_id, userClient);
            const accountName = await getAccountName(account_id, accountClient);
            const existingItem = userMap.get(user_id);
            let existingItemInReader = false;
            let existingItemInEditor = false;
            if (existingItem) {
                const existingItemParts = existingItem.split(",");
                existingItemInReader = existingItemParts[3] === "y";
                existingItemInEditor = existingItemParts[4] === "y";
            }

            const inReader = existingItemInReader || application === 1;
            const inEditor = existingItemInEditor || application === 0;
            userMap.set(user_id, `${user_id},${login},${tsString},${inReader ? "y" : "n"},${inEditor ? "y" : "n"},${account_id || ""},${accountName || ""}`);
            results.set(tsString, userMap);
        }
        eventsProcessed += eventDAOs.length;
        const perc = Math.round((eventsProcessed / eventsToProcessCount) * 100);
        if (perc !== percDone) {
            percDone = perc;
            console.log(`${percDone}%`);
            if ((await maybeFlush(percDone, results))) {
                results.clear();
            }
        }
        process.stdout.write(".");
    }
    await eventsRepo.batchProcessEvents(eventFilter, doProcessEvents, searchOptions);
    await flush(results);
}

(async () => {
    const eventsRepository = await getEventsRepository();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { isTest } = getOptions();
    await doIt(eventsRepository);



})();

