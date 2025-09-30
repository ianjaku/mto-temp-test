import * as fs from "fs";
import { Logger, LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { Config } from "@binders/client/lib/config/config";
import { DefaultESQueryBuilderHelper } from "../../repositoryservice/esquery/helper";
import { ElasticBindersRepository } from "../../repositoryservice/repositories/binderrepository";
import { ElasticCollectionsRepository } from "../../repositoryservice/repositories/collectionrepository";
import { ElasticPublicationsRepository } from "../../repositoryservice/repositories/publicationrepository";
import { ElasticRepository } from "@binders/binders-service-common/lib/elasticsearch/elasticrepository";

export enum MappingFileName {
    BINDERS = "binders",
    COLLECTION = "collection",
    PUBLICATION = "publication"
}

export function validateAndCastMappingFileName(input: string): MappingFileName | undefined {
    const values = Object.values(MappingFileName);

    if (values.includes(input as MappingFileName)) {
        return input as MappingFileName;
    }

    return undefined;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function getMapping(mappingFileName: MappingFileName) {
    const mappingFile = fs.realpathSync(`./src/elastic/mappings/${mappingFileName}.json`);
    if (typeof mappingFile === "undefined") {
        // eslint-disable-next-line no-console
        console.log(`!!! Could not find mapping file for type ${mappingFileName}.`);
        process.abort();
    }
    return JSON.parse(fs.readFileSync(mappingFile, "utf-8"));
}

export async function ensureMappings(config: Config): Promise<void> {
    const logger = LoggerBuilder.fromConfig(config, "binders");
    await ensureBinderMapping(config, logger, true);
    await ensurePublicationMapping(config, logger, true);
    await ensureCollectionMapping(config, logger, true);
}

function ensureMapping(logger: Logger, repository: ElasticRepository, mappingFileName: MappingFileName, skipExists = false) {
    return repository.ensureMapping(getMapping(mappingFileName), skipExists)
        .then(() => logger.info(`Ensured index and mapping for ${mappingFileName}`, "elastic-init"));
}

function ensureBinderMapping(config, logger, skipExists) {
    const repo = new ElasticBindersRepository(config, logger, new DefaultESQueryBuilderHelper(config));
    return ensureMapping(logger, repo, MappingFileName.BINDERS, skipExists);
}

function ensurePublicationMapping(config, logger, skipExists) {
    const repo = new ElasticPublicationsRepository(config, logger, new DefaultESQueryBuilderHelper(config));
    return ensureMapping(logger, repo, MappingFileName.PUBLICATION, skipExists);
}

function ensureCollectionMapping(config, logger, skipExists) {
    const repo = new ElasticCollectionsRepository(config, logger, new DefaultESQueryBuilderHelper(config));
    return ensureMapping(logger, repo, MappingFileName.COLLECTION, skipExists);
}
