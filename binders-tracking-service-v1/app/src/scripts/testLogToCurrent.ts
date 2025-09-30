/* eslint-disable no-console */
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { MongoEventRepoMappingRepository, MongoEventRepoMappingRepositoryFactory } from "../trackingservice/repositories/eventRepoMappingRepository";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Event } from "../trackingservice/models/event";
import { EventType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { SingleTrackingRepositoryFactory } from "../trackingservice/repositories/eventRepository";

const config = BindersConfig.get();
const loginOption = getMongoLogin("tracking_service");
const logger = LoggerBuilder.fromConfig(config);

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
    const currentRepoName = await eventRepoMappingRepository.currentEventsRepo();
    return CollectionConfig.fromConfig(
        config,
        "tracking",
        loginOption,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        { transformCollectionName: ((_name: string) => currentRepoName) }
    )
        .caseOf({
            left: error => Promise.reject(error),
            right: ccfg => Promise.resolve(ccfg)
        })
        .then(collectionConfig => new SingleTrackingRepositoryFactory(collectionConfig, logger))
        .then(factory => factory.build(logger));
}


(async () => {
    const eventRepoMappingRepository = await getEventRepoMappingRepository();
    const currentEventsRepository = await getCurrentEventsRepository(eventRepoMappingRepository);
    await currentEventsRepository.logEvent(new Event(EventType.USER_IS_ONLINE, new Date(), new Date(), {}));
    console.log("All done!");
    process.exit(0);
})();
