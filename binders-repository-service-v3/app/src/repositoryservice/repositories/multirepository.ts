import {
    Binder,
    BinderFilter,
    BinderSearchResultOptions,
    DocumentCollection,
    ICollectionElementsWithInfo,
    Item,
    ItemBatchFilterProcess,
    ItemFilterFunction,
    ItemFilterProcess,
    Ownership,
    Publication,
    PublicationAndCollectionFilter,
    PublicationFilter,
    Story
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    DEFAULT_BATCH_SIZE,
    DEFAULT_SCROLL_AGE,
    ESHit,
    ElasticRepository,
    ElasticRepositoryConfigFactory,
    REPO_CONFIGS_BY_TYPE,
    RepositoryConfigType
} from "@binders/binders-service-common/lib/elasticsearch/elasticrepository";
import { NonExistingItem, ServerSideSearchOptions } from "../model";
import {
    applyBatchItemFilters,
    applyItemFilters
} from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { flatten, uniq } from "ramda";
import {
    isBinderItem,
    isCollectionItem,
    isPublicationItem
} from "@binders/client/lib/clients/repositoryservice/v3/validation";
import { BulkBuilder } from "@binders/binders-service-common/lib/elasticsearch/bulkbuilder";
import { Config } from "@binders/client/lib/config/config";
import { ESQueryBuilder } from "../esquery/builder";
import { ESQueryBuilderHelper } from "../esquery/helper";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { filterPublicationsByLanguages } from "../repositoryfilters";
import { resolveKindFromIndex } from "../../elastic";

export type ProcessScrollBatch = (esBatch: Array<Binder | DocumentCollection>) => Promise<void>;
export type OwnershipProvider = (ownership: Ownership) => Ownership;

export interface MultiRepository {
    getIndexesNames(types: RepositoryConfigType[]): string[]
    getBinderOrCollection(id: string): Promise<Binder | DocumentCollection>;
    getItemsById(ids: string[]): Promise<Array<Binder | DocumentCollection>>;
    searchItemsViaScroll(
        filter: BinderFilter | PublicationFilter,
        searchOptions: BinderSearchResultOptions,
        processBatch: ProcessScrollBatch
    ): Promise<void>;
    findItems(
        filter: BinderFilter | PublicationFilter,
        searchOptions: BinderSearchResultOptions,
        postFilter?: (binder: Binder | DocumentCollection) => Promise<boolean>,
    ): Promise<Array<Binder | DocumentCollection>>;
    findPublicationsAndCollections(filter: BinderFilter, searchOptions: BinderSearchResultOptions, domainCollectionId: string,
        postFilter: (binder: Publication | DocumentCollection) => Promise<boolean>): Promise<Array<Publication | DocumentCollection>>;
    getPublicationsAndCollectionsWithInfo(filter: BinderFilter, searchOptions: BinderSearchResultOptions,
        domainCollectionId: string): Promise<ICollectionElementsWithInfo>;
    transformScrollItemsResults(results, filters: ItemFilterFunction<Story>[]): Promise<Array<Binder | DocumentCollection>>
    deleteAllForAccount(accountId: string): Promise<void>;
    updateOwnershipForItemsOwnedBy(ownerId: string, ownershipProvider: OwnershipProvider, accountId: string): Promise<void>;
}

export class ElasticMultiRepository extends ElasticRepository implements MultiRepository {

    pubColIndexName: string | Array<string>;

    constructor(private readonly config: Config, logger: Logger, private readonly queryBuilderHelper: ESQueryBuilderHelper) {
        super(ElasticRepositoryConfigFactory.build(config, [RepositoryConfigType.Binders, RepositoryConfigType.Collections]), logger);
        const collectionsAndPublicationsRepositoryConfig = ElasticRepositoryConfigFactory.build(config, [RepositoryConfigType.Pulbications, RepositoryConfigType.Collections])
        this.pubColIndexName = collectionsAndPublicationsRepositoryConfig.aliasedIndexName
    }

    getIndexesNames(types: RepositoryConfigType[]): string[] {
        const { aliasedIndexName } = ElasticRepositoryConfigFactory.build(this.config, types)
        return aliasedIndexName as string[];
    }

    async getBinderOrCollection(id: string): Promise<Binder | DocumentCollection> {
        const query = ESQueryBuilder.queryById(this.repoConfig.aliasedIndexName, id);
        return this.runSearch<Array<Binder | DocumentCollection>>(query)
            .then(matches => {
                if (matches.length === 0) {
                    return Promise.reject(new NonExistingItem(id));
                }
                if (matches.length > 1) {
                    return Promise.reject(new Error(`Ambigious id: ${id}`));
                }
                return Promise.resolve(matches[0]);
            });
    }

    async transformScrollItemsResults(results: Array<Binder | DocumentCollection>, filters: ItemFilterFunction<Story>[]): Promise<Array<Binder | DocumentCollection>> {
        this.logger.trace(`Found ${results.length} matching items`, "es-stats");
        const filteredHits = await this.filterHits(results, filters)
        this.logger.trace(`Kept ${filteredHits.length} hits after filtering`, "es-stats");
        return filteredHits;
    }

    async searchItemsViaScroll(filter: BinderFilter, searchOptions: BinderSearchResultOptions, processBatch: (esBatch: Array<Binder | DocumentCollection>) => Promise<void>): Promise<void> {
        const scrollAge = 3600
        const batchSize = 100
        const serverSearchOptions: ServerSideSearchOptions = Object.assign({}, searchOptions, { binderIdField: "_id" });
        const indexNames = this.getIndexesNames([RepositoryConfigType.Binders, RepositoryConfigType.Collections])

        const query = await ESQueryBuilder.fromBinderOrPublicationFilter(
            indexNames, filter, serverSearchOptions, this.queryBuilderHelper, undefined, this.logger);
        await this.runScroll(query, scrollAge, batchSize, processBatch);
    }

    async getItemsById(ids: string[]): Promise<Array<Binder | DocumentCollection>> {
        const indexNames = this.getIndexesNames([RepositoryConfigType.Binders, RepositoryConfigType.Collections])
        const query = ESQueryBuilder.queryByIds(indexNames, ids);
        return await this.runSearch<Array<Binder | DocumentCollection>>(query);
    }

    private async filterHits(hits, filters: ItemFilterFunction<Story>[]) {
        let filteredHits = [];
        const itemFilterFunctions = {
            batch: filters.filter(({ batchProcessing }) => batchProcessing).map(({ process }) => process) as ItemBatchFilterProcess<Story>[],
            nonBatch: filters.filter(({ batchProcessing }) => !batchProcessing).map(({ process }) => process) as ItemFilterProcess<Story>[],
        }
        if (itemFilterFunctions.batch.length > 0) {
            const itemsFromESHits = hits.map(hit => this.itemFromESHit(hit));
            filteredHits = await applyBatchItemFilters(itemFilterFunctions.batch, itemsFromESHits)
        }

        if (itemFilterFunctions.nonBatch.length > 0) {
            for await (const fullItem of filteredHits) {
                const isAllowed = await applyItemFilters(itemFilterFunctions.nonBatch, fullItem);
                if (!isAllowed) {
                    filteredHits = filteredHits.filter(item => item.id !== fullItem.id);
                }
            }
        }

        return filteredHits
    }

    private itemsFromESHits(results, searchOptions?: BinderSearchResultOptions): Array<Binder | DocumentCollection> {
        this.logger.trace(`Found ${results.hits.hits.length} matching items`, "es-stats");
        return results.hits.hits.map(esHit => this.itemFromESHit(esHit, searchOptions));
    }

    private itemFromESHit(esHit,  searchOptions?: BinderSearchResultOptions) {
        let item = esHit["_source"];
        item.id = esHit["_id"];
        item.kind = resolveKindFromIndex(esHit["_index"])
        if (item.kind === "document" && searchOptions && searchOptions.omitContentModules) {
            item = {
                ...item,
                modules: {
                    meta: item.modules.meta
                }
            };
        }
        return item;
    }


    async deleteAllForAccount(accountId: string): Promise<void> {
        const indexes = uniq(flatten([this.pubColIndexName, this.repoConfig.aliasedIndexName]) as string[]);
        const query = ESQueryBuilder.deleteAllForAccount(indexes, accountId);
        await this.deleteByQuery(query);
    }

    async findItems(
        filter: BinderFilter | PublicationFilter,
        searchOptions: BinderSearchResultOptions,
        postFilter?: (binder: Binder | DocumentCollection) => Promise<boolean>,
    ): Promise<Array<Binder | DocumentCollection>> {
        const serverSearchOptions: ServerSideSearchOptions = Object.assign({}, searchOptions, { binderIdField: "_id" });
        const query = await ESQueryBuilder.fromBinderOrPublicationFilter(this.repoConfig.aliasedIndexName,
            filter, serverSearchOptions, this.queryBuilderHelper, undefined, this.logger);
        const transform = this.itemsFromESHits.bind(this);
        const items = await this.runQuery<Array<Binder | DocumentCollection>>(query, results => transform(results, searchOptions));
        return this.applyPostFilter(items, postFilter);
    }

    async findPublicationsAndCollections(
        filter: PublicationAndCollectionFilter,
        searchOptions: BinderSearchResultOptions,
        domainCollectionId: string,
        postFilter: (binder: Publication | DocumentCollection) => Promise<boolean> = () => Promise.resolve(true)
    ): Promise<Array<Publication | DocumentCollection>> {
        const query = ESQueryBuilder.fromPublicationAndCollectionFilter(this.pubColIndexName,
            filter, searchOptions, domainCollectionId);
        // eslint-disable-next-line @typescript-eslint/ban-types
        const boundItemTransform = this.itemsFromESHits.bind(this);
        const transform = async r => boundItemTransform(r);
        let items = await this.runQuery(query, transform);
        if (filter.preferredLanguages) {
            const publications = items.filter(i => i["kind"] === "publication") as Array<Publication>;
            const collections = items.filter(i => i["kind"] === "collection") as Array<DocumentCollection>;
            const sortedPublications = filterPublicationsByLanguages(publications, filter.preferredLanguages);
            const collectionsWithElements = collections.filter(c => !c.elements || c.elements.length > 0);
            items = [
                ...sortedPublications,
                ...collectionsWithElements,
            ];
        }
        return this.applyPostFilter(items, postFilter);
    }

    private async applyPostFilter<T>(items: T[], shouldAdd?: (i: T) => Promise<boolean>): Promise<T[]> {
        if (!shouldAdd) {
            return items;
        }
        const collector: T[] = [];
        for (const item of items) {
            if (await shouldAdd(item)) {
                collector.push(item);
            }
        }
        return collector;
    }

    async getPublicationsAndCollectionsWithInfo(
        filter: PublicationAndCollectionFilter,
        searchOptions: BinderSearchResultOptions,
        domainCollectionId: string,
        preparePostFilter: (items: Array<Publication | DocumentCollection>) => Promise<void> = () => Promise.resolve()
    ): Promise<ICollectionElementsWithInfo> {
        const query = ESQueryBuilder.fromPublicationAndCollectionFilter(
            this.pubColIndexName,
            filter,
            searchOptions,
            domainCollectionId,
        );
        const boundItemFromHits = this.itemsFromESHits.bind(this);
        const transform = async r => boundItemFromHits(r);
        let items = await this.runQuery<Array<Story>>(query, transform);

        const { publications, collections, languagesUsed } = items.reduce(({ publications, collections, languagesUsed }, item) => {
            let langCodes = [];
            if (item["kind"] === "publication") {
                const publication = item as Publication;
                publications.push(publication);
                langCodes = [publication.language.iso639_1];
            } else if (item["kind"] === "collection") {
                const collection = item as DocumentCollection;
                if (collection.hasPublications) {
                    collections.push(collection);
                    langCodes = collection.titles.map(t => t.languageCode);
                } else {
                    langCodes = [];
                }
            }
            languagesUsed = uniq([...languagesUsed, ...langCodes]);
            return { publications, collections, languagesUsed };
        }, { publications: [] as Publication[], collections: [] as DocumentCollection[], languagesUsed: [] as string[] });
        const filteredPublications = filterPublicationsByLanguages(publications, filter.preferredLanguages || []);
        const collectionsWithElements = collections.filter(c => !c.elements || c.elements.length > 0);

        items = [
            ...filteredPublications as Story[],
            ...collectionsWithElements as Story[],
        ];
        await preparePostFilter(items);
        return {
            items,
            languagesUsed,
        };
    }

    async updateOwnershipForItemsOwnedBy(ownerId: string, ownershipProvider: OwnershipProvider, accountId: string): Promise<void> {
        const query = await ESQueryBuilder.buildItemsWithOwnerFilter(this.repoConfig.aliasedIndexName, ownerId, accountId);

        const processBatch = async (esHitsBatch: ESHit<Binder | DocumentCollection>[]): Promise<void> => {
            let bulkBuilder = new BulkBuilder([]);
            for (const esHit of esHitsBatch) {
                const { indexName } = ElasticMultiRepository.repoConfigurationForESHit(esHit);
                const newOwnership = ownershipProvider(esHit._source.ownership);
                bulkBuilder = bulkBuilder.addUpdate(
                    indexName,
                    esHit._id,
                    newOwnership ? { ownership: newOwnership } : {}
                );
            }
            await this.runBulk(bulkBuilder, { ignoreDuplicates: true });
        };
        await this.runScroll(query, DEFAULT_SCROLL_AGE, DEFAULT_BATCH_SIZE, processBatch);
    }

    private static repoConfigurationForESHit<T>(hit: ESHit<T>) {
        let repoConfigType: RepositoryConfigType;
        if (ElasticMultiRepository.isCollectionHit(hit)) {
            repoConfigType = RepositoryConfigType.Collections;
        } else if (ElasticMultiRepository.isBinderHit(hit)) {
            repoConfigType = RepositoryConfigType.Binders;
        } else if (ElasticMultiRepository.isPublicationHit(hit)) {
            repoConfigType = RepositoryConfigType.Pulbications;
        } else {
            throw new Error(`Unknown hit type: ${JSON.stringify(hit)}`);
        }
        return REPO_CONFIGS_BY_TYPE[repoConfigType];
    }

    private static isCollectionHit<T>(hit: ESHit<T>): boolean {
        return isCollectionItem(hit._source as unknown as Item);
    }

    private static isBinderHit<T>(hit: ESHit<T>): boolean {
        return isBinderItem(hit._source as unknown as Item);
    }

    private static isPublicationHit<T>(hit: ESHit<T>): boolean {
        return isPublicationItem(hit._source as unknown as Item);
    }
}



