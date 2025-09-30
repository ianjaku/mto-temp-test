/* eslint-disable no-console */
import * as fs from "fs";
import { Logger, LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { Config } from "@binders/client/lib/config/config";
import { ElasticRepository } from "@binders/binders-service-common/lib/elasticsearch/elasticrepository";
import { ElasticUserActionsRepository } from "../../trackingservice/repositories/userActionsRepository";

export enum MappingFileName {
    USERACTION = "useraction",
    NEW_USERACTION = "newuseraction"
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function getMapping(mappingFileName = MappingFileName.USERACTION) {
    const mappingFile = fs.realpathSync(`./src/essetup/mappings/${mappingFileName}.json`);
    if (typeof mappingFile === "undefined") {
        console.log(`!!! Could not find mapping file for type ${mappingFileName}.`);
        process.abort();
    }
    return JSON.parse(fs.readFileSync(mappingFile, "utf-8"));
}

export function ensureMappings(config: Config, skipExists: boolean): Promise<void> {
    const logger = LoggerBuilder.fromConfig(config, "tracking");
    return ensureUserActionMapping(config, logger, skipExists)
}

function ensureMapping(logger: Logger, repository: ElasticRepository, fileMappingName: MappingFileName, skipExists: boolean) {
    return repository.ensureMapping(getMapping(fileMappingName), skipExists)
        .then(() => logger.info(`Ensured index and mapping for ${fileMappingName}`, "elastic-init"));
}

function ensureUserActionMapping(config, logger, skipExists) {
    const repo = new ElasticUserActionsRepository(config, logger);
    return ensureMapping(logger, repo, MappingFileName.USERACTION, skipExists);
}
