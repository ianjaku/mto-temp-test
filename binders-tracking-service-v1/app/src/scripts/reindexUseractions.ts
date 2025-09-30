/* eslint-disable no-console */
import { CURRENT_INDEX_PREFIX, PREVIOUS_INDEX_PREFIX } from "../essetup/ensureAliases";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { BulkBuilder } from "@binders/binders-service-common/lib/elasticsearch/bulkbuilder";
import { ElasticUserActionsRepository } from "../trackingservice/repositories/userActionsRepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";

const getOptions = () => {
    return {
        fixAliasOnly : (process.argv[2] === "fix-alias-only")
    }
}

const ROLLOVER_THRESHOLD = 100000;

const doIt = async () => {
    const config = BindersConfig.get();
    const { fixAliasOnly } = getOptions();
    const logger = LoggerBuilder.fromConfig(config, "reindex-useractions");
    const readRepository = new ElasticUserActionsRepository(config, logger);
    const writeRepository = new ElasticUserActionsRepository(config, logger);
    const indices = await readRepository.getAliasedIndices("useractions");
    indices.sort();
    const oldPrefix = PREVIOUS_INDEX_PREFIX;
    const newPrefix = CURRENT_INDEX_PREFIX;
    let reindexedInLatest = 0;
    let writeIndexName;
    const oldPattern = `^${oldPrefix}([0-9]+)$`;
    for (const index of indices) {
        const match = index.match(oldPattern)
        if (match) {
            readRepository.updateIndex(index);
            console.log(`Found an old match ${match[0]}`);
            const docsToReindex = await readRepository.runCount();
            if (docsToReindex === 0) {
                console.log("Index has no docs, just removing the alias");
                await readRepository.removeAlias("useractions");
                continue;
            }
            if (!fixAliasOnly) {
                console.log(`Going to reindex ${docsToReindex} documents`);
                writeIndexName = (!writeIndexName || reindexedInLatest > ROLLOVER_THRESHOLD) ?
                    `${newPrefix}${match[1]}` :
                    writeIndexName;

                writeRepository.updateIndex(writeIndexName);
                reindexedInLatest += docsToReindex;
                await readRepository.runScroll({body: {query: { match_all: {}}}}, 600, 10000, async batch => {
                    if (batch.length === 0) {
                        return;
                    }
                    let builder = new BulkBuilder([]);
                    for (const ua of batch) {
                        builder = builder.addCreate(writeIndexName,  ua["_source"], ua["_id"]);
                    }
                    await writeRepository.runBulk(builder, { ignoreDuplicates: true });
                } );
            }
            console.log("Removing alias.");
            await readRepository.removeAlias("useractions");

        } else {
            console.log(`Skipping --- ${index}`);
        }
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