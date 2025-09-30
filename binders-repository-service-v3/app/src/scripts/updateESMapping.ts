/* eslint-disable no-console */
import {
    ElasticQuery,
    ElasticRepository
} from "@binders/binders-service-common/lib/elasticsearch/elasticrepository";
import { MappingFileName, getMapping, validateAndCastMappingFileName, } from "../elastic/mappings/ensureMapping";
import { SettingFileName, getSettings, validateAndCastSettingFileName } from "../elastic/settings/ensure";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";

const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config, "update-es-mapping");

class ElasticRepo extends ElasticRepository {
    constructor(indexName, logger) {
        super({
            config,
            clusterConfigKey: "elasticsearch.clusters.binders",
            indexName: indexName,
        }, logger)
    }
}

function getOptions() {
    if (process.argv.length < 4) {
        console.error(`
Usage: updateESMapping.ts <INDEX_NAME> <MAPPING_FILE_NAME> <SETTINGS_FILE_NAME>

Example: updateESMapping.ts binders-collections-v3 collection collection
        `);
        process.exit(1);
    }

    const mappingFileNameInput = process.argv[3].trim();
    const mappingFileName = validateAndCastMappingFileName(mappingFileNameInput);

    if (!mappingFileName) {
        console.error("Invalid MAPPING_FILE_NAME. It must be one of the following:", Object.values(MappingFileName).join(", "));
        process.exit(1);
    }

    const settingsFileNameInput = process.argv[4].trim();
    const settingsFileName = validateAndCastSettingFileName(settingsFileNameInput)
    if (!settingsFileName) {
        console.error("Invalid SETTING_FILE_NAME. It must be one of the following:", Object.values(SettingFileName).join(", "));
        process.exit(1);
    }

    return {
        indexName: process.argv[2].trim(),
        mappingFileName,
        settingsFileName
    }
}

async function sleep(time: number) {
    return new Promise((resolve) => {
        setTimeout(() => resolve(""), time);
    })
}

function selectAllQuery(): ElasticQuery {
    return {
        query: {
            match_all: {}
        }
    };
}

async function retryWithTimeout(
    timeoutMS: number,
    stepCount: number,
    check: () => boolean | Promise<boolean>
) {
    for (let i = 0; i < stepCount; i++) {
        const isValid = await check();
        if (isValid) return;

        await sleep(timeoutMS / stepCount);
    }
    throw new Error("RetryWithTimeout: Timed out");
}

async function ensureSettingsAndMapping(clusterConfigKey: string, indexName: string, mappingFileName: MappingFileName, settingsFileName: SettingFileName) {
    const repo = new ElasticRepository({
        config,
        clusterConfigKey,
        indexName,
    }, logger);
    const settings = getSettings(settingsFileName);
    await repo.ensureSettings(settings, true);
    const mapping = getMapping(mappingFileName);
    await repo.ensureMapping(mapping);
}

async function updateESMapping() {
    const ops = getOptions();
    const mapping = getMapping(ops.mappingFileName);
    const originalRepo = new ElasticRepo(ops.indexName, logger);

    const tempIndexName = ops.indexName + "-temp";

    if (await originalRepo.indexExists(tempIndexName)) {
        console.log(`The index ${tempIndexName} already exists`);
        process.exit(1);
    }

    if (!await originalRepo.indexExists(ops.indexName)) {
        console.log(`! The given index ${ops.indexName} does not exist`);
        process.exit(1);
    }

    switch (ops.mappingFileName) {
        case "publication":
        case "binders": {
            await ensureSettingsAndMapping("elasticsearch.clusters.binders", tempIndexName, ops.mappingFileName, ops.settingsFileName);
            break;
        }
    }

    const itemCount = await originalRepo.runCount(ops.indexName, selectAllQuery());

    console.log(`Start reindexing ${itemCount} items`);
    await originalRepo.reindex({
        mapping,
        newIndexName: tempIndexName,
        oldIndexName: ops.indexName,
    }, "1h");

    console.log(`Making sure the resulting mapping is correct on ${tempIndexName}`);
    const tempRepo = new ElasticRepo(tempIndexName, logger);
    switch (ops.mappingFileName) {
        case "publication":
        case "binders": {
            await ensureSettingsAndMapping("elasticsearch.clusters.binders", tempIndexName, ops.mappingFileName, ops.settingsFileName);
            break;
        }
    }

    await retryWithTimeout(10000, 20, async () => {
        const tempItemCount = await originalRepo.runCount(ops.indexName, selectAllQuery());
        console.log(`Waiting for reindex to finish. ${tempItemCount} transfered so far`);
        return itemCount === tempItemCount;
    });

    console.log(`Deleting the old index ${ops.indexName}`);
    await originalRepo.deleteIndex(ops.indexName);

    await sleep(5000);

    console.log(`Recreating the old index ${ops.indexName}`);
    switch (ops.mappingFileName) {
        case "publication":
        case "binders": {
            await ensureSettingsAndMapping("elasticsearch.clusters.binders", ops.indexName, ops.mappingFileName, ops.settingsFileName);
            break;
        }
    }

    console.log(`Reindexing back to old index ${ops.indexName}`);
    await tempRepo.reindex({
        mapping,
        newIndexName: ops.indexName,
        oldIndexName: tempIndexName,
    });

    await retryWithTimeout(10000, 20, async () => {
        const newItemCount = await originalRepo.runCount(ops.indexName, selectAllQuery());
        console.log(`Waiting for reindex to finish. ${newItemCount} transfered so far`);
        return itemCount === newItemCount;
    });

    console.log(`Deleting the temp index ${tempIndexName}`);
    await tempRepo.deleteIndex(tempIndexName);
}

updateESMapping()
    .then(() => {
        console.log("All done!");
        process.exit(0);
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
