import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders"
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { TrackingServiceFactory } from "../trackingservice/service"
import { main } from "@binders/binders-service-common/lib/util/process"
import { syncIndices } from "@binders/binders-service-common/lib/mongo/indices/helpers"

main( async() => {
    const config = BindersConfig.get();
    const logger = LoggerBuilder.fromConfig(config);
    await TrackingServiceFactory.fromConfig(config, logger);
    await syncIndices();
});