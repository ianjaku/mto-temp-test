import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { Logger, LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Client } from "@elastic/elasticsearch";
import { Config } from "@binders/client/lib/config/config";
import { DefaultESQueryBuilderHelper } from "../repositoryservice/esquery/helper";
import { ElasticBindersRepository } from "../repositoryservice/repositories/binderrepository";
import {
    ElasticRepository
} from "@binders/binders-service-common/lib/elasticsearch/elasticrepository";
import LaunchDarklyService from "@binders/binders-service-common/lib/launchdarkly/server";
import { OperationLog } from "../repositoryservice/repositories/models/operationLog";
import { OperationLogServiceFactory } from "../repositoryservice/operation-log";
import { createElasticClient } from "@binders/binders-service-common/lib/elasticsearch/client";
import { main } from "@binders/binders-service-common/lib/util/process";

async function setupOperationLogService(config: Config, logger: Logger) {
    const ldService = await LaunchDarklyService.create(config, logger)
    const loginOption = getMongoLogin("repository_service");
    const collectionConfig = await CollectionConfig.promiseFromConfig(config, "operationlogs", loginOption)
    const factory = new OperationLogServiceFactory(collectionConfig)
    return factory.build(ldService, logger)
}

async function processOperationLog(elasticClient: Client, log: OperationLog, sourceIndex: string, targetIndex: string) {
    const payloadWithUpdatedIndex = log.payload.replace(sourceIndex, targetIndex)
    const payload = JSON.parse(payloadWithUpdatedIndex);
    let result;
    switch (log.operation) {
        case "bulk":
            result = await elasticClient.bulk(payload);
            break;
        case "delete":
            result = await elasticClient.delete(payload);
            break;
        case "index":
            result = await elasticClient.index(payload);
            break;
        case "update":
            result = await elasticClient.update(payload);
            break;
        default:
            logger.error(`Invalid operation: ${log.operation}`, CATEGORY);
    }

    if (result && result.body && result.body.errors) {
        logger.error(`Operation ${log.operation} failed for log ${log.id}: ${result.body.errors}`, CATEGORY);
    } else {
        logger.info(`Operation ${log.operation} succeeded for log ${log.id}`, CATEGORY);
    }
}

function validateIndexName(inputString: string): boolean {
    const pattern = /^(binders-binders-v\d+|binders-collections-v\d+|publications-v\d+)$/;
    return pattern.test(inputString);
}



function getOptions() {
    if (process.argv.length < 4 || process.argv.length > 6) {
        logger.error(`Usage: node ${__filename} <source_index> <target_index> [--changeAlias <binders|publications|collections>]`, CATEGORY);
        process.exit(1);
    }

    const sourceIndex = process.argv[2];
    const targetIndex = process.argv[3];

    let alias = null;
    if (process.argv[4] === "--changeAlias") {
        const aliasValue = process.argv[5];
        if (["binders", "publications", "collections"].includes(aliasValue)) {
            alias = aliasValue;
        } else {
            logger.error(`Invalid value for --changeAlias. Expected 'binders', 'publications', or 'collections'. Got ${aliasValue}`, CATEGORY);
            process.exit(1);
        }
    }

    if (validateIndexName(sourceIndex) && validateIndexName(targetIndex)) {
        return {
            sourceIndex,
            targetIndex,
            alias
        }
    } else {
        logger.error(`Given input is not valid, source index: ${sourceIndex} or target index ${targetIndex}`, CATEGORY);
        process.exit(1);
    }
}

function getElasticsearchRepository(): ElasticRepository {
    return new ElasticBindersRepository(config, logger, queryBuilderHelper)
}

const CATEGORY = "replay-operations-script"
const ELASTIC_BINDERS_CONFIG_KEY = "elasticsearch.clusters.binders"
const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config);
const queryBuilderHelper = new DefaultESQueryBuilderHelper(config);

main(async () => {
    const { alias, sourceIndex, targetIndex } = getOptions()
    const service = await setupOperationLogService(config, logger)
    const operationLogs = await service.getAll()
    const client = createElasticClient(config, ELASTIC_BINDERS_CONFIG_KEY)

    for (const operationLog of operationLogs) {
        await processOperationLog(client, operationLog, sourceIndex, targetIndex)
    }

    if (alias) {
        const elasticRepository = getElasticsearchRepository()
        await elasticRepository.updateAlias(alias, targetIndex)
    }
})


