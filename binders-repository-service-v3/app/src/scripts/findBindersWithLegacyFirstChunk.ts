/* eslint-disable no-console */
import { Binder } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Command } from "commander";
import { DefaultESQueryBuilderHelper } from "../repositoryservice/esquery/helper";
import { ElasticBindersRepository } from "../repositoryservice/repositories/binderrepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { bold } from "@binders/client/lib/util/cli";
import { create as createBinder } from "@binders/client/lib/binders/custom/class";
import { log } from "@binders/binders-service-common/lib/util/process"

const SCRIPTNAME = "findBindersWithLegacyFirstChunk";

const program = new Command();

program
    .name(SCRIPTNAME)
    .description("Find binders with legacy first chunk (i.e. First chunk is a h1 of the publication title)")
    .version("0.1.0")
    .option("-a, --account-id [account ID]", "ID of the account to perform the search in")

program.parse(process.argv);
const options = program.opts();

if (!options.quiet) {
    log(JSON.stringify(options, null, 2));
}

type Result = {
    title: string;
    langCode: string;
    binderId: string;
    accountId: string;
}

const results: Result[] = [];

async function doIt() {
    const configKey = "elasticsearch.clusters.binders";
    const config = BindersConfig.get();
    const elasticConfig = config.getObject(configKey);
    if (elasticConfig.isNothing()) {
        console.error(`Missing ES client config: ${configKey}`);
        process.abort();
    }
    const logger = LoggerBuilder.fromConfig(config);
    const queryBuilderHelper = new DefaultESQueryBuilderHelper(config);
    const binderRepo = new ElasticBindersRepository(config, logger, queryBuilderHelper);
    const query = {
        index: binderRepo.getIndexName(),
        body: {
            query: options.accountId ?
                { term: { "accountId": options.accountId } } :
                { match_all: {} }
        },
    };
    await binderRepo.runScroll(query, 600, 50, findBindersWithLegacyFirstChunk());

    console.log();
    if (results.length) {
        console.log(bold(`Found ${results.length} BinderLanguage-s\n`));
        console.log("Account ID".padEnd(40, " "), "Binder ID".padEnd(20), "iso639_1", "\n");
        for (const result of results) {
            console.log(`${result.accountId} ${result.binderId} ${result.langCode}`);
        }
    } else {
        console.log("No binders found");
    }
    console.log();
}

const findBindersWithLegacyFirstChunk = () => {
    const findInBatch = async (batch: Binder[]) => {
        for (const binder of batch) {
            const binderObj = createBinder(binder);
            for (const { iso639_1, modules: [textModuleId] } of binder.languages) {
                const { chunks: langChunks } = binderObj.getTextModuleByLanguageIndex(binderObj.getTextModuleIndex(textModuleId));
                const langTitle = binderObj.getLanguages().at(binderObj.getTextModuleIndex(textModuleId)).storyTitle;
                const firstChunkText = langChunks.at(0)?.at(0);
                if (firstChunkText?.trim() === `<h1>${langTitle.trim()}</h1>`) {
                    console.log(`===> Found binder ${binder.id} in language ${iso639_1} with title ${langTitle}`);
                    results.push({ accountId: binder.accountId, binderId: binder.id, langCode: iso639_1, title: langTitle })
                }
            }
        }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return async (esBatch: any[]) => {
        const batch = esBatch.map(itemFromESHit);
        await findInBatch(batch);
    };
}

const itemFromESHit = (esHit) => {
    const item = esHit["_source"];
    item.id = esHit["_id"];
    const type = esHit["_type"];
    const kind = {
        "collection": "collection",
        "collections": "collection",
        "document": "document",
        "binder": "document",
        "binders": "document",
        "publication": "publication",
    }[type];
    item.kind = kind || "";
    return item;
};

// eslint-disable-next-line no-console
doIt().catch(console.error)
