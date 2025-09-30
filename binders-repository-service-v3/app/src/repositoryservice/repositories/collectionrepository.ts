import {
    BinderSearchResultOptions,
    CollectionElement,
    CollectionElementMap,
    CollectionFilter,
    CollectionSearchResult,
    CollectionTitle,
    DocumentCollection,
    IDescendantsMap,
    IThumbnail,
    ItemBatchFilterProcess,
    ItemFilterFunction,
    ItemFilterProcess,
    isBatchItemFilterFunction,
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    ElasticRepository,
    ElasticRepositoryConfigFactory,
    RepositoryConfigType
} from "@binders/binders-service-common/lib/elasticsearch/elasticrepository";
import {
    applyBatchItemFilters,
    applyItemFilters
} from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { buildGlobalUrlMap, getUrlTranslation } from "./helpers";
import { mergeRight, omit } from "ramda";
import {
    BackendImageServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BulkBuilder } from "@binders/binders-service-common/lib/elasticsearch/bulkbuilder";
import { Config } from "@binders/client/lib/config/config";
import { ESQueryBuilder } from "../esquery/builder";
import { ESQueryBuilderHelper } from "../esquery/helper";
import { InvalidCollection } from "../model";
import {
    InvalidatorManager
} from "@binders/binders-service-common/lib/cache/invalidating/invalidators";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { UNDEFINED_LANG } from "@binders/client/lib/util/languages";
import { createNewCollection } from "../patching/collections";
import { subMilliseconds } from "date-fns";

type ESHit = { [key: string]: unknown };

export interface CollectionRepository {
    createCollection(
        accountId: string,
        title: CollectionTitle,
        thumbnail: IThumbnail,
        isRoot: boolean,
        domainCollectionId: string): Promise<DocumentCollection>;
    patchCollection(
        collectionId: string,
        update: (coll: DocumentCollection) => DocumentCollection
    ): Promise<DocumentCollection>;
    updateCollection(collection: DocumentCollection): Promise<DocumentCollection>;
    getCollection(collectionId: string): Promise<DocumentCollection>;
    getCollectionsElements(collectionsIds: string[]): Promise<CollectionElementMap>;
    findCollections(filter: CollectionFilter, searchOptions: BinderSearchResultOptions, postFilter?: ItemFilterFunction<DocumentCollection>): Promise<Array<DocumentCollection>>;
    searchCollections(queryString: string, searchOptions: BinderSearchResultOptions, filter: CollectionFilter, postfilter?: ItemFilterFunction<DocumentCollection>): Promise<CollectionSearchResult>;
    deleteCollection(
        collectionId: string,
        permanent?: boolean,
        deletedById?: string,
        deletedGroupCollectionId?: string,
        deletedGroupCount?: number
    ): Promise<DocumentCollection>;
    permanentlyDeleteGroups(deletedGroupCollectionId: string[]): Promise<void>;
    hardDeleteCollection(collectionId: string): Promise<DocumentCollection>;
    getIdsOfMultiElements(elementKeys: Array<string>): Promise<Array<string>>;
    countCollections(accountId: string): Promise<number>;
    multisetFlag(collectionIds: string[], flagName: string, flagValue: boolean): Promise<void>;
    duplicateCollectionWithoutElements(toDuplicate: DocumentCollection): Promise<DocumentCollection>;
    buildDescendantsMap(collectionId: string | string[], omitRoot?: boolean): Promise<IDescendantsMap>;
    recursivelyGetDescendants(collectionId: string | string[], omitRoot?: boolean): Promise<{ [key: string]: boolean }>;
    searchCollectionViaScroll(queryString: string, searchOptions: BinderSearchResultOptions, filter: CollectionFilter, processBatch: (esBatch: unknown) => Promise<boolean>): Promise<void>
    recoverCollection(toRecover: DocumentCollection): Promise<DocumentCollection>;
    getItemsToPurge(msBeforePurge: number): Promise<DocumentCollection[]>;
    getMostUsedLanguages(accountIds: string[]): Promise<Record<string, number>>;
}



export class ElasticCollectionsRepository extends ElasticRepository implements CollectionRepository {

    private invalidator = new InvalidatorManager();

    constructor(config: Config, logger: Logger, private readonly queryBuilderHelper: ESQueryBuilderHelper) {
        super(ElasticRepositoryConfigFactory.build(config, [RepositoryConfigType.Collections]), logger);
    }

    countCollections(accountId: string): Promise<number> {
        const query = {
            query: {
                bool: {
                    must: {
                        term: {
                            accountId
                        }
                    },
                    must_not: {
                        exists: {
                            field: "deletionTime"
                        }
                    }
                }
            }
        };
        return this.runCount(this.getIndexName(), query);
    }

    private async collectionSearchResultFromESHits(results, filters: ItemFilterFunction<DocumentCollection>[]) {
        this.logger.trace(`Found ${results.hits.hits.length} matching collections`, "es-stats");
        const hits = results.hits.hits;
        const filteredHits = await this.filterHits(hits, filters)
        this.logger.trace(`Kept ${filteredHits.length} hits after filtering`, "es-stats");
        return {
            totalHitCount: filteredHits.length,
            hits: filteredHits
        };
    }

    private async filterHits(hits: ESHit[], filters: ItemFilterFunction<DocumentCollection>[]) {
        const { batchFilters, nonBatchFilters } = this.partitionFiltersByBatchType(filters);

        const itemsFromESHits = hits.map(this.collectionFromESHit);
        const filteredHits = await applyBatchItemFilters(batchFilters, itemsFromESHits);

        const esHitsById = Object.fromEntries(
            filteredHits.map(({ id }) => [id, hits.find(hit => hit._id === id)])
        );

        const result = [];
        for await (const collection of filteredHits) {
            const isAllowed = await applyItemFilters(nonBatchFilters, collection);
            if (!isAllowed) {
                continue;
            }
            const { score, inner_hits: innerHits } = esHitsById[collection.id];
            const fieldHits = this.toFieldHits(innerHits);
            result.push({
                collection,
                score,
                fieldHits
            });
        }
        return result;
    }

    private partitionFiltersByBatchType<T>(
        filters: ItemFilterFunction<T>[]
    ): { batchFilters: ItemBatchFilterProcess<T>[], nonBatchFilters: ItemFilterProcess<T>[] } {
        const batchFilters: ItemBatchFilterProcess<T>[] = [];
        const nonBatchFilters: ItemFilterProcess<T>[] = [];
        for (const filter of filters) {
            if (isBatchItemFilterFunction(filter)) {
                batchFilters.push(filter.process);
            } else {
                nonBatchFilters.push(filter.process);
            }
        }
        return { batchFilters, nonBatchFilters };
    }

    private toFieldHits(innerHits: unknown) {
        const fieldHits = [];
        const nestedFields = Object.keys(innerHits);
        for (const nestedField of nestedFields) {
            const innerHitMatches = innerHits[nestedField].hits.hits;
            innerHitMatches.forEach(innerHitMatch => {
                if (innerHitMatch.highlight) {
                    const highlightFields = Object.keys(innerHitMatch.highlight);
                    for (const highlightField of highlightFields) {
                        fieldHits.push({
                            field: highlightField,
                            contexts: innerHitMatch.highlight[highlightField],
                            languageCode: innerHitMatch?._source?.languageCode
                        });
                    }
                }
            });
        }
        return fieldHits;
    }

    async searchCollections(
        queryString: string,
        searchOptions: BinderSearchResultOptions,
        filter: CollectionFilter,
        postFilter?: ItemFilterFunction<DocumentCollection>,
        logger?: Logger,
    ): Promise<CollectionSearchResult> {
        const query = await ESQueryBuilder.searchCollectionsQuery(
            this.getIndexName(),
            queryString,
            filter,
            searchOptions,
            this.queryBuilderHelper,
            logger,
        );
        const extendedQuery = searchOptions.showIsHidden ? query : ESQueryBuilder.addNotHiddenFilter(query);
        const filters = postFilter ? [postFilter] : [];

        const transform = async rawResults => this.collectionSearchResultFromESHits(rawResults, filters);
        const searchResult = await this.runQuery<CollectionSearchResult>(extendedQuery, transform);
        return this.filterDeletedFromSearchResult(searchResult);
    }

    async searchCollectionViaScroll(
        queryString: string,
        searchOptions: BinderSearchResultOptions,
        filter: CollectionFilter,
        processBatch: (esBatch: unknown) => Promise<boolean>
    ): Promise<void> {
        const scrollAge = 3600
        const batchSize = 100
        const query = await ESQueryBuilder.searchCollectionsQuery(
            this.getIndexName(),
            queryString,
            filter,
            searchOptions,
            this.queryBuilderHelper,
        );
        const extendedQuery = searchOptions.showIsHidden ? query : ESQueryBuilder.addNotHiddenFilter(query);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await this.runScroll(extendedQuery, scrollAge, batchSize, async esBatch => {
            await processBatch(esBatch)
        });
    }

    async createCollection(
        accountId: string,
        title: CollectionTitle,
        thumbnail: IThumbnail,
        isRoot: boolean,
        domainCollectionId: string
    ): Promise<DocumentCollection> {
        const dao = createNewCollection(accountId, title, thumbnail, isRoot, domainCollectionId);
        const id = await this.insert(dao);
        return { ...dao, id };
    }

    async patchCollection(
        collectionId: string,
        update: (coll: DocumentCollection) => DocumentCollection
    ): Promise<DocumentCollection> {
        const collection = await this.getCollection(collectionId);
        const toStore = update(collection);
        return await this.updateCollection(toStore);
    }

    async updateCollection(toUpdate: DocumentCollection): Promise<DocumentCollection> {
        const dao = Object.assign({
            id: toUpdate.id,
            lastModified: new Date()
        }, toUpdate);
        const result = await this.update(dao);
        await this.invalidator.onUpdate([{
            name: "collection",
            collectionId: toUpdate.id
        }]);
        return result;
    }

    private collectionFromESHit(esHit: ESHit): DocumentCollection {
        const collection = esHit["_source"] as { [key: string]: unknown };
        return {
            ...collection,
            id: esHit["_id"],
        } as DocumentCollection;
    }

    private collectionsFromESHits(results) {
        return results.hits.hits.map(this.collectionFromESHit);
    }

    getCollection(collectionId: string): Promise<DocumentCollection> {
        this.logger.debug(`Getting collection ${collectionId}`, "es-stats");
        return this.runGet<DocumentCollection>(this.getIndexName(), collectionId);
    }

    private collectionElementMapFromESHits(results): CollectionElementMap {
        return results.hits.hits.reduce((out, hit) => {
            out[hit._id] = hit._source.elements || [];
            return out;
        }, {});
    }

    async getCollectionsElements(collectionsIds: string[]): Promise<CollectionElementMap> {
        this.logger.debug(`Getting collections elements ${collectionsIds}`, "es-stats");
        if (!collectionsIds || collectionsIds.length === 0) {
            return Promise.resolve({})
        }
        const searchIds = ESQueryBuilder.maybeDivideIdsIntoMultipleTerms(collectionsIds, "_id")
        const source = "elements.*"
        const searchOptions = { maxResults: 2000 };
        const baseQuery = ESQueryBuilder.baseQueryWithSource(
            this.getIndexName(),
            searchIds,
            source,
            searchOptions,
        );
        const transform = async results => this.collectionElementMapFromESHits(results);
        return this.runQuery<CollectionElementMap>(baseQuery, transform);
    }

    async deleteCollection(
        collectionId: string,
        permanent?: boolean,
        deletedById?: string,
        deletedGroupCollectionId?: string,
        deletedGroupCount?: number
    ): Promise<DocumentCollection> {
        const toDelete = await this.getCollection(collectionId);
        if (toDelete == null) return toDelete;
        if (permanent) {
            await this.invalidator.onDelete([{
                name: "collection",
                collectionId: toDelete.id
            }]);
            await this.delete(collectionId);
            return toDelete;
        }
        const dao = mergeRight(toDelete, {
            id: collectionId,
            deletionTime: new Date(),
            deletedById,
            deletedGroupCollectionId,
            deletedGroupCount
        });
        return await this.update(dao);
    }

    async getMostUsedLanguages(accountIds: string[]): Promise<Record<string, number>> {
        const query = {
            index: this.getIndexName(),
            body: {
                "query": {
                    "terms": {
                        "accountId": accountIds
                    }
                },
                "size": 0,
                "aggs": {
                    "mostUsed": {
                        "terms": {
                            "field": "titles.languageCode",
                            "size": 200
                        }
                    }
                }
            }
        }
        const languages = {};
        await this.runQuery(query, async result => {
            const buckets = result?.aggregations?.mostUsed?.buckets || [];
            buckets.forEach(b => {
                if (b.key !== UNDEFINED_LANG) {
                    languages[b.key] = b.doc_count;
                }
            });
        });

        return languages;
    }

    async permanentlyDeleteGroups(deletedGroupCollectionId: string[]): Promise<void> {
        const query = {
            index: this.getIndexName(),
            body: {
                query: {
                    bool: {
                        must: {
                            terms: {
                                deletedGroupCollectionId
                            }
                        }
                    }
                }
            }
        }
        await this.deleteByQuery(query);
    }

    async hardDeleteCollection(collectionId: string): Promise<DocumentCollection> {
        const collection = await this.getCollection(collectionId);
        await this.invalidator.onDelete([{
            name: "collection",
            collectionId: collection.id
        }]);
        await this.delete(collectionId);
        return collection;
    }

    async recoverCollection(toRecover: DocumentCollection): Promise<DocumentCollection> {
        const dao = {
            ...toRecover,
            deletionTime: null,
            deletedById: null,
            deletedGroupCollectionId: null,
            deletedGroupCount: null
        }
        return await this.update(dao);
    }

    async findCollections(
        collectionFilter: CollectionFilter,
        searchOptions: BinderSearchResultOptions,
        postFilter?: ItemFilterFunction<DocumentCollection>,
    ): Promise<DocumentCollection[]> {
        const query = await ESQueryBuilder.fromCollectionFilter(
            this.getIndexName(),
            collectionFilter,
            searchOptions,
            this.queryBuilderHelper,
        );

        const transform = this.collectionsFromESHits.bind(this);
        this.logger.debug("Running query to find collections", "es-stats");
        const collections = await this.runQuery<DocumentCollection[]>(query, transform);
        this.logger.debug(`Found ${collections.length} matching collections`, "es-stats");
        if (collectionFilter.pruneEmpty) {
            return collections.filter(
                collection => (
                    collection.elements.length > 0 &&
                    collection.deletedElements.length > 0
                )
            );
        }
        const resultCollections: DocumentCollection[] = postFilter ?
            (await applyBatchItemFilters([postFilter.process as ItemBatchFilterProcess<DocumentCollection>], collections)) :
            collections;

        return resultCollections;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types
    multiOccurencesFromAggregatedESHits(results: any, elementKeys: Array<string>, aggregationField: string): Array<string> {
        const buckets = results.aggregations[aggregationField].buckets;
        const multiElementIds = elementKeys.reduce((reduced, key) => {
            const bucket = buckets[key];
            const { doc_count: occurencesAsElement, count: { elementCount: { buckets: elementBuckets } } } = bucket;
            let isMulti;
            if (occurencesAsElement === 1) {
                const elementBucket = elementBuckets.find(b => b.key === key);
                const allElementOccurences = elementBucket ? elementBucket.doc_count : 1;
                isMulti = allElementOccurences > 1;
            } else {
                isMulti = occurencesAsElement > 0;
            }
            return reduced.concat(...(isMulti ? [key] : []));
        }, []);
        return multiElementIds;
    }

    async getIdsOfMultiElements(elementKeys: Array<string>): Promise<Array<string>> {
        if (elementKeys.length === 0) {
            return Promise.resolve([])
        }
        const aggregationField = "multiple_occurence_keys";
        const query = await ESQueryBuilder.buildCountByElementQuery(
            this.getIndexName(),
            elementKeys,
            aggregationField
        );
        const transform = this.multiOccurencesFromAggregatedESHits.bind(this);
        return this.runQuery<Array<string>>(query, (results) => transform(results, elementKeys, aggregationField));
    }

    async multisetFlag(collectionIds: string[], flagName: string, flagValue: boolean): Promise<void> {
        const bulkBuilder = collectionIds.reduce(
            (builder, collectionId) => {
                return builder.addUpdate(
                    this.getIndexName() as string,
                    collectionId,
                    { [flagName]: flagValue }
                )
            }, new BulkBuilder([])
        );
        await this.runBulk(bulkBuilder, { ignoreDuplicates: true });
    }

    async duplicateCollectionWithoutElements(toDuplicate: DocumentCollection): Promise<DocumentCollection> {
        const { id } = toDuplicate;
        if (!id) {
            throw new InvalidCollection(["Cannot duplicate. Missing 'id' field."]);
        }
        let newId;
        toDuplicate = { ...toDuplicate, elements: [], hasPublications: false };

        try {
            const { config } = this.repoConfig;
            newId = await this.duplicate({ ...toDuplicate, id });
            const imageClient = await BackendImageServiceClient.fromConfig(config, "images");
            const visuals = await imageClient.duplicateVisuals(id, newId);
            const globalUrlMap = buildGlobalUrlMap(visuals);
            const thumbnailUrl = toDuplicate.thumbnail.medium;
            const updatedThumbnailUrl = thumbnailUrl ?
                getUrlTranslation(thumbnailUrl, globalUrlMap) :
                thumbnailUrl;
            const toUpdate = { ...toDuplicate, id: newId, elements: [] };
            toUpdate.thumbnail.medium = updatedThumbnailUrl;
            return this.update(toUpdate);
        } catch (error) {
            if (newId) {
                await this.hardDeleteCollection(newId);
            }
            this.logger.error("Could not duplicate collection", "duplicate-collection", error);
            throw error;
        }
    }


    private collectionElementAndDeletedElementMapFromESHits(results): CollectionElementMap {
        return results.hits.hits.reduce((out, hit) => {
            // TODO: consider separate props, can be helpful elements and deletedElements
            out[hit._id] = [...(hit._source.elements || []), ...(hit._source.deletedElements || [])];
            return out;
        }, {});
    }


    async getCollectionElementsAndDeletedElements(collectionsIds: string[]): Promise<CollectionElementMap> {
        this.logger.debug(`Getting collections elements and deleted elements ${collectionsIds}`, "es-stats");
        if (!collectionsIds || collectionsIds.length === 0) {
            return Promise.resolve({})
        }
        const searchIds = ESQueryBuilder.maybeDivideIdsIntoMultipleTerms(collectionsIds, "_id")
        const source = ["elements.*", "deletedElements.*"]
        const searchOptions = { maxResults: 2000 };
        const baseQuery = await ESQueryBuilder.baseQueryWithSource(
            this.getIndexName(),
            searchIds,
            source,
            searchOptions,
        );
        const transform = async r => this.collectionElementAndDeletedElementMapFromESHits(r);
        return this.runQuery<CollectionElementMap>(baseQuery, transform);
    }

    async recursivelyGetDescendants(collectionId: string | string[], omitRoot = false): Promise<{ [key: string]: boolean }> {
        const descendantsLevelMap = await this.buildDescendantsMap(collectionId, omitRoot, this.getCollectionElementsAndDeletedElements);
        const allElementsInArray = Object.keys(descendantsLevelMap).reduce((prev, k) => {
            return [...prev, ...descendantsLevelMap[k].map(({ key }) => key)];
        }, []);

        return allElementsInArray.reduce((prev, el) => {
            prev[el] = true;
            return prev;
        }, {});

    }

    async buildDescendantsMap(
        collectionId: string | string[],
        omitRoot = false,
        getCollectionFunction?: (coldIds: string[]) => Promise<CollectionElementMap>
    ): Promise<IDescendantsMap> {
        let getCollectionsElements = this.getCollectionsElements;
        if (getCollectionFunction && typeof getCollectionFunction === "function") {
            getCollectionsElements = getCollectionFunction;
        }

        let firstDescendants: CollectionElement[] = [];
        if (Array.isArray(collectionId)) {
            firstDescendants = collectionId.map(id => ({ kind: "collection", key: id }));
        } else {
            firstDescendants = [{ kind: "collection", key: collectionId }];
        }

        const descendants: IDescendantsMap = { [0]: firstDescendants };

        async function accumulateDescendants(
            collectionElements: CollectionElement[],
            lvl: number
        ): Promise<IDescendantsMap> {
            const elementsMap = await getCollectionsElements(collectionElements.map(el => el.key));
            const elements = Object.keys(elementsMap).reduce((acc, colId) => [...acc, ...elementsMap[colId]], []);
            const colElements = elements.filter(el => el.kind === "collection");
            return {
                ...descendants,
                ...(elements.length ?
                    {
                        [lvl]: elements,
                    } :
                    []),
                ...(colElements.length ?
                    {
                        ...(await accumulateDescendants(colElements, lvl + 1))
                    } :
                    [])
            };
        }

        const descendantsMap = await accumulateDescendants(firstDescendants, 1);
        return omitRoot ?
            omit(["0"], descendantsMap) :
            descendantsMap;
    }

    async getItemsToPurge(msBeforePurge: number): Promise<DocumentCollection[]> {
        const cutoff = subMilliseconds(new Date(), msBeforePurge);
        const query = {
            index: this.getIndexName(),
            body: {
                query: {
                    range: {
                        deletionTime: { lte: cutoff.toISOString() }
                    }
                }
            },
            size: 9999
        };
        return this.runQuery(query, this.collectionsFromESHits.bind(this))
    }

    private filterDeletedFromSearchResult(
        searchResult: CollectionSearchResult
    ): CollectionSearchResult {
        const newHits = searchResult.hits.filter(hit => hit.collection.deletionTime == null)
        return { ...searchResult, hits: newHits };
    }
}
