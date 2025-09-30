/* eslint-disable no-console */
import { MappingFileName, getMapping } from "../essetup/mappings/ensureMapping";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import {
    ElasticUserActionsRepository
} from "../trackingservice/repositories/userActionsRepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";

const doIt = async () => {
    const config = BindersConfig.get();
    const logger = LoggerBuilder.fromConfig(config, "update-useractions-mapping");
    const userActionsRepository = new ElasticUserActionsRepository(config, logger);
    const indices = await userActionsRepository.getAliasedIndices("useractions");
    const mapping = getMapping(MappingFileName.USERACTION)
    for (const index of indices) {
        userActionsRepository.updateIndex(index);
        console.log(`Updating mapping in index ${index}`);
        await userActionsRepository.ensureMapping(mapping)
    }
}

doIt().then(
    () => {
        console.log("All done!");
        process.exit(0);
    },
    err => {
        console.error(err);
        process.exit(1)
    }
);