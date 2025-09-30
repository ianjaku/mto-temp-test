import { AncestorItem, Ancestors } from "@binders/client/lib/ancestors";
import { CollectionFilter, DocumentCollection } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { difference, uniq } from "ramda";
import { CollectionRepository } from "../repositories/collectionrepository";
import { Map } from "immutable";
import { Maybe } from "@binders/client/lib/monad";
import { RedisClient } from "@binders/binders-service-common/lib/redis/client";

export abstract class AncestorBuilder {

    async getAncestors(
        docIds: string[],
        ancestorsFound: Ancestors = new Ancestors()
    ): Promise<Ancestors> {
        const parents = await this.getParents(docIds);
        if (parents.isEmpty()) {
            return parents;
        }
        const newDocumentIds = parents.difference(ancestorsFound);
        const topLevelItemIds = difference(docIds, parents.keys());
        let newAncestors = ancestorsFound;
        topLevelItemIds.forEach( topLevelDocId => {
            newAncestors = newAncestors.addElement(topLevelDocId, []);
        });
        let nextIds: string[] = [];
        if (newDocumentIds.length > 0) {
            newDocumentIds.forEach( newParentId => {
                newAncestors = newAncestors.addElement(newParentId, parents.get(newParentId));
                nextIds = nextIds.concat(
                    parents.get(newParentId).map(dp => dp.id)
                );
            });
            if (nextIds.length > 0) {
                return this.getAncestors(nextIds, newAncestors);
            }
        }
        return newAncestors;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    flushCache(docId: string): Promise<void> {
        return Promise.resolve(undefined);
    }

    abstract getParents(docIds: string[]): Promise<Ancestors>;
}


export class CachingAncestorBuilder extends AncestorBuilder {

    private static readonly KEY_PREFIX = "doc-anc-";
    private static readonly CACHE_VERSION = 3;
    private inMemoryCache: {[key: string] : string};


    constructor(
        private readonly wrappedBuilder: AncestorBuilder,
        private readonly redisClient: RedisClient,
    ) {
        super();
        this.inMemoryCache = {};
    }

    private async readParentsFromCache(docIds: string[]): Promise<Array<Maybe<AncestorItem[]>>> {
        if (docIds.length === 0) {
            return [];
        }
        const keys = docIds.map(id => this.toRedisKey(id));
        const notInMemoryKeys = [];
        const values = [];
        for (const index in keys) {
            const key = keys[index];
            if (key in this.inMemoryCache) {
                values.push(this.inMemoryCache[key]);
            } else {
                values.push(null);
                notInMemoryKeys.push({key, index});
            }
        }
        const redisKeys = notInMemoryKeys.map( ({key}) => key);
        if (redisKeys.length > 0) {
            const redisValues = await this.redisClient.mget(...redisKeys);
            for (const redisIndex in redisValues) {
                const arrayIndex = notInMemoryKeys[redisIndex].index;
                const redisKey = redisKeys[redisIndex];
                const redisValue = redisValues[redisIndex];
                if (redisValue !== null) {
                    this.inMemoryCache[redisKey] = redisValue;
                }

                values[arrayIndex] = redisValue;
            }
        }

        // tslint:disable-next-line:no-null-keyword
        return values.map( value => value !== null ?
            Maybe.just(JSON.parse(value)) :
            Maybe.nothing<AncestorItem[]>()
        );
    }

    async flushCache(docId: string): Promise<void> {
        const key = this.toRedisKey(docId);
        await this.redisClient.del(key);
        delete this.inMemoryCache[key];
    }

    private toRedisKey(documentKey: string) {
        return `${CachingAncestorBuilder.KEY_PREFIX}${CachingAncestorBuilder.CACHE_VERSION}-${documentKey}`;
    }

    private async writeParentsToCache(toWrite: Ancestors ): Promise<void> {
        const keyValueList = [];
        toWrite
            .keys()
            .forEach(key => {
                const valueToCache = toWrite.get(key);
                if (! valueToCache) {
                    throw new Error(`Will not write null for key ${key}`);
                }
                const redisKey = this.toRedisKey(key);
                const value = JSON.stringify(valueToCache);
                this.inMemoryCache[redisKey] = value;
                keyValueList.push(redisKey);
                keyValueList.push(value);
            });
        await this.redisClient.mset(...keyValueList);
    }


    async getParents(docIdsWithDuplicates: string[]): Promise<Ancestors> {
        const docIds = uniq(docIdsWithDuplicates);
        let newAncestors: Ancestors = new Ancestors({});
        const uncachedDocIds = [];
        const cachedValues = await this.readParentsFromCache(docIds);
        cachedValues.forEach( (cachedValue, index) => {
            if (cachedValue.isJust() ) {
                newAncestors = newAncestors.addElement(docIds[index], cachedValue.get());
            }
            else {
                uncachedDocIds.push(docIds[index]);
            }
        });
        if (uncachedDocIds.length === 0) {
            return newAncestors;
        }
        const newlyFetched = await this.wrappedBuilder.getParents(uncachedDocIds);
        await this.writeParentsToCache(newlyFetched);
        return newAncestors.merge(newlyFetched);
    }
}

export class ElasticAncestorBuilder extends AncestorBuilder {

    constructor(private readonly collectionRepository: CollectionRepository) {
        super();
    }

    async getParents(docIds: string[]): Promise<Ancestors> {
        const filter: CollectionFilter = {
            itemIds: docIds,
            softDelete: {
                show: "show-all"
            }
        };
        const options = { maxResults: 2000 };
        const collections = await this.collectionRepository.findCollections(filter, options);
        return this.buildAncestorsFromCollections(docIds, collections);
    }

    private buildAncestorsFromCollections(docIds: string[], collections: DocumentCollection[]): Ancestors {
        return docIds.reduce(
            (reduced, docId) => this.updateAncestorsSingleDocument(reduced, docId, collections),
            new Ancestors({})
        );
    }

    private updateAncestorsSingleDocument(ancestors: Ancestors, docId: string, collections: DocumentCollection[]): Ancestors {
        if (ancestors.has(docId)) {
            return ancestors;
        }
        // TODO: only when using deleted
        const documentAncestors = collections
            .filter(collection => {
                return collection.elements.some(el => el.key === docId) ||
                    collection.deletedElements?.some(el => el.key === docId)
            })
            .map(collection => ({
                id: collection.id,
                isHidden: collection.isHidden,
                isDeleted: collection.deletionTime != null,
                showInOverview: collection.showInOverview
            }));

        return ancestors.addElement(docId, documentAncestors);
    }
}

export type FakeTree = Map<string, AncestorItem[]>;

export class MemoryAncestorBuilder extends AncestorBuilder {

    constructor(private tree: FakeTree) {
        super();
    }

    getParents(docIds: string[]): Promise<Ancestors> {
        const parents = docIds.reduce( (reduced, docId) => {
            const docParents = this.tree.get(docId) || [];
            return docParents ? reduced.addElement(docId, docParents) : reduced;
        }, new Ancestors({}) );
        return Promise.resolve(parents);
    }
}

export class PrefetchingAncestorBuilder extends AncestorBuilder {

    private inMemoryCache: {[key: string]: AncestorItem[]};

    constructor(private mab: AncestorBuilder) {
        super();
        this.inMemoryCache = {};
    }

    async getParents(docIds: string[]): Promise<Ancestors> {
        const items = {};
        const toFetch = [];
        docIds.forEach(docId => {
            if (docId in this.inMemoryCache) {
                items[docId] = this.inMemoryCache[docId];
            } else {
                toFetch.push(docId);
            }
        });

        const extra = await this.mab.getParents(toFetch);
        const extraItems = extra.getItems();

        for (const itemId in extraItems) {
            items[itemId] = extraItems[itemId];
            this.inMemoryCache[itemId] = extraItems[itemId];
        }
        return new Ancestors(items);
    }
}
