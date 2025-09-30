/* eslint-disable no-console */
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { TrackingServiceFactory } from "../trackingservice/service";
import { main } from "@binders/binders-service-common/lib/util/process";


const getOptions = () => {
    const { argv } = process;
    const hasOptions = argv.length > 2;
    if (!hasOptions) {
        console.log("Error: provide an account id");
        process.exit(1);
    }
    return {
        accountId: argv[2],
    };
};

const getService = async () => {
    const config = BindersConfig.get(60);
    const logger = LoggerBuilder.fromConfig(config);
    const factory = await TrackingServiceFactory.fromConfig(config, logger);
    return factory.forRequest({logger});
}

const doIt = async () => {
    const service = await getService();
    const { accountId } = getOptions();
    await service.resetAggregations(accountId);
}

main(doIt);