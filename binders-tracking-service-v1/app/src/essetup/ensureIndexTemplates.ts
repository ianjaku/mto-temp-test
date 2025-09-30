import { MappingFileName, getMapping } from "./mappings/ensureMapping";
import { Config } from "@binders/client/lib/config/config";
import {
    ElasticUserActionsRepository
} from "../trackingservice/repositories/userActionsRepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const ensureIndexTemplates = async (config: Config) => {
    const logger = LoggerBuilder.fromConfig(config, "userActions");
    const repo = new ElasticUserActionsRepository(config, logger);
    const mappings = getMapping(MappingFileName.USERACTION)
    const success = await repo.ensureIndexTemplates({
        name: "useractions",
        body: {
            template: "useractions-*",
            aliases: { useractions: {} },
            mappings
        }
    });
    if (success) {
        logger.info("Ensured index templates", "elastic-init");
    }
}
