import { IndexDefinition, IndexesDiff, buildName } from "./model";
import { MongoRepositoryDocument, getFactories } from "../factoryRegistry";
import { MongoRepositoryFactory } from "../repository";
import { getChar } from "../../util/stdin";
import { isProduction } from "@binders/client/lib/util/environment";
import { log } from "../../util/process";
import sleep from "../../util/sleep";

async function waitForFactories()  {
    const factories = getFactories();
    for( const factory of factories) {
        let attempts = 0;
        while (!factory.hasConnected()) {
            attempts++;
            if (attempts > 100) {
                throw new Error(`Factory for collection ${factory.collection.name} did not connect in time`);
            }
            await sleep(100);
        }
    }
    return factories;
}

async function printDiff(factory: MongoRepositoryFactory<MongoRepositoryDocument>): Promise<IndexesDiff> {
    log(`Checking collection ${factory.collection.name}`);
    const diff = await factory.diffIndexes();

    if (diff.status === "error") {
        log("!!! Could not determine diff");
        return undefined;
    }
    if (diff.status === "collection_missing") {
        log("!!! Collection not found")
        return undefined;
    }
    const diffDetails = diff.details;
    if (diffDetails.toCreate.length + diffDetails.toDrop.length === 0) {
        log("No problems here.");
        return undefined;
    }

    log("Diff:");
    log(JSON.stringify(diffDetails, null, 4));
    return diffDetails;
}


export async function syncIndices(forceDelete = false): Promise<void> {
    if (isProduction()) {
        return syncIndicesProduction(forceDelete);
    }
    return syncIndicesStaging();
}

async function syncIndicesStaging() {
    const factories = await waitForFactories();
    for (const factory of factories) {
        try {
            await factory.createCollection();
        } catch (exc) {
            log(`Could not create collection ${factory.collection.name}`);
            log(`Error: ${exc.message}`);
        }
        await factory.syncIndexes();
    }
}

async function syncIndicesProduction(forceDelete: boolean) {
    const factories = await waitForFactories();
    for (const factory of factories) {
        const diff = await printDiff(factory);
        if (diff) {
            const char = await getChar(`Proceed with syncing indices for collection ${factory.collection.name} (y/q/*)`);
            if (char === "y") {
                if (forceDelete) {
                    for (const td of diff.toDrop.map(x => x.options.name)) {
                        try {
                            log(`Dropping index ${td}`);
                            await factory.dropIndex(td);
                        } catch (err) {
                            log(`Error while dropping ${err.message}`);
                        }
                    }
                }
                await factory.syncIndexes();
            } else {
                if (char === "q") {
                    log("Quitting script...");
                    process.exit(0);
                }
                log("Sync aborted...");
            }
        }
    }
}

export function filterPrimaryKeyIndex(ix: IndexDefinition): boolean {
    const name = buildName(ix.fields);
    return name != "_id_1";
}