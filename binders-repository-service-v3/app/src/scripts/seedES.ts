/* eslint-disable no-console */
import * as elastic from "@elastic/elasticsearch";
import * as fs from "fs";
import { Binder } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { DefaultESQueryBuilderHelper } from "../repositoryservice/esquery/helper";
import { ElasticBindersRepository } from "../repositoryservice/repositories/binderrepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { createNewBinder } from "@binders/client/lib/binders/create";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require("path");

const DEFAULT_BINDER_PARAMS = {
    accountId: "aid-20fac188-7a97-458b-b186-b2a3511b3b78",
    languageCode: "nl",
    title: "Binder title",
    editorState: "test"
};

function createTestBinders(): Binder[] {
    const binderParams = DEFAULT_BINDER_PARAMS;
    const testBinders = [];
    for (let i = 1; i < 11; i++) {
        testBinders.push(createNewBinder(binderParams.accountId, binderParams.languageCode, `${binderParams.title} ${i}`, binderParams.editorState));
    }
    const binder = createNewBinder(binderParams.accountId, binderParams.languageCode, `${binderParams.title} AVeKtMLvv4leLVo6N1Iw`, binderParams.editorState);
    binder.id = "AVeKtMLvv4leLVo6N1Iw";
    testBinders.push(binder);
    testBinders.push(createNewBinder(binderParams.accountId, binderParams.languageCode, "cappuccino", binderParams.editorState));

    return testBinders;
}

function getMapping(mappingFileName) {
    const mappingFile = fs.realpathSync(path.join(__dirname, `../migrations/mappings/${mappingFileName}.json`));
    if (mappingFile == undefined) {
        console.log(`!!! Could not find mapping file for type ${mappingFileName}.`);
        process.abort();
    }
    return JSON.parse(fs.readFileSync(mappingFile, "utf-8"));
}

const elasticConfigKey = "elasticsearch.clusters.binders";
const config = BindersConfig.get();

const elasticConfig = config.getObject(elasticConfigKey);
if (elasticConfig.isNothing()) {
    console.error(`Missing ES client config: ${elasticConfigKey}`);
    process.abort();
}
const client = new elastic.Client(Object.assign({}, elasticConfig.get()));

const doPurge = process.argv.indexOf("--purge") !== -1;

const bulk = [];
const mapping = getMapping("binder");
const queryBuilderHelper = new DefaultESQueryBuilderHelper(config);
const logger = LoggerBuilder.fromConfig(config, "seedEs")
const repo = new ElasticBindersRepository(config, logger, queryBuilderHelper)
const indexName = repo.getIndexName()
for (const testBinder of createTestBinders()) {
    bulk.push(
        { create: { _index: repo.getIndexName(), _id: testBinder.id } },
        testBinder
    );
}

doSeed(doPurge).then(
    () => process.exit(0),
    (err) => {
        console.error(err);
        process.exit(1);
    }
);

async function doSeed(doPurge: boolean) {
    if (doPurge) {
        await client.indices.delete({index: "_all"});
        console.log("Existing indices purged...")
    }
    await client.indices.create({ index: indexName });
    await client.indices.putMapping({ index: indexName, body: mapping });
    await client.bulk({ body: bulk });
    console.log("Seed finished.");
}