/* eslint-disable no-console */
import { Binder } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { DefaultESQueryBuilderHelper } from "../../repositoryservice/esquery/helper";
import { ElasticBindersRepository } from "../../repositoryservice/repositories/binderrepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";

const getOptions = () => {
    return {
        dryRun: process.argv.length > 2 && process.argv[2] === "--dry-run",
    };
};

const SCRIPT_NAME = "oneOffRemoveJsonProp";
const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config, SCRIPT_NAME);

const fixedBinders = [];

export async function removeJsonProp(
    esHit: { _source: Binder },
): Promise<{ changed: boolean; esHit }> {
    const chunked = esHit._source?.modules?.text?.chunked;
    if (chunked == null) return { esHit, changed: false };
    let changed = false;
    for (const chunksWrapper of chunked) {
        if (chunksWrapper.json) {
            // remove json prop
            delete chunksWrapper.json;
            changed = true;
        }
    }
    return { changed, esHit };
}

function getProcessBatch(repo: ElasticBindersRepository) {
    return async (batch) => {
        for (let i = 0; i < batch.length; i++) {
            const { changed, esHit } = await removeJsonProp(batch[i]);
            if (changed) {
                const binder = repo.binderFromESHit(esHit)
                fixedBinders.push(binder);
            }
        }
    }
}

(async () => {
    const { dryRun } = getOptions();
    const repo = new ElasticBindersRepository(config, logger, new DefaultESQueryBuilderHelper(config));
    const query = {
        index: repo.getIndexName(),
        body: {
            query: {
                nested: {
                    path: "modules.text.chunked",
                    query: {
                        bool: {
                            must: [
                                {
                                    exists: {
                                        field: "modules.text.chunked.json"
                                    }
                                }
                            ]
                        }
                    }
                }
            }
        }
    };
    await repo.runScroll(query, 3000, 100, getProcessBatch(repo));
    if (fixedBinders.length > 0) {
        if (!dryRun) {
            await repo.bulk(fixedBinders, [], true);
        }
        logger.info(`${dryRun ? "would have " : ""}removed json prop in ${fixedBinders.length} binders`, SCRIPT_NAME);
    } else {
        logger.info("No matching binders found.", SCRIPT_NAME);
    }
})().then(() => { console.log("Done."); process.exit(0); });