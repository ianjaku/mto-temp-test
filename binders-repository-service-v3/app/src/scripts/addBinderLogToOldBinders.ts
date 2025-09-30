/* eslint-disable no-console */
import { create as createBinder, update as updateBinder } from "@binders/client/lib/binders/custom/class";
import { Binder } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { DefaultESQueryBuilderHelper } from "../repositoryservice/esquery/helper";
import { ElasticBindersRepository } from "../repositoryservice/repositories/binderrepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { patchBinderLogForOldBinder } from "@binders/client/lib/binders/patching";

const configKey = "elasticsearch.clusters.binders";
const config = BindersConfig.get();
const elasticConfig = config.getObject(configKey);
if (elasticConfig.isNothing()) {
    console.error(`Missing ES client config: ${configKey}`);
    process.abort();
}
const logger = LoggerBuilder.fromConfig(config);
const queryBuilderHelper = new DefaultESQueryBuilderHelper(config);

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

const updateBinderLogEntriesScroll = (bindersRepo: ElasticBindersRepository) => {
    const upgradeBatch = async (batch: Binder[]) => {
        for (const binder of batch) {
            try {
                const binderObj = createBinder(binder);
                const logPatch = patchBinderLogForOldBinder(binderObj);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const updatedBinder = updateBinder(binderObj, () => [logPatch], false) as any;
                await bindersRepo.updateBinder(updatedBinder.toJSON());
            } catch (e) {
                console.log("error upgrading binder: ", binder.id);
                console.log("error:", e.message);
            }
        }
    };

    const updateBinderLogEntries = async (batch, i) => {
        const outdatedBinders = batch.filter(binder => binder !== undefined && binder.binderLog === undefined);
        if (outdatedBinders.length) {
            console.log(`Binders without log found in batch ${i}:`, outdatedBinders.map(({ id }) => id).join(","));
            await upgradeBatch(outdatedBinders);
        }
    };

    let i = 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return async (esBatch: any[]) => {
        const batch = esBatch.map(itemFromESHit);
        await updateBinderLogEntries(batch, i);
        i++;
    };
}

const doIt = async () => {
    const binderRepo = new ElasticBindersRepository(config, logger, queryBuilderHelper);
    const query = {
        index: binderRepo.getIndexName(),
        body: { query: { match_all: {} } },
        // body: { query: { term: { "accountId": "aid-def10c64-0faf-4357-a7a0-ad50234a8a3e"}}},
    };
    await binderRepo.runScroll(query, 600, 50, updateBinderLogEntriesScroll(binderRepo));
};

doIt()
    .then(() => {
        console.log("All done!");
        process.exit(0);
    },
    error => {
        console.log("!!! Something went wrong.");
        console.error(error);
        process.exit(1);
    });