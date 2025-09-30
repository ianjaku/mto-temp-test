/* eslint-disable no-console */
import {
    MongoTermsAcceptanceRepository,
    MongoTermsAcceptanceRepositoryFactory
} from "../userservice/repositories/termsAcceptance";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { CollectionConfig } from "@binders/binders-service-common/lib/mongo/config";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";

const config = BindersConfig.get();

const SCRIPT_NAME = "addAccountIdToTermsAcceptance";

const NIKE = "aid-bea5fdc5-0f8c-4f3e-af8c-a9a41b693fc7";

async function getRepo(): Promise<MongoTermsAcceptanceRepository> {
    const logger = LoggerBuilder.fromConfig(config, SCRIPT_NAME);
    const loginOption = getMongoLogin("user_service");
    const termsAcceptanceCollectionConfig = await CollectionConfig.promiseFromConfig(config, "termsAcceptance", loginOption);
    const factory = new MongoTermsAcceptanceRepositoryFactory(termsAcceptanceCollectionConfig, logger);
    return factory.build(logger);
}

const doIt = async () => {
    try {
        const termsAcceptanceRepo = await getRepo();
        await termsAcceptanceRepo.addAccountIdToAll(NIKE);
        await termsAcceptanceRepo.setVersionInAll("1");
    } catch (err) {
        console.error(err)
        process.exit(1)
    }
}

doIt()
    .then(() => {
        console.log("All done!");
        process.exit(0);
    }, error => {
        console.error(error);
        process.exit(1);
    });