import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import {
    MongoLastAccountEventMappingRepositoryFactory
} from  "../trackingservice/repositories/accountEventMappingRepository";
import { main } from "@binders/binders-service-common/lib/util/process";


const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config);

async function getRepo() {
    const factory = await MongoLastAccountEventMappingRepositoryFactory.fromConfig(config, logger);
    const repo = factory.build(logger);
    return [factory, repo];
}

async function iteration(factory, repo) {
    await repo.fixDuplicates();
    await factory.syncIndexes();
}

const MAX_ATTEMPTS = 10;
const SCRIPT_NAME = "FixDuplicateLastAccountEvents";

main(async() => {
    const [factory, repo] = await getRepo();
    for (let i=0; i<MAX_ATTEMPTS; i++) {
        logger.info(`Starting iteration ${i+1}`, SCRIPT_NAME);
        try {
            await iteration(factory, repo);
            break;
        } catch (err) {
            logger.logException(err, SCRIPT_NAME);
        }
    }
})