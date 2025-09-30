/* eslint-disable no-console */
import { Logger, LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { Binder } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { DefaultESQueryBuilderHelper } from "../../repositoryservice/esquery/helper";
import { ElasticBindersRepository } from "../../repositoryservice/repositories/binderrepository";
import { attemptToFixImagesWithoutId } from "./attemptToFixImagesWithoutId";
import { main } from "@binders/binders-service-common/lib/util/process";

const SCRIPT_NAME = "fix-corrupt-binders";
const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config, SCRIPT_NAME);

const fixedBinders = [];


function getOptions() {
    const isCronJob = process.argv[2] === "cron";
    const binderId = process.argv[3];
    return {
        isCronJob,
        binderId,
    }
}

abstract class BinderFix {
    constructor(protected logger: Logger) {

    }
    abstract shouldFix(error, esHit);
    abstract fix({ esHit, changed });

    maybeFix(error, { esHit, changed }) {
        if (this.shouldFix(error, esHit)) {
            return this.fix({ esHit, changed })
        }
        return { esHit, changed };
    }
}

class EmptyEditorStatesFixer extends BinderFix {
    shouldFix(error) {
        return error?.message?.match(/undefined supplied to \/modules\/text\/chunked\/[0-9]+\/editorStates/);
    }

    fix({ esHit }) {
        this.logger.info(`Fixing ${esHit["_id"]} (Empty Editor State)`, SCRIPT_NAME);
        const source = esHit["_source"];
        const textModules = source.modules.text.chunked;
        for (let i = 0; i < textModules.length; i++) {
            const textModule = textModules[i];
            const newEditorStates = textModule.editorStates || [];
            for (let j = 0; j < textModule.chunks.length; j++) {
                newEditorStates[j] = newEditorStates[j] || this.getEditorState();
            }
            textModule.editorStates = newEditorStates;
        }
        return { esHit, changed: true };
    }

    getEditorState() {
        return JSON.stringify(null);
    }
}

class WrongImageUrlFixer extends BinderFix {
    shouldFix(error) {
        return error?.message?.match(/supplied to \/modules\/images\/chunked\/[0-9]+\/chunks\/[0-9]+\/[0-9]+\/[0-9]+\/url/);
    }

    fix({ esHit }) {
        this.logger.info(`Fixing ${esHit["_id"]} (Wrong Image URL)`, SCRIPT_NAME);
        const source = esHit["_source"];
        source.bindersVersion = "0.4.0";
        return { esHit, changed: true };
    }
}

class FixChunkCountMissmatch extends BinderFix {
    shouldFix(error) {
        return error?.message?.match(/Detected diff in number of chunks across modules/)
    }

    fix({ esHit }) {
        const binder = esHit["_source"] as Binder;
        this.logger.info(`Fixing ${esHit["_id"]} (Chunk Count)`, SCRIPT_NAME);
        const { text: { chunked: textModules }, images: { chunked: imageModules } } = binder.modules;
        const textChunkLengths = textModules.map(tm => tm.chunks.length);
        const imageChunkLengths = imageModules.map(im => im.chunks.length);
        const maxChunkCount = Math.max(...textChunkLengths, ...imageChunkLengths);
        for (let i = 0; i < textModules.length; i++) {
            const chunkCount = textModules[i].chunks.length;
            if (chunkCount < maxChunkCount) {
                for (let x = chunkCount; x < maxChunkCount; x++) {
                    binder.modules.text.chunked[i].chunks.push([]);
                }
            }
            if (Array.isArray(textModules[i].json)) {
                const jsonCount = textModules[i].json.length;
                if (jsonCount < maxChunkCount) {
                    for (let x = jsonCount; x < maxChunkCount; x++) {
                        binder.modules.text.chunked[i].json.push("");
                    }
                }
            }
        }
        for (let i = 0; i < imageModules.length; i++) {
            const chunkCount = imageModules[i].chunks.length;
            if (chunkCount < maxChunkCount) {
                for (let x = chunkCount; x < maxChunkCount; x++) {
                    binder.modules.images.chunked[i].chunks.push([]);
                }
            }
        }
        return { esHit, changed: true };
    }
}

class BlobImageFixer extends BinderFix {

    shouldFix(error) {
        // eslint-disable-next-line no-regex-spaces, quotes
        return error?.message?.includes(`Invalid value {\n  "0": "b",\n  "1": "l",\n  "2": "o",\n  "3": "b",\n  "4": ":"`)
    }

    fix({ esHit }) {
        this.logger.info(`Fixing ${esHit["_id"]} (Blob Image)`, SCRIPT_NAME);
        const binder = esHit["_source"];
        const { images: { chunked: imageModules } } = binder.modules;
        for (let i = 0; i < imageModules.length; i++) {
            const imageChunks = imageModules[i].chunks;
            for (let j = 0; j < imageChunks.length; j++) {
                for (let k = 0; k < imageChunks[j].length; k++) {
                    const image = imageChunks[j][k];
                    if (
                        image["0"] == "b" &&
                        image["1"] == "l" &&
                        image["2"] == "o" &&
                        image["3"] == "b"
                    ) {
                        imageChunks[j].splice(k, 1);
                        k--;
                    }
                }
            }
        }
        return { esHit, changed: true };
    }
}

function getFixedEsHit(logger, error, esHit) {
    const fixers = [
        new WrongImageUrlFixer(logger),
        new EmptyEditorStatesFixer(logger),
        new FixChunkCountMissmatch(logger),
        new BlobImageFixer(logger)
    ];
    return fixers.reduce(
        (acc, fixer) => fixer.maybeFix(error, acc),
        { esHit, changed: false }
    )

}

async function attemptFix(repo: ElasticBindersRepository, logger, error, esHit) {
    const { esHit: fixed, changed } = getFixedEsHit(logger, error, esHit);
    if (changed) {
        const binder = repo.binderFromESHit(fixed);
        fixedBinders.push(binder);
    } else {
        logger.error("Corrupt binder:" + JSON.stringify(esHit, null, 4), SCRIPT_NAME);
        logger.logException(error, SCRIPT_NAME);
    }
}


let corruptBinders = 0;
function getProcessBatch(repo: ElasticBindersRepository, logger) {
    return async (batch) => {
        for (let i = 0; i < batch.length; i++) {
            let increasedCorruptBinders = false;
            try {
                repo.binderFromESHit(batch[i])
            } catch (err) {
                corruptBinders++;
                increasedCorruptBinders = true;
                logger.info(`Attempting to fix binder ${batch[i]?._id}`, SCRIPT_NAME)
                await attemptFix(repo, logger, err, batch[i]);
            }
            const { changed, esHit } = await attemptToFixImagesWithoutId(batch[i], logger);
            if (changed) {
                if (!increasedCorruptBinders) corruptBinders++;
                const binder = repo.binderFromESHit(esHit)
                fixedBinders.push(binder);
            }
        }
    }
}

// Fix editorstates properly "{}" is not a good value
//
main(async () => {
    const { isCronJob, binderId } = getOptions();
    const repo = new ElasticBindersRepository(config, logger, new DefaultESQueryBuilderHelper(config));
    const query = {
        index: repo.getIndexName(),
        ...(binderId ?
            {
                body: {
                    query: {
                        term: {
                            _id: binderId,
                        }
                    }
                }
            } :
            {}),
    };
    await repo.runScroll(query, 3000, 100, getProcessBatch(repo, logger));
    if (corruptBinders > 0) {
        const suffix = isCronJob ? "" : ", updating...";
        logger.info(`Found ${fixedBinders.length} fixed binders${suffix}`, SCRIPT_NAME);
        if (isCronJob) {
            logger.info(`Triggering cronjob failure, ${corruptBinders} corrupt binders found...`, SCRIPT_NAME);
            process.exit(1);
        }
        if (fixedBinders.length > 0) {
            await repo.bulk(fixedBinders, [], true);
            logger.info(`Fixed ${fixedBinders.length} out of ${corruptBinders} corrupt binders`, SCRIPT_NAME);
        }
    } else {
        logger.info("No corrupt binders found.", SCRIPT_NAME);
    }
});