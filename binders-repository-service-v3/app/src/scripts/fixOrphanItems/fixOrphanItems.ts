/**
* Do not run this file as a script, instead run the index file in the same folder.
*/
/* eslint-disable no-console */
import {
    AncestorBuilder,
    CachingAncestorBuilder,
    ElasticAncestorBuilder
} from  "../../repositoryservice/ancestors/ancestorBuilder";
import {
    BackendAccountServiceClient,
    BackendRepoServiceClient,
    BackendRoutingServiceClient
} from  "@binders/binders-service-common/lib/apiclient/backendclient";
import {
    Binder,
    DocumentAncestors,
    DocumentCollection
} from  "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    addCollectionElement,
    removeCollectionElement
} from  "../../repositoryservice/patching/collections";
import { countCollectionElements, countDaysSinceDeletion, isDeleted } from "./itemHelpers";
import { logFixCountForAccount, logItem, printLogs } from "./logging";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { DefaultESQueryBuilderHelper } from "../../repositoryservice/esquery/helper";
import { ElasticBindersRepository } from "../../repositoryservice/repositories/binderrepository";
import {
    ElasticCollectionsRepository
} from  "../../repositoryservice/repositories/collectionrepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { RedisClientBuilder } from "@binders/binders-service-common/lib/redis/client";
import {
    UnCachedBackendAuthorizationServiceClient
} from  "@binders/binders-service-common/lib/authorization/backendclient";
import { countBinderChunks } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { forEveryItemInAccount } from "./forEveryItemInAccount";

const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config);

const SCRIPT_NAME = "fixOrphanedItems.ts";
const ITEMS_DELETED_BY = "script";

type Item = DocumentCollection | Binder;

export interface FixOrphanItemsOptions {
    isDryRun: boolean;
    accountIds?: string[]
}


let collectionRepo: ElasticCollectionsRepository | null = null;
const createCollectionRepository = () => {
    if (collectionRepo == null) {
        collectionRepo = new ElasticCollectionsRepository(
            config,
            logger,
            new DefaultESQueryBuilderHelper(config)
        );
    }
    return collectionRepo;
}

let binderRepository: ElasticBindersRepository | null = null;
const createBinderRepository = () => {
    if (binderRepository == null) {
        binderRepository = new ElasticBindersRepository(
            config,
            logger,
            new DefaultESQueryBuilderHelper(config)
        );
    }
    return binderRepository;
}

const isConnectedToRoot = (itemId: string, rootCollectionId: string, ancestors: DocumentAncestors): boolean => {
    if (itemId === rootCollectionId) return true;
    const parents = ancestors[itemId];
    if (parents == null) return false;
    return parents.some(p => isConnectedToRoot(p, rootCollectionId, ancestors));
}

const findItemAncestors = async (items: Item[]) => {
    const repoClient = await BackendRepoServiceClient.fromConfig(config, SCRIPT_NAME);
    return await repoClient.getItemsAncestors(items.map(item => item.id as string));
}

export const findOrphans = async (rootCollectionId: string, items: Item[]): Promise<Item[]> => {
    const ancestors = await findItemAncestors(items);
    const orphans: Item[] = [];
    for (const item of items) {
        if (item.id === rootCollectionId) continue;
        if (!isConnectedToRoot(item.id as string, rootCollectionId, ancestors)) {
            orphans.push(item);
        }
    }
    return orphans;
}

const isCollection = (item: Item): item is DocumentCollection => {
    return "elements" in item;
}

const getFixOrphansInstructions = async (items: Item[]) => {
    const toPermDelete: Item[] = [];
    const toSoftDelete: Item[] = [];
    const toAddToRoot: Item[] = [];

    const toPermDeleteIdsSet = new Set<string>();
    for (const item of items) {
        if (!isCollection(item) && countBinderChunks(item) <= 1) {
            toPermDelete.push(item);
            toPermDeleteIdsSet.add(item.id);
            logItem(item, ["HardDelete"], "Binder has only one chunk");
        } else if (isCollection(item) && countCollectionElements(item, toPermDeleteIdsSet, true) <= 0) {
            toPermDelete.push(item);
            toPermDeleteIdsSet.add(item.id);
            logItem(item, ["HardDelete"], "Collection has no elements (or all elements are set to be removed)");
        } else if (isDeleted(item) && countDaysSinceDeletion(item) >= 180) {
            toPermDelete.push(item);
            toPermDeleteIdsSet.add(item.id);
            logItem(item, ["HardDelete"], "Item was deleted more than 180 days ago");
        } else if (isDeleted(item) && countDaysSinceDeletion(item) < 180) {
            toAddToRoot.push(item);
            logItem(item, ["addToRoot"], "Item was deleted fewer than 180 days ago");
        } else {
            toSoftDelete.push(item);
            toAddToRoot.push(item);
            logItem(item, ["addToRoot", "SoftDelete"], "None of the delete conditions were met");
        }
    }

    return {
        toPermDelete,
        toSoftDelete,
        toAddToRoot
    }
}

export const addSoftDeletedItemToRootCollection = async (
    rootCollectionId: string, 
    items: Item[]
): Promise<void> => {
    if (items.length === 0) return;

    let rootCollection = await createCollectionRepository().getCollection(rootCollectionId);
    for (const item of items) {
        const type = isCollection(item) ? "collection" : "document";
        rootCollection = addCollectionElement(rootCollection, type, item.id);
        rootCollection = removeCollectionElement(rootCollection, type, item.id, false);
    }
    await createCollectionRepository().updateCollection(rootCollection);
}

const removeChildFromParents = async (item: Item, permanent: boolean) => {
    const client = await BackendRepoServiceClient.fromConfig(config, SCRIPT_NAME);
    const parentCollections = await client.findCollections({ itemIds: [item.id] }, { maxResults: 100 });

    for (const collection of parentCollections) {
        const removeCollectionFn = coll => removeCollectionElement(
            coll,
            isCollection(item) ? "collection" : "document",
            item.id,
            permanent
        );
        await createCollectionRepository().patchCollection(collection.id, removeCollectionFn);
    }
}


let _ancestorBuilder: AncestorBuilder = null;
const createAncestorBuilder = () => {
    if (_ancestorBuilder == null) {
        const ancestorRedisClient = RedisClientBuilder.fromConfig(config, "documents");
        const repoAncestorBuilder = new ElasticAncestorBuilder(createCollectionRepository());
        _ancestorBuilder = new CachingAncestorBuilder(repoAncestorBuilder, ancestorRedisClient);
    }
    return _ancestorBuilder;
}

export const deleteItems = async (items: Item[], permanent: boolean): Promise<void> => {
    if (items.length === 0) return;
    for (const item of items) {
        await removeChildFromParents(item, permanent);

        if (isCollection(item)) {
            await createCollectionRepository().deleteCollection(item.id, permanent, ITEMS_DELETED_BY);
        } else {
            await createBinderRepository().deleteBinder(item, permanent, ITEMS_DELETED_BY);
        }

        if (permanent && !isCollection(item)) {
            const routingClient = await BackendRoutingServiceClient.fromConfig(config, SCRIPT_NAME);
            await routingClient.deleteSemanticLinks({ binderId: item.id });
        }

        // Has to be the uncached client so redis doesn't stay open during tests
        const authClient = await UnCachedBackendAuthorizationServiceClient.fromConfig(config, SCRIPT_NAME);
        await authClient.removeResourceFromAcls(item.id);

        await createAncestorBuilder().flushCache(item.id);
    }
}

/**
 * @returns the number of orphans fixed
 */
export const fixOrphanItemsBatch = async (
    items: Item[],
    rootCollectionId: string,
    options: FixOrphanItemsOptions
): Promise<number> => {
    const orphans = await findOrphans(rootCollectionId, items);
    if (orphans.length === 0) return 0;

    const {
        toPermDelete,
        toSoftDelete,
        toAddToRoot
    } = await getFixOrphansInstructions(orphans);

    if (!options.isDryRun) {
        await addSoftDeletedItemToRootCollection(rootCollectionId, toAddToRoot);
        await deleteItems(toSoftDelete, false);
        await deleteItems(toPermDelete, true);
    }

    return orphans.length;
}

const fetchAccountsInfo = async () => {
    const accountClient = await BackendAccountServiceClient.fromConfig(config, SCRIPT_NAME);
    const accounts = await accountClient.listAccounts();
    return accounts.map(acc => ({ id: acc.id, name: acc.name }));
}

const findRootCollection = async (accountId: string) => {
    const repoClient = await BackendRepoServiceClient.fromConfig(config, SCRIPT_NAME);
    const rootColls = await repoClient.getRootCollections([accountId]);
    if (rootColls.length === 0) {
        return null;
    }
    return rootColls[0];
}

export const fixOrphanItemsForAccount = async (
    accountId: string,
    accountName: string,
    options: FixOrphanItemsOptions
): Promise<number> => {
    const rootCollection = await findRootCollection(accountId);
    if (rootCollection == null) {
        console.log(`Account ${accountName} has no root collection.`);
        return 0;
    }

    let fixedOrphanCount = 0;
    await forEveryItemInAccount(accountId, async (items) => {
        const fixedCount = await fixOrphanItemsBatch(items, rootCollection.id, options);
        fixedOrphanCount += fixedCount;
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    return fixedOrphanCount;
}

export const fixOrphanItems = async (
    options: FixOrphanItemsOptions = { isDryRun: false }
): Promise<void> => {
    if (options.isDryRun) {
        console.log("\nRunning in dry run mode. No changes will be made.\n");
    } else {
        console.log("\n!!Running in live mode!!\n");
    }
    if (options.accountIds) {
        console.log("Only fixing accouts:", options.accountIds.join(", "), "\n");
    } else {
        console.log("Fixing ALL accounts\n");
    }
    
    const accountsInfo = await fetchAccountsInfo();

    for (let i = 0; i < accountsInfo.length; i ++) {
        const accountInfo = accountsInfo[i];
        if (options.accountIds && !options.accountIds.includes(accountInfo.id)) {
            continue;
        }
        console.log(`[${i+1}/${accountsInfo.length}] starting account ${accountInfo.name}`);
        const fixedCount = await fixOrphanItemsForAccount(accountInfo.id, accountInfo.name, options);
        logFixCountForAccount(accountInfo.id, accountInfo.name, fixedCount);
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    printLogs();
}
