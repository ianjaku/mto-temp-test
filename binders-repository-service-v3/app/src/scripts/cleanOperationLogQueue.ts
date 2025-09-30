import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { Logger, LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Config } from "@binders/client/lib/config/config";
import LaunchDarklyService from "@binders/binders-service-common/lib/launchdarkly/server";
import { OperationLogServiceFactory } from "../repositoryservice/operation-log";
import { main } from "@binders/binders-service-common/lib/util/process";

async function setupOperationLogService(config: Config, logger: Logger) {
    const ldService = await LaunchDarklyService.create(config, logger)
    const loginOption = getMongoLogin("repository_service");
    const collectionConfig = await CollectionConfig.promiseFromConfig(config, "operationlogs", loginOption)
    const factory = new OperationLogServiceFactory(collectionConfig)
    return factory.build(ldService, logger)
}

const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config);

main(async () => {
    const service = await setupOperationLogService(config, logger)
    await service.purgeAll()
})


