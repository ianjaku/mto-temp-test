import {
    ElasticRepository,
    ElasticRepositoryConfigFactory,
    RepositoryConfigType
} from "@binders/binders-service-common/lib/elasticsearch/elasticrepository";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Command } from "commander";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { info } from "@binders/client/lib/util/cli";
import { main } from "@binders/binders-service-common/lib/util/process";
import { writeFile } from "fs/promises";

const SCRIPT_NAME = "Dump a raw binder straight from elastic";

const program = new Command();

program
    .name(SCRIPT_NAME)
    .description("This script will create a JSON file with the raw binder data from elastic")
    .option("-b, --binderId <binderId>", "The binder ID to dump")
    .option("-p, --path <path>", "Path where the data will be stored", "/tmp/binder.json")

async function getElasticRepository(): Promise<[ElasticRepository, string]> {
    const bindersConfig = BindersConfig.get();
    const repoConfig = ElasticRepositoryConfigFactory.build(bindersConfig, [RepositoryConfigType.Binders]);
    const logger = LoggerBuilder.fromConfig(bindersConfig, "dumpBinder");
    return [new ElasticRepository(repoConfig, logger), repoConfig.indexName as string];
}

main(async () => {
    program.parse(process.argv);
    const { binderId, path } = program.opts();
    info(`Dumping binder with ID ${binderId} to ${path}`);
    const [repo, indexName] = await getElasticRepository();
    const binderHit = await repo.runGet(indexName, binderId);
    if (!binderHit) {
        throw new Error(`Binder with ID ${binderId} not found`);
    }
    await writeFile(path, JSON.stringify(binderHit));
})