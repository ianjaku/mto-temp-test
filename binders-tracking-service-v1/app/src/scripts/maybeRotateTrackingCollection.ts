/* eslint-disable no-console */
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { EventRepoMapping, getCollectionName } from "../trackingservice/models/eventRepoMapping";
import { EventRepository, MultiTrackingRepositoryFactory, SingleTrackingRepositoryFactory } from "../trackingservice/repositories/eventRepository";
import { MongoEventRepoMappingRepository, MongoEventRepoMappingRepositoryFactory } from "../trackingservice/repositories/eventRepoMappingRepository";
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
        THRESHOLD: isTest ? 10 : 1000000,
    };
};

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

const getCurrentEventsRepository = async (eventRepoMappingRepository: MongoEventRepoMappingRepository) => {
    return MultiTrackingRepositoryFactory.getCurrent(config, logger, eventRepoMappingRepository);
}

async function generateEventsRepo(collectionName: string) {
    const collectionConfig = await CollectionConfig.promiseFromConfig(
        config,
        "tracking",
        loginOption,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        { transformCollectionName: ((_name: string) => collectionName) }
    );
    const factory = new SingleTrackingRepositoryFactory(collectionConfig, logger);
    const repo = await factory.build(logger);
    await factory.syncIndexes();
    return repo;
}

async function doRotate(eventsRepository: EventRepository, eventRepoMappingRepository: MongoEventRepoMappingRepository) {
    const [latestEvent] = await eventsRepository.getLatestEvents(1);
    const endDate = latestEvent.timestampLogged || latestEvent.timestamp;
    const endDateWithMargin = moment(endDate).add(1, "h").toDate();
    console.log("completing current...")
    await eventRepoMappingRepository.completeCurrentEventsRepo(endDateWithMargin);
    const startDateWithMargin = moment().subtract(1, "h").toDate();
    const collectionName = getCollectionName(startDateWithMargin);
    console.log("inserting new one...")
    await eventRepoMappingRepository.insertEventRepoMapping(new EventRepoMapping(collectionName, startDateWithMargin));
    await generateEventsRepo(collectionName);
}

(async () => {
    const eventRepoMappingRepository = await getEventRepoMappingRepository();
    const currentEventsRepository = await getCurrentEventsRepository(eventRepoMappingRepository);
    const eventCount = await currentEventsRepository.countEvents({});
    const { THRESHOLD } = getOptions();
    if (eventCount > THRESHOLD) {
        console.log(`${eventCount} events in current collection, that's more than ${THRESHOLD} -> should rotate`);
        await doRotate(currentEventsRepository, eventRepoMappingRepository);
        console.log("All done!");
        process.exit(0);
    }
    console.log(`Current collection has ${eventCount} events in it. No rotation necessary`);
    process.exit(0);
})();
