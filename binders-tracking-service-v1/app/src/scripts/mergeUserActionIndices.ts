/* eslint-disable no-console */
import { Logger, LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { MappingFileName, getMapping } from "../essetup/mappings/ensureMapping";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Command } from "commander";
import {
    ElasticUserActionsRepository
} from "../trackingservice/repositories/userActionsRepository";
import { main } from "@binders/binders-service-common/lib/util/process";

const SCRIPT_NAME = "merge-user-actions";
const config = BindersConfig.get();


async function reindex(repository: ElasticUserActionsRepository, logger: Logger, sourceIndex: string, targetIndex: string) {
    logger.info(`>>>>>> Going to reindex from ${sourceIndex} to ${targetIndex}`, SCRIPT_NAME);

    const mapping = getMapping(MappingFileName.USERACTION)
    const taskId = await repository.startReindex({
        newIndexName: targetIndex,
        oldIndexName: sourceIndex,
        mapping,
    })
    await repository.waitForReindexComplete(taskId)
}

const dropIndex = async (config: BindersConfig, logger: Logger, index: string): Promise<boolean> => {
    logger.info(`>>>>>> Going to delete index ${index}`, SCRIPT_NAME);
    const repo = new ElasticUserActionsRepository(config, logger);
    return repo.withClient(async client => {
        const result = (await client.indices.delete({ index })).body;
        if (result.acknowledged) {
            return true
        } else {
            logger.error(`>>>>>> Error when deleting index ${index}: ${result} `, SCRIPT_NAME)
            return false
        }
    })
}

type ScriptOptions = {
    limit: number
}

function getOptions(): ScriptOptions {
    const program = new Command()
    program
        .name(SCRIPT_NAME)
        .description("The goal of this script is to merge user action indices")
        .version("0.1.1")
        .option("-l, --limit <int>", "The flag specify desired number of documents in a single index during merge operation", parseFloat, 100000)
    program.parse(process.argv)
    return program.opts() as ScriptOptions
}

main(async () => {
    const { limit } = getOptions()
    const logger = LoggerBuilder.fromConfig(config, "reindex-useractions");
    const readRepository = new ElasticUserActionsRepository(config, logger);
    const indexNames = await readRepository.getAliasedIndices("useractions");
    indexNames.sort();
    let currentWriteIndexName = indexNames.shift();
    let currentWriteRepo = new ElasticUserActionsRepository(config, logger, { indexName: currentWriteIndexName });
    let currentCount = await currentWriteRepo.runCount(currentWriteIndexName);
    for (const indexName of indexNames) {
        const repo = new ElasticUserActionsRepository(config, logger, { indexName });
        const repoCount = await repo.runCount(indexName);
        if (currentCount + repoCount > limit) {
            console.log(`>>>>>> Switching to write repo ${indexName}`);
            currentWriteIndexName = indexName;
            currentWriteRepo = new ElasticUserActionsRepository(config, logger, { indexName: currentWriteIndexName });
            currentCount = repoCount;
        } else {
            currentCount += repoCount;
            console.log(`>>>>>> Keeping write repo ${currentWriteIndexName} ${currentCount} < ${limit}`);
            await reindex(readRepository, logger, indexName, currentWriteIndexName)
            await dropIndex(config, logger, indexName);
        }
    }
})