/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    ElasticRepository,
    ElasticRepositoryConfigFactory,
    RepositoryConfigType
} from "@binders/binders-service-common/lib/elasticsearch/elasticrepository";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Command } from "commander";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { main } from "@binders/binders-service-common/lib/util/process";

const SCRIPT_NAME = "Detect duplicate text module keys";

const program = new Command();

program
    .name(SCRIPT_NAME)

async function getElasticRepository(): Promise<[ElasticRepository, string]> {
    const bindersConfig = BindersConfig.get();
    const repoConfig = ElasticRepositoryConfigFactory.build(bindersConfig, [RepositoryConfigType.Binders]);
    const logger = LoggerBuilder.fromConfig(bindersConfig, "dumpBinder");
    return [new ElasticRepository(repoConfig, logger), repoConfig.indexName as string];
}

const duplicates = [];

const processBatch = async (batch: any[]) => {
    for (const binder of batch) {
        const chunked = binder._source?.modules?.text?.chunked;
        if (Array.isArray(chunked)) {
            const seen = new Set<string>();
            let hasDuplicate = false;
            for (const entry of chunked) {
                const key = entry?.key;
                if (key !== undefined) {
                    if (seen.has(key)) {
                        hasDuplicate = true;
                        break;
                    }
                    seen.add(key);
                }
            }
            if (hasDuplicate) {
                console.log("DUPLICATE DETECTED", binder._id);
                duplicates.push(binder._id);
            }
        }
    }
}

main(async () => {
    program.parse(process.argv);
    const [repo] = await getElasticRepository();
    await repo.runScroll({
        index: repo.getIndexName(),
        body: { query: { match_all: {} } }
    }, 1000, 100, processBatch);
    console.log("DUPLICATES FOUND IN BINDERS:", duplicates.join(","));
})