/* eslint-disable no-console */
import * as readline from "readline";
import {
    AggregatorType,
    ChooseLanguageData,
    EventType,
    IUserAction,
    UserActionType
} from  "@binders/client/lib/clients/trackingservice/v1/contract";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import { Aggregation } from "../trackingservice/models/aggregation";
import {
    BackendAccountServiceClient
} from  "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import {
    ElasticUserActionsRepository
} from  "../trackingservice/repositories/userActionsRepository";
import { IEventDAO } from "../trackingservice/models/event";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import {
    MongoAggregationsRepositoryFactory
} from  "../trackingservice/repositories/aggregationsRepository";
import { TrackingRepositoryFactory } from "../trackingservice/repositories/eventRepository";
import { pick } from "ramda";

const config = BindersConfig.get();
const loginOption = getMongoLogin("tracking_service");
const logger = LoggerBuilder.fromConfig(config);

const SCRIPT_NAME = "backpopulateChooseLanguageUserActions"

const getOptions = () => {
    const accountId = process.argv.length > 2 && process.argv[2];
    if (!accountId) {
        console.log("Running for all accounts. To run for a single account, run `backpopulateChooseLanguageUserActions.js <accountId>`");
    }
    return {
        accountId,
    };
};

async function getAccounts(): Promise<Account[]> {
    const accountServiceClient = await BackendAccountServiceClient.fromConfig(config, SCRIPT_NAME);
    const { accountId } = getOptions();
    if (accountId) {
        return [await accountServiceClient.getAccount(accountId)];
    }
    return await accountServiceClient.listAccounts();
}

const getEventsRepository = async () => {
    const trackingRepositoryFactory = await TrackingRepositoryFactory.fromConfig(config, logger)
    const trackingRepository = trackingRepositoryFactory.build(logger);
    return trackingRepository;
}

const getAggregationsRepo = async () => {
    const collectionConfig = await CollectionConfig.promiseFromConfig(
        config,
        "aggregations",
        loginOption,
    );
    const aggregationsRepositoryFactory = new MongoAggregationsRepositoryFactory(collectionConfig, logger);
    const aggregationsRepository = aggregationsRepositoryFactory.build(logger);
    return aggregationsRepository;
}

function userActionFromEvent(event: IEventDAO): IUserAction {
    const { timestamp } = event;
    return {
        data: <ChooseLanguageData>{
            ...pick(["binderId", "language", "isMachineTranslation"], event.data),
            ...(event.data["document"] ? { publicationId: event.data["document"] } : {}),
        },
        accountId: event.account_id,
        userActionType: UserActionType.CHOOSE_LANGUAGE,
        start: new Date(timestamp),
        end: new Date(timestamp),
    }
}

async function getUserActionsRepo() {
    const config = BindersConfig.get();
    const logger = LoggerBuilder.fromConfig(config, SCRIPT_NAME);
    const aliasedRepository = new ElasticUserActionsRepository(config, logger);
    return aliasedRepository;
}

async function logAggregation(accountId: string) {
    const aggregationsRepo = await getAggregationsRepo();
    const now = new Date();
    await aggregationsRepo.saveAggregation(new Aggregation(
        AggregatorType.CHOOSELANGUAGE,
        now,
        accountId,
        {
            rangeStart: new Date("2000-01-01 00:00:00.000Z"),
            rangeEnd: now,
            aggregationType: "individual",
        },
    ));
}
async function doIt(): Promise<void> {
    const accounts = await getAccounts();
    if (!(await confirmRunScript())) {
        console.log("Aborting");
        process.exit(0);
    }
    const eventsRepo = await getEventsRepository();
    for (const account of accounts) {
        console.log(`Processing account ${account.name}`)
        await processAccount(eventsRepo, account.id);
    }
    process.exit(0);

}

async function confirmRunScript(): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise((resolve) => {
        rl.question("This script will map all existing choose_language events to useractions. It's important that there are currently no useractions of this type in the database. If there are, delete them using the deleteUserActionsByFilter script. Continue? y/n: ", function (answer) {
            resolve(answer === "y");
        });
    });
}

async function processAccount(eventsRepo, accountId: string): Promise<void> {

    const eventFilter = {
        eventTypes: [EventType.CHOOSE_LANGUAGE],
        accountIds: [accountId],
    };

    let eventsProcessed = 0;

    const eventsToProcessCount = await eventsRepo.countEvents(eventFilter);

    let percDone = 0;

    const userActionsRepo = await getUserActionsRepo();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async function doProcessEvents(eventDAOs: IEventDAO[], i: number) {
        if (!eventDAOs.length) {
            return;
        }
        const userActions = eventDAOs.map(userActionFromEvent);
        await userActionsRepo.multiInsertUserAction(userActions);

        eventsProcessed += eventDAOs.length;
        const perc = Math.round((eventsProcessed / eventsToProcessCount) * 100);
        if (perc !== percDone) {
            percDone = perc;
            console.log(`${eventsProcessed}/${eventsToProcessCount} events processed (${percDone}%)`);
        }
    }
    await eventsRepo.batchProcessEvents(eventFilter, doProcessEvents, { sequential: true });

    await logAggregation(accountId);
}

(async () => {
    await doIt();
})();

