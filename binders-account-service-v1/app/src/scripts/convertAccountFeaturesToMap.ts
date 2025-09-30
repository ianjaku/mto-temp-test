/* eslint-disable no-console */
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { MongoAccountFeaturesRepositoryFactory } from "../accountservice/repositories/accountFeatures";

let featuresConverted = 0;

const config = BindersConfig.get();
const loginOption = getMongoLogin("account_service");
const logger = LoggerBuilder.fromConfig(config);

const doIt = async () => {
    const collectionConfig = await CollectionConfig.promiseFromConfig(
        config,
        "accountFeatures",
        loginOption,
    );
    const repo = new MongoAccountFeaturesRepositoryFactory(collectionConfig, logger).build(logger);
    const allAccountFeatures = await repo.getAccountFeaturesList();
    await Promise.all(allAccountFeatures.map(async (feature) => {
        await repo.convertAccountFeatures(feature.accountId, feature.features);
        featuresConverted++;
    }));
};

doIt()
    .then(() => {
        console.log(`Converted ${featuresConverted + 1} features`);
        console.log("All done!");
        process.exit(0);
    },
    error => {
        console.error("Something went wrong");
        console.error(error);
        process.exit(1);
    });