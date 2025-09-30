/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { Event, IEventDAO } from "../trackingservice/models/event";
import { EventRepoMapping, getCollectionName } from "../trackingservice/models/eventRepoMapping";
import { EventRepository, MigrationPhase, MultiTrackingRepositoryFactory } from "../trackingservice/repositories/eventRepository";
import { EventType, IEventFilter } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { MongoEventRepoMappingRepository, MongoEventRepoMappingRepositoryFactory } from "../trackingservice/repositories/eventRepoMappingRepository";
import { SearchOptions as BatchProcessSearchOptions } from "@binders/binders-service-common/lib/mongo/repository";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import moment from "moment";

const config = BindersConfig.get();
const loginOption = getMongoLogin("tracking_service");
const logger = LoggerBuilder.fromConfig(config);

const getOptions = () => {
    const { argv } = process;
    const hasOptions = argv.length > 2;
    const isTest = hasOptions ? argv.indexOf("--test") > -1 : false;
    return {
        THRESHOLD: isTest ? 500 : 1000000,
        isTest,
    };
};

const getRepos = async () => {
    const config = BindersConfig.get();
    const repoMapping = await getEventRepoMappingRepository();
    const mf = new MultiTrackingRepositoryFactory(config, repoMapping, MigrationPhase.BACK_FILLING_MULTI_COLLECTIONS);
    return { repoMapping, mf };
}

const getEventRepoMappingRepository = async () => {
    const collectionConfig = await CollectionConfig.promiseFromConfig(
        config,
        "eventRepoMapping",
        loginOption,
    );
    const eventsRepoMappingRepositoryFactory = new MongoEventRepoMappingRepositoryFactory(collectionConfig, logger);
    const eventsRepoMappingRepository = eventsRepoMappingRepositoryFactory.build(logger);
    return eventsRepoMappingRepository;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function validateEventsSubcolName(candidate: any) {
    return candidate.startsWith("events-") &&
        candidate.length === 20 &&
        /^\d+$/.test(candidate.substring(7));
}


const getValidTimestamp = (event: Event | IEventDAO): Date => {
    if (event.timestampLogged && moment(event.timestampLogged).isValid()) {
        return event.timestampLogged;
    } else {
        return event.timestamp;
    }

}

interface ICopyReport {
    eventsProcessed: number;
    firstTimestampLogged: Date;
    lastTimestampLogged: Date;
    lastProcessedEventId: string;
    collection: string;
}

async function copyEvents(
    mf: MultiTrackingRepositoryFactory,
    repoMapping: MongoEventRepoMappingRepository,
    monolith: EventRepository,
    targetCollectionName: string,
    lastProcessedId: string,
    rangeEnd: Date,
    batchSize: number): Promise<ICopyReport>
{
    let firstTimestampLogged;
    let lastTimestampLogged;
    let lastProcessedEventId;

    const eventsFilter: IEventFilter = {
        excludeEventTypes: [EventType.EVENTS_AGGREGATED],
        range: { rangeEnd, fieldName: "timestampLogged", fallbackFieldName: "timestamp" },
        ...(lastProcessedId ? { idRange: { startIdNonInclusive: lastProcessedId } } : {}),
    };

    const liveCollectionMapping = await repoMapping.getCurrentEventsMapping();
    let liveCollectionStartMoment = moment(liveCollectionMapping.start);
    let eventsProcessed = 0;

    const searchOptions: BatchProcessSearchOptions = { orderByField: "_id", sortOrder: "ascending", limit: batchSize };

    let percDone = 0;

    let targetRepo, collectionName;
    async function doProcessEvents(eventDAOs: IEventDAO[], i: number) {
        if (!eventDAOs.length) {
            return;
        }
        if (i === 0) {
            firstTimestampLogged = getValidTimestamp(eventDAOs[0]);
            collectionName = targetCollectionName || getCollectionName(firstTimestampLogged);
            if (!targetCollectionName) {
                const mappingStartMoment = moment(firstTimestampLogged).subtract(1, "h");
                // Maybe shift start of live mapping, we need to make sure the start time
                // is always the most recent
                if (liveCollectionStartMoment.isBefore(mappingStartMoment)) {
                    liveCollectionStartMoment = moment(mappingStartMoment).add(1, "s");
                    const toUpdate = new EventRepoMapping(
                        liveCollectionMapping.collectionName,
                        liveCollectionStartMoment.toDate()
                    );
                    await repoMapping.updateMapping(toUpdate)
                }
                const mapping = new EventRepoMapping(collectionName, mappingStartMoment.toDate());
                await repoMapping.insertEventRepoMapping(mapping);
            }
            targetRepo = await mf.getRepositoryByName(collectionName, logger);
        }
        lastTimestampLogged = getValidTimestamp(eventDAOs[eventDAOs.length - 1]);
        lastProcessedEventId = eventDAOs[eventDAOs.length - 1].id;
        const normalizedEvents = eventDAOs.map((e: IEventDAO) => {
            const { event_type, timestamp, timestampLogged, data, account_id, user_id, id } = e;
            return new Event(event_type, timestamp, timestampLogged || timestamp, data, account_id, user_id, id);
        });
        await targetRepo.logEvents(normalizedEvents, true);
        eventsProcessed += normalizedEvents.length;

        const perc = Math.round((eventsProcessed / batchSize) * 100);
        if (perc !== percDone) {
            percDone = perc;
            console.log(`${percDone}%`);
        }
    }

    await monolith.batchProcessEvents(eventsFilter, doProcessEvents, searchOptions);

    return {
        firstTimestampLogged,
        lastTimestampLogged,
        lastProcessedEventId,
        eventsProcessed,
        collection: collectionName
    }
}

async function splitOff(
    mf: MultiTrackingRepositoryFactory,
    repoMapping: MongoEventRepoMappingRepository,
    monolith: EventRepository,
    lastProcessedId: string,
    endOffsetDate: Date,
    batchSize: number,
    collectionName: string
): Promise<ICopyReport> {
    const copyReport = await copyEvents(mf, repoMapping, monolith, collectionName, lastProcessedId, endOffsetDate, batchSize);
    console.log("copyReport", JSON.stringify(copyReport, null, 2));
    const { eventsProcessed, lastTimestampLogged, collection } = copyReport;
    if (eventsProcessed > 0) {
        const endWithMargin = moment(lastTimestampLogged).add(1, "h").toDate();
        await repoMapping.completeEventsRepo(collection, endWithMargin)
    }
    return copyReport;
}

async function getLastPartialCollectionName (repoMapping: MongoEventRepoMappingRepository) {
    // Get mappings (they are sorted by start date)
    const mappings = await repoMapping.getDaos();
    const incomplete = mappings.filter(m => !m.end);
    const complete = mappings.filter(m => !!m.end);
    if (incomplete.length === 0) {
        return undefined;
    }
    switch(incomplete.length) {
        case 1: {
            // No partially completed collection, only the one receiving "live" events exists
            return complete.length > 0 ?
                complete[complete.length - 1].collectionName:
                undefined;
        }
        case 2: {
            // We have a partially completed collection and the "live" one
            // The partially completed one will have the oldest start date
            return incomplete[1].collectionName;
        }
        default: {
            throw new Error(`Unknown state: we have ${incomplete.length} incomplete collections.`);
        }
    }
}

async function getLastProcessedId(
    mf: MultiTrackingRepositoryFactory,
    repoMapping: MongoEventRepoMappingRepository
): Promise<string> {

    // Get all repo mappings
    // Count the number mappings without end date
    // If one -> Pick the newest start date from the rest
    // If two -> Pick the oldest start date from the two without end date


    const latestSubCollectionName = await getLastPartialCollectionName(repoMapping);
    if (!latestSubCollectionName) {
        console.log("no latest subcol found");
        return undefined;
    }
    const latestSubCollection = await mf.getRepositoryByName(latestSubCollectionName, logger);

    if (!(await latestSubCollection.countEvents({}))) {
        console.log(`The latest subcollection (${latestSubCollectionName}) has 0 events; please drop it and rerun script`);
        process.exit(1);
    }

    const [latestEvent] = await latestSubCollection.getLatestEvents(1);
    return latestEvent.id;
}

async function getEndOffsetDate(mf: MultiTrackingRepositoryFactory): Promise<Date> {
    const lasteventsRepository = await mf.getCurrent(logger);
    if ((await lasteventsRepository.countEvents({})) === 0) {
        console.log("Error: No active partial events collection detected. Please make sure this collection (that holds the latest events) exists before running this script.");
        process.exit(1);
    }
    const [firstEvent] = await lasteventsRepository.getFirstEvents(1);
    return getValidTimestamp(firstEvent);
}

(async () => {
    const { repoMapping, mf } = await getRepos();
    const monolith = await mf.getMonolith(logger);
    const { THRESHOLD, isTest } = getOptions();

    let lastProcessedId = await getLastProcessedId(mf, repoMapping); // Pick up where we left off, in case the script didn't finish in one run
    const endOffsetDate = await getEndOffsetDate(mf); // Exclude the events that have already been accounted for using the prior created "last subcollection", which we're using to redundanly save incoming events

    console.log("scope, event with id", lastProcessedId, "until date", endOffsetDate);

    let doContinue = true;
    let n = 0;

    const canContinue = () => doContinue && (isTest ? n < 5 : true);

    let collectionName, documentLimit;

    while (canContinue()) {
        if (n === 0 && lastProcessedId) {
            // this is a resume of a previous run
            const daos = await repoMapping.getDaos();
            // There should be an incomplete element here
            const incompleteDao = daos[1];
            if (!incompleteDao || incompleteDao.end) {
                throw new Error("Detected resume but no incomplete repo mapping?");
            }
            collectionName = incompleteDao.collectionName;
            const lastRepo = await mf.getRepositoryByName(collectionName, logger);
            documentLimit = THRESHOLD - (await lastRepo.countEvents({}));
        } else {
            collectionName = undefined;
            documentLimit = THRESHOLD;
        }
        if (documentLimit === 0) {
            continue;
        }
        const { lastProcessedEventId, eventsProcessed } = await splitOff(mf,
            repoMapping, monolith, lastProcessedId, endOffsetDate, documentLimit, collectionName);
        if (eventsProcessed === 0) {
            doContinue = false;
        }
        lastProcessedId = lastProcessedEventId;
        n++;
    }
    process.exit(0);
})();
