import { MappingFileName, getMapping } from "../essetup/mappings/ensureMapping";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { CURRENT_INDEX_PREFIX } from "../essetup/ensureAliases";
import { ElasticQuery } from "@binders/binders-service-common/lib/elasticsearch/elasticrepository";
import {
    ElasticUserActionsRepository
} from "../trackingservice/repositories/userActionsRepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";

const config = BindersConfig.get();
const CATEGORY = "reindex-too-old-ua-indices"
const logger = LoggerBuilder.fromConfig(config, CATEGORY);

function getIndices() {
    const readRepository = new ElasticUserActionsRepository(config, logger);
    return readRepository.checkIndicesByVersion("6", CURRENT_INDEX_PREFIX)
}

function selectAllQuery(): ElasticQuery {
    return {
        query: {
            match_all: {}
        }
    };
}

async function validateReindexOpeation(repository: ElasticUserActionsRepository, index: string, desiredNumberOfDocuments: number): Promise<boolean> {
    repository.updateIndex(index)
    logger.info("Starting validation of reindex operation", CATEGORY)
    await repository.ensureMapping(getMapping(MappingFileName.USERACTION))
    const numberOfDocuments = await repository.runCount(index,selectAllQuery())
    logger.info(`Number of docs ${numberOfDocuments} vs desired number of docs ${desiredNumberOfDocuments}`, CATEGORY)
    return numberOfDocuments === desiredNumberOfDocuments
}

async function runReindex(repository: ElasticUserActionsRepository, sourceIndex: string, targetIndex: string) {
    logger.info(`Start reindexing ${sourceIndex} -> ${targetIndex}`, CATEGORY)
    repository.updateIndex(sourceIndex)
    const mapping = getMapping(MappingFileName.NEW_USERACTION)
    const taskId = await repository.startReindex({
        newIndexName: targetIndex,
        oldIndexName: sourceIndex,
        mapping,
    })
    await repository.waitForReindexComplete(taskId)
    const numberOfDocumentsInOriginalIndex = await repository.runCount(sourceIndex, selectAllQuery())
    const isOk = await validateReindexOpeation(repository, targetIndex, numberOfDocumentsInOriginalIndex)
    if (!isOk) {
        process.exit(1)
    }
}


async function processIndex(originalIndex: string) {
    logger.info(`Start processing index ${originalIndex}`, CATEGORY)
    const tempIndexName = originalIndex + "-temp"
    const repository = new ElasticUserActionsRepository(config, logger)
    repository.updateIndex(originalIndex)

    if (!await repository.indexExists(originalIndex)) {
        logger.info(`Original index ${originalIndex} does not exits`, CATEGORY)
        process.exit(1)
    }

    repository.updateIndex(tempIndexName)
    if (await repository.indexExists(tempIndexName)) {
        logger.info(`Temporary index ${tempIndexName} already exits`, CATEGORY)
        process.exit(1)
    }

    await runReindex(repository, originalIndex, tempIndexName)
    await repository.deleteIndex(originalIndex)
    await runReindex(repository, tempIndexName, originalIndex)
    logger.info(`Successfully processed ${originalIndex}`, CATEGORY)
}

async function reindex() {
    const indices = await getIndices()
    logger.info(`Number of indices to process ${indices.length}`, CATEGORY)
    for (const index of indices) {
        await processIndex(index)
    }
}

reindex()
    .then(() => {
        logger.info("All done!", CATEGORY);
        process.exit(0);
    })
    .catch((error) => {
        logger.error(error, CATEGORY);
        process.exit(1);
    })