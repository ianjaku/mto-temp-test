/* eslint-disable no-console */
import {
    ElasticQuery,
    REPO_CONFIGS_BY_TYPE,
    RepositoryConfigType
} from "@binders/binders-service-common/lib/elasticsearch/elasticrepository";
import { MappingFileName, getMapping } from "../elastic/mappings/ensureMapping";
import { SettingFileName, getSettings } from "../elastic/settings/ensure";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { DefaultESQueryBuilderHelper } from "../../src/repositoryservice/esquery/helper";
import { ElasticBindersRepository } from "../repositoryservice/repositories/binderrepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";


const config = BindersConfig.get();
const CATEGORY = "reindex-binders"
const logger = LoggerBuilder.fromConfig(config, CATEGORY);
type IndexData = { oldIndexName: string; newIndexName: string }

const reindexBinders = async (repository: ElasticBindersRepository, indexData: IndexData): Promise<void> => {
    const { oldIndexName, newIndexName } = indexData
    const mapping = getMapping(MappingFileName.BINDERS)
    const settings = getSettings(SettingFileName.BINDERS)
    const cfg = {
        mapping,
        settings,
        oldIndexName,
        newIndexName,
    }
    const taskId = await repository.startReindex(cfg)
    await repository.waitForReindexComplete(taskId)
}

function selectAllQuery(): ElasticQuery {
    return {
        query: {
            match_all: {}
        }
    };
}

async function validateReindexOpeation(repository: ElasticBindersRepository, index: string, desiredNumberOfDocuments: number): Promise<boolean> {
    repository.updateIndex(index)
    logger.info("Starting validation of reindex operation", CATEGORY)
    await repository.ensureMapping(getMapping(MappingFileName.BINDERS))
    const numberOfDocuments = await repository.runCount(index, selectAllQuery())
    logger.info(`Number of docs ${numberOfDocuments} vs desired number of docs ${desiredNumberOfDocuments}`, CATEGORY)
    return numberOfDocuments === desiredNumberOfDocuments
}


const doIt = async () => {
    const queryBuilderHelper = new DefaultESQueryBuilderHelper(config);
    const repo = new ElasticBindersRepository(config, logger, queryBuilderHelper)
    const indexData = {
        oldIndexName: "binders-binders-v3",
        newIndexName: "binders-binders-v4",
    }
    repo.updateIndex(indexData.oldIndexName)
    const desiredNumberOfItems = await repo.runCount(indexData.oldIndexName, selectAllQuery())
    const aliasedIndexName = REPO_CONFIGS_BY_TYPE[RepositoryConfigType.Binders].aliasedIndexName
    logger.info(`Starting reindexing ${aliasedIndexName} index ${indexData.oldIndexName} -> ${indexData.newIndexName}`, CATEGORY)
    await reindexBinders(repo, indexData)
    const valid = await validateReindexOpeation(repo, indexData.newIndexName, desiredNumberOfItems)
    if (valid) {
        logger.info(`Starting update of alias ${aliasedIndexName} ${indexData.oldIndexName} -> ${indexData.newIndexName}`, CATEGORY)
        await repo.updateAlias(aliasedIndexName, indexData.newIndexName)
    } else {
        throw new Error(`Number of docs in new ${indexData.newIndexName} is not matching the old ${indexData.oldIndexName}. Please verify it manually!`)
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