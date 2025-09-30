/* eslint-disable no-console */
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Event } from "../trackingservice/models/event";
import { EventType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { SingleTrackingRepositoryFactory } from "../trackingservice/repositories/eventRepository";

const config = BindersConfig.get();
const loginOption = getMongoLogin("tracking_service");
const logger = LoggerBuilder.fromConfig(config);

const getOptions = () => {
    const { argv } = process;
    const hasOptions = argv.length > 2;
    if (!hasOptions) {
        console.log("Error: provide collectionName");
        process.exit(1);
    }
    return {
        collectionName: argv[2],
    };
};

async function getRepoForCollectionName(collectionName: string) {
    const collectionConfig = await CollectionConfig.promiseFromConfig(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        config, "tracking", loginOption, { transformCollectionName: ((_: string) => collectionName) }
    );
    const factory = new SingleTrackingRepositoryFactory(collectionConfig, logger);
    return factory.build(logger);
}

(async () => {
    const { collectionName } = getOptions();
    const repo = await getRepoForCollectionName(collectionName);
    await repo.logEvent(new Event(EventType.USER_IS_ONLINE, new Date(), new Date(), {}));
    console.log("All done!");
    process.exit(0);
})();

