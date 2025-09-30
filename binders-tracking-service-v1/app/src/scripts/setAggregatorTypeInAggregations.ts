/* eslint-disable no-console */
import {
    AggregationRepository,
    MongoAggregationsRepositoryFactory
} from  "../trackingservice/repositories/aggregationsRepository";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";

const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config, "merge-double-learners");

async function getAggregationsRepo(): Promise<AggregationRepository> {
    const repoFactory = await MongoAggregationsRepositoryFactory.fromConfig(config, logger);
    return repoFactory.build(logger);
}

const doIt = async () => {
    const aggregationsRepo = await getAggregationsRepo();
    await aggregationsRepo.__TEMPsetAggregatorType();
}

doIt().then(
    () => {
        console.log("All done!");
        process.exit(0);
    },
    err => {
        console.error(err);
        process.exit(1);
    }
)

