import {
    Binder,
    BinderFilter,
    BinderFindResult,
    BinderSearchResult,
    BinderSearchResultOptions,
    BinderSummary,
    IBinderVisual,
    ItemBatchFilterProcess,
    ItemFilterFunction,
    ItemFilterProcess,
    LanguageSummary,
    MAXIMUM_NUMBER_OF_ITEMS,
    Publication
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    ElasticRepository,
    ElasticRepositoryConfigFactory,
    RepositoryConfigType
} from "@binders/binders-service-common/lib/elasticsearch/elasticrepository";
import { InvalidBinder, ServerSideSearchOptions } from "../model";
import {
    applyBatchItemFilters,
    applyItemFilters
} from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { buildGlobalUrlMap, getUrlTranslation } from "./helpers";
import {
    BackendImageServiceClient,
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { Config } from "@binders/client/lib/config/config";
import { DuplicatedVisual } from "@binders/client/lib/clients/imageservice/v1/contract";
import { ESQueryBuilder } from "../esquery/builder";
import { ESQueryBuilderHelper } from "../esquery/helper";
import {
    InvalidatorManager
} from "@binders/binders-service-common/lib/cache/invalidating/invalidators";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { PublicationRepository } from "./publicationrepository";
import { UNDEFINED_LANG } from "@binders/client/lib/util/languages";
import { create as createBinderObject } from "@binders/client/lib/binders/custom/class";
import { extractImageIdAndFormatFromUrl } from "@binders/client/lib/clients/imageservice/v1/visuals";
import { getExistingPublicationFilter } from "./helpers";
import hasDraft from "@binders/client/lib/util/hasDraft";
import { omit } from "ramda";
import { subMilliseconds } from "date-fns";

export interface BindersRepository {
    getBinder(binderId: string): Promise<Binder>;
    searchBinders(queryString: string, searchOptions: BinderSearchResultOptions,
        accountId: string, postFilter?: ItemFilterFunction<Binder>, filter?: BinderFilter): Promise<BinderSearchResult>;
    findBinders(filter: BinderFilter, searchOptions: BinderSearchResultOptions): Promise<Array<BinderFindResult>>;
    findPaginatedBindersViaScroll(
        filter: BinderFilter,
        searchOptions: Omit<BinderSearchResultOptions, "maxResults" | "orderBy" | "ascending">,
        pageSize: number,
        pageStartsAt: Date | null,
        permissionFilter: (binders: Binder[]) => Binder[] | Promise<Binder[]>,
    ): Promise<Binder[]>;
    updateBinder(toUpdate: Binder): Promise<Binder>;
    createBinder(toCreate: Binder): Promise<Binder>;
    duplicateBinder(toDuplicate: Binder): Promise<Binder>;
    deleteBinder(
        toDelete: Binder,
        permanent?: boolean,
        deletedById?: string,
        deletedGroupCollectionId?: string
    ): Promise<void>;
    permanentlyDeleteGroups(deletedGroupCollectionId: string[]): Promise<void>;
    recoverBinder(toDelete: Binder): Promise<Binder>;
    countBinders(accountId: string): Promise<number>;
    findBinderIdsByAccount(accountId: string): Promise<string[]>
    searchBindersViaScroll(queryString: string, searchOptions: BinderSearchResultOptions, accountId: string, processBatch: (esBatch: unknown) => Promise<boolean>, filter: BinderFilter): Promise<void>
    transformScrollBindersResults(results, filters: ItemFilterFunction<Binder>[]): Promise<BinderSearchResult>
    getLanguagesUsedInBinders(binderIds: string[]): Promise<LanguageSummary[]>
    getLanguagesUsedInBindersWithPublicationInfo(binderIds: string[], publicationRepository: PublicationRepository): Promise<LanguageSummary[]>;
    getItemsToPurge(msBeforePurge: number): Promise<Binder[]>;
    getMostUsedLanguages(accountIds: string[]): Promise<Record<string, number>>;
    scrollBindersWithFilter(
        filter: BinderFilter,
        processBatch: (binders: Binder[]) => Promise<void>
    ): Promise<void>;
}

export class ElasticBindersRepository extends ElasticRepository implements BindersRepository {

    private invalidator = new InvalidatorManager();

    constructor(config: Config, logger: Logger, private readonly queryBuilderHelper: ESQueryBuilderHelper) {
        super(ElasticRepositoryConfigFactory.build(config, [RepositoryConfigType.Binders]), logger);
    }

    private buildSummary(binder): BinderSummary {
        return {
            id: binder.id,
            accountId: binder.accountId,
            bindersVersion: binder.bindersVersion,
            thumbnail: binder.thumbnail,
            languages: binder.languages,
            showInOverview: binder.showInOverview,
            modules: {
                meta: binder.modules.meta
            },
            deletionTime: binder.deletionTime,
            ancestorIds: binder.ancestorIds,
        };
    }

    binderFromESHit(esHit: Record<string, unknown>): Binder {
        const binder = esHit["_source"] as unknown as Record<string, unknown>;
        binder["id"] = esHit["_id"];
        const authorIdsInHit = binder["authorIds"] as string[] || [];
        binder["authorIds"] = authorIdsInHit ? authorIdsInHit.filter(id => !!id) : [];
        try {
            return createBinderObject(binder).toJSON(true);
        } catch (err) {
            this.logger.logException(err, "invalid-binder");
            throw err;
        }
    }

    private bindersFromESHits(results): Array<Binder> {
        this.logger.trace(`Found ${results.hits.hits.length} matching docs`, "es-stats");
        return results.hits.hits
            .map(h => {
                try {
                    return this.binderFromESHit(h);
                } catch (err) {
                    return undefined;
                }
            })
            .filter(binder => !!binder);
    }

    private binderSummariesFromESHits(results): Array<BinderSummary> {
        this.logger.trace(`Found ${results.hits.hits.length} matching docs`, "es-stats");
        return results.hits.hits.map(esHit => {
            const fullBinder = this.binderFromESHit(esHit);
            return this.buildSummary(fullBinder);
        });
    }

    private getLanguageModuleBy(key: string, val: string, binder: Binder) {
        if (key === "iso639_1") {
            return binder.languages.find(l => l.iso639_1 === val);
        }
        return binder.languages.find(l => l.modules[0] === val);
    }

    private getHighlightContexts(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        esHit: any,
        binder: Binder,
        field: string,
        key: string
    ): { [lang: string]: { [field: string]: string[] } } {
        const innerHitsObj = esHit.inner_hits[field];
        const innerHits = innerHitsObj && innerHitsObj.hits;
        const hits = innerHits && innerHits.hits;
        let lowestPriority = 9999;
        const result = hits.reduce((contextsObj, hit) => {
            const offset = hit._nested && hit._nested.offset;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const searchObjArray = field.split(".").reduce<any[]>((acc, p) => acc && acc[p] || null, binder as any); // returns object at "field" (dot separated path) inside binder
            const searchObj = searchObjArray && searchObjArray[offset];
            const val = searchObj && searchObj[key];
            const isDeleted = binder.modules.meta.filter(m => m.isDeleted).some(m => m[key] === val);
            const languageModule = this.getLanguageModuleBy(key, val, binder);
            const language = languageModule?.iso639_1 || "xx";
            const priority = languageModule && languageModule.priority;
            const highlight = hit.highlight;
            if (!isDeleted) {
                const highlights = highlight ? Object.keys(highlight) : [];
                for (const fld of highlights) {
                    if (contextsObj[language] == null) {
                        contextsObj[language] = {};
                    }
                    const contexts = contextsObj[language][fld] || [];
                    if (priority < lowestPriority) {
                        contextsObj[language][fld] = (highlight[fld]).concat(contexts);
                    } else {
                        contextsObj[language][fld] = (contexts).concat(highlight[fld]);
                    }
                }
                lowestPriority = priority;
            }
            return contextsObj;
        }, {});
        return result;
    }

    private filterSoftDeletedFromESHits(rawResults) {
        const newHits = rawResults.hits.hits.filter(hit => {
            if (hit?._source == null) return true;
            return hit._source.deletionTime == null;
        });
        return {
            took: rawResults.took,
            timed_out: rawResults.timed_out,
            hits: {
                total: newHits.length,
                hits: newHits
            }
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private async binderSearchResultFromESHits(results, filters: ItemFilterFunction<Binder>[], shouldIgnoreHighlight = false): Promise<BinderSearchResult> {
        this.logger.trace(`Found ${results.hits.hits.length} matching docs`, "es-stats");
        const esHits = results.hits.hits;
        const filteredSearchResults = await this.filterHits(esHits, filters)
        this.logger.trace(`Kept ${filteredSearchResults.length} hits after filtering`, "es-stats");
        return {
            totalHitCount: filteredSearchResults.length,
            hits: filteredSearchResults
        }
    }

    async getBinder(binderId: string): Promise<Binder> {
        const validate = this.validateSearchResult.bind(this);
        const transform = (hit: Record<string, unknown>) => this.binderFromESHit(hit);
        const query = ESQueryBuilder.getById(this.getIndexName(), binderId);
        return this.withClient(client => client.get(query))
            .then(r => validate(r.body))
            .then(transform);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
    binderWithLanguageCodesFromEsHit(esHit: any): Binder {
        try {
            const withoutCodes = this.binderFromESHit(esHit);
            this.modifyBinderByDuplicatingIso639_1InChunks(withoutCodes);
            return withoutCodes;
        } catch (err) {
            this.logger.logException(err, "invalid-binder");
            return undefined;
        }
    }

    async searchBinders(
        queryString: string,
        searchOptions: BinderSearchResultOptions,
        accountId: string,
        postFilter?: ItemFilterFunction<Binder>,
        binderFilter?: BinderFilter,
    ): Promise<BinderSearchResult> {
        const query = await this.getSearchBindersQuery(queryString, searchOptions, accountId, binderFilter)
        const filters = postFilter ? [postFilter] : [];
        const shouldIgnoreHighlight = queryString === "*"
        const transform = async rawResults => {
            const filteredResults = this.filterSoftDeletedFromESHits(rawResults);
            const result = await this.binderSearchResultFromESHits(filteredResults, filters, shouldIgnoreHighlight);
            return result;
        };
        return await this.runQuery(query, transform);
    }

    private async getSearchBindersQuery(
        queryString: string,
        searchOptions: BinderSearchResultOptions,
        accountId: string,
        filter?: BinderFilter,
    ) {
        if (filter) {
            const bindersFilter = {
                ...filter,
                accountId
            }
            return ESQueryBuilder.queryStringWithFilter(
                this.getIndexName(),
                queryString,
                bindersFilter,
                searchOptions,
                this.queryBuilderHelper,
                undefined,
                this.logger,
            );
        }
        return ESQueryBuilder.queryString(this.getIndexName(), queryString, accountId, searchOptions)
    }

    countBinders(accountId: string): Promise<number> {

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

    async findBinders(filter: BinderFilter, searchOptions: BinderSearchResultOptions): Promise<Array<BinderFindResult>> {
        const serverSideSearchOptions = {
            ...searchOptions,
            binderIdField: "_id",
        } as ServerSideSearchOptions;
        return ESQueryBuilder.fromBinderOrPublicationFilter(
            this.getIndexName(), filter, serverSideSearchOptions, this.queryBuilderHelper, undefined, this.logger)
            .then(query => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const transform = async (rawResult: any) => {
                    const filteredHits = this.filterSoftDeletedFromESHits(rawResult)
                    if (filter.summary) {
                        return this.binderSummariesFromESHits(filteredHits);
                    } else {
                        return this.bindersFromESHits(filteredHits);
                    }
                };
                return this.runQuery<BinderFindResult[]>(query, transform);
            });
    }

    // Set chunk.iso639_1 to be the same as language.iso639_1
    private modifyBinderByDuplicatingIso639_1InChunks(dao: Binder): void {
        dao.modules.text.chunked = dao.modules.text.chunked.map(chunk => {
            if (chunk.iso639_1 == null) {
                if (dao.modules.meta == null) return chunk;
                const module = dao.modules.meta.find(meta => meta.key === chunk.key);
                if (module == null) return chunk;
                chunk.iso639_1 = module.iso639_1;
            }
            return chunk;
        });
    }

    updateBinder(toUpdate: Binder): Promise<Binder> {
        if (!toUpdate.id) {
            return Promise.reject(new InvalidBinder(["Cannot update. Missing 'id' field."]));
        }
        const dao: Binder = { ...toUpdate };
        this.modifyBinderByDuplicatingIso639_1InChunks(dao);
        return this.update(dao);
    }

    async createBinder(toCreate: Binder): Promise<Binder> {
        const dao: Binder = {
            ...toCreate,
            created: new Date(),
        };
        this.modifyBinderByDuplicatingIso639_1InChunks(dao);
        this.logger.debug(`dao: ${JSON.stringify(dao)}`, "create-binder");
        const id = await this.insert(dao);
        return { ...dao, id };
    }

    private asNewBinderVisual(
        visual: IBinderVisual,
        globalUrlMap: { [url: string]: string },
        srcIdToDuplicateVisual: { [srcId: string]: DuplicatedVisual }
    ): IBinderVisual {
        const { url: srcUrl, id: srcId } = visual;
        const destUrl = getUrlTranslation(srcUrl, globalUrlMap, srcId);
        const [destId] = extractImageIdAndFormatFromUrl(destUrl);
        if (!destId) {
            const duplicateVisual = srcIdToDuplicateVisual[srcId];
            /**
             * MT-4168: Fallback mechanism for when we can't detect the correct duplicate visual id from the url
             * This can happen when the srcUrl is of `azurems://....` format and does not have the visual id inside
             * This code was provided as a hotfix to mitigate the cloning issues, but once MT-4207 is shipped
             * and applied to prod we can remove it.
             */
            const duplicateVisualId = duplicateVisual?.id ?? srcId;
            const format = duplicateVisualId.startsWith("vid") ? "VIDEO_SCREENSHOT" : "MEDIUM";
            const duplicateVisualUrl = duplicateVisual?.formats?.find(f => f.blobName === format)?.url;
            return {
                ...visual,
                url: duplicateVisualUrl ?? srcUrl,
                id: duplicateVisualId
            };
        } else if (srcUrl) {
            return {
                ...visual,
                url: destUrl,
                id: destId,
            };
        } else {
            /*
             * This is a horrible hack to preserve the type conflict domino
             * at the caller's level if we were to allow string as a return type.
             * In the future we plan to remove this branch completely since it may no longer apply.
             */
            return destUrl as unknown as IBinderVisual;
        }
    }

    async duplicateBinder(toDuplicate: Binder): Promise<Binder> {
        const { id } = toDuplicate;
        if (!id) {
            throw new InvalidBinder(["Cannot duplicate. Missing 'id' field."]);
        }
        let newId;
        try {
            const { config } = this.repoConfig;
            newId = await this.duplicate({ ...toDuplicate, id });
            const imageClient = await BackendImageServiceClient.fromConfig(config, "images");
            const duplicateVisuals = await imageClient.duplicateVisuals(id, newId);
            const globalUrlMap = buildGlobalUrlMap(duplicateVisuals);
            const toDuplicateChunks = toDuplicate.modules.images.chunked[0].chunks;
            const originalIdToDuplicateVisual = Object.fromEntries(
                duplicateVisuals
                    .filter(visual => visual?.originalVisualData?.originalId)
                    .map(visual => [visual.originalVisualData.originalId, visual]));
            const newVisualChunks = toDuplicateChunks.map(chunkItems =>
                chunkItems.map(chunkItem =>
                    this.asNewBinderVisual(chunkItem, globalUrlMap, originalIdToDuplicateVisual)));
            const thumbnailUrl = toDuplicate.thumbnail.medium;
            const updatedThumbnailUrl = thumbnailUrl ?
                getUrlTranslation(thumbnailUrl, globalUrlMap) :
                thumbnailUrl;
            const toUpdate = { ...toDuplicate, id: newId };
            if (toDuplicate.storedVersion) {
                toUpdate["bindersVersion"] = toDuplicate.storedVersion;
            }
            toUpdate.thumbnail.medium = updatedThumbnailUrl;
            toUpdate.modules.images.chunked[0].chunks = newVisualChunks;
            return this.update(toUpdate);
        } catch (error) {
            if (newId) {
                await this.hardDeleteBinderById(newId);
            }
            this.logger.error("Could not duplicate binder", "duplicate-binder", error);
            throw error;
        }
    }

    private async hardDeleteBinderById(
        binderId: string
    ): Promise<void> {
        const binder = await this.getBinder(binderId);
        await this.hardDeleteBinder(binder);
    }

    private async hardDeleteBinder(
        binder: Binder
    ): Promise<void> {
        if (binder["id"] == null) {
            throw new InvalidBinder(["Cannot delete. Missing 'id' field."]);
        }
        let accountId = binder.accountId;
        if (accountId == null) {
            const fetchedBinder = await this.getBinder(binder.id);
            accountId = fetchedBinder.accountId;
        }
        await this.invalidator.onDelete([{
            name: "document",
            documentId: binder.id
        }]);
        await this.delete(binder.id);
    }

    async deleteBinder(
        toDelete: Binder,
        permanent?: boolean,
        deletedById?: string,
        deletedGroupCollectionId?: string
    ): Promise<void> {
        if (toDelete["id"] == null) {
            throw new InvalidBinder(["Cannot delete. Missing 'id' field."]);
        }
        if (permanent) {
            await this.hardDeleteBinder(toDelete);
            return;
        }
        const dao = Object.assign(
            toDelete,
            {
                deletionTime: new Date(),
                deletedById,
                deletedGroupCollectionId
            }
        );
        await this.update(dao);
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

    async recoverBinder(toRecover: Binder): Promise<Binder> {
        const dao = {
            ...toRecover,
            deletionTime: null,
            deletedById: null,
            deletedGroupCollectionId: null
        }
        return await this.update(dao);
    }

    async findBinderIdsByAccount(accountId: string): Promise<string[]> {
        const binderIds = []
        const query = {
            index: this.getIndexName(),
            body: {
                query: {
                    bool: {
                        must: {
                            term: {
                                accountId,
                            }
                        },
                        must_not: {
                            exists: {
                                field: "deletionTime"
                            }
                        }
                    }
                },
            },
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await this.runScroll(query, 1000, 200, async (esBatch: any[]) => {
            const batch = esBatch.map(h => h["_id"]);
            batch.forEach(bid => binderIds.push(bid))
        });
        return binderIds
    }

    async searchBindersViaScroll(
        queryString: string,
        searchOptions: BinderSearchResultOptions,
        accountId: string,
        processBatch: (esBatch: unknown) => Promise<boolean>,
        filter: BinderFilter,
    ): Promise<void> {
        const scrollAge = 3600
        const batchSize = 100
        const query = await this.getSearchBindersQuery(queryString, searchOptions, accountId, filter)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await this.runScroll(query, scrollAge, batchSize, async (hits: any[]) => {
            const filteredHits = hits.filter(hit => {
                if (hit?._source == null) return true;
                return hit._source?.deletionTime == null;
            });
            await processBatch(filteredHits);
        })
    }

    async findPaginatedBindersViaScroll(
        filter: BinderFilter,
        searchOptions: Omit<BinderSearchResultOptions, "maxResults" | "orderBy" | "ascending">,
        pageSize: number,
        pageStartsAt: Date | null,
        permissionFilter: (binders: Binder[]) => Binder[] | Promise<Binder[]>,
    ): Promise<Binder[]> {
        const query = await ESQueryBuilder.fromBinderOrPublicationFilter(
            this.getIndexName(),
            {
                ...filter,
                minCreatedDate: (pageStartsAt != null) ? pageStartsAt : undefined,
            },
            {
                ...searchOptions,
                maxResults: 200,
                orderBy: "created",
                ascending: true
            },
            this.queryBuilderHelper,
            undefined,
            this.logger,
        );
        const paginatedBinders: Binder[] = [];
        const processBatch = async (batch: { _source: Binder, _id: string }[]) => {
            const binders: Binder[] = batch.map(b => ({ ...b._source, id: b._id }));
            const filteredBinders = await permissionFilter(binders);
            paginatedBinders.push(...filteredBinders);
            return paginatedBinders.length >= pageSize;
        };
        await this.runScroll(query, 1000, 200, processBatch);
        return paginatedBinders.slice(0, pageSize);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    async transformScrollBindersResults(results, filters: ItemFilterFunction<Binder>[]): Promise<BinderSearchResult> {
        this.logger.trace(`Found ${results.length} matching publications`, "es-stats");
        const filteredHits = await this.filterHits(results, filters)
        this.logger.trace(`Kept ${filteredHits.length} hits after filtering`, "es-stats");
        return {
            totalHitCount: filteredHits.length,
            hits: filteredHits
        }
    }

    async getLanguagesUsedInBindersWithPublicationInfo(binderIds: string[], publicationRepository: PublicationRepository): Promise<LanguageSummary[]> {
        const binders = await this.findBinders({ binderIds }, { maxResults: MAXIMUM_NUMBER_OF_ITEMS });

        const results = {};
        for (let i = 0; i < binders.length; i++) {
            const languagesInBinder = binders[i].languages.map(lang => lang.iso639_1);
            const existingPublicationFilter = getExistingPublicationFilter(binders[i].id, languagesInBinder)
            const existingPublications = await publicationRepository.find(existingPublicationFilter, { maxResults: 150 });
            languagesInBinder.forEach((currentLanguageCode) => {
                if (results[currentLanguageCode]) {
                    results[currentLanguageCode].count += 1;
                } else {
                    results[currentLanguageCode] = { count: 1 };
                }
                if (!results[currentLanguageCode].atLeastOneCanPublish || !results[currentLanguageCode].atLwastOneCanUnpublish) {
                    const activePublicationFound = existingPublications.find(pub => pub.language.iso639_1 === currentLanguageCode) !== undefined;
                    const isContainingDraftsOrNoActivePublicationYet = !activePublicationFound || hasDraft(binders[i].modules.meta, currentLanguageCode, existingPublications as Publication[]);

                    if (isContainingDraftsOrNoActivePublicationYet) {
                        results[currentLanguageCode].atLeastOneCanPublish = true;
                    }
                    if (activePublicationFound) {
                        results[currentLanguageCode].atLeastOneCanUnpublish = true;
                    }
                }
            });

        }
        return Object.keys(results).sort(function (a, b) { return results[b].count - results[a].count; }).map(l => {
            return ({
                languageCode: l,
                atLeastOneCanPublish: results[l].atLeastOneCanPublish,
                atLeastOneCanUnpublish: results[l].atLeastOneCanUnpublish,
            });
        });
    }

    async getLanguagesUsedInBinders(binderIds: string[]): Promise<LanguageSummary[]> {
        const binders = await this.findBinders({ binderIds }, { maxResults: MAXIMUM_NUMBER_OF_ITEMS })
        const languageUsedMap = binders.reduce((reducedLanguages, binder: BinderFindResult) => {
            const langugaesInBinder = binder.languages.map(lang => lang.iso639_1);
            reducedLanguages = langugaesInBinder.reduce((acc, currentLanguageCode) => {
                acc[currentLanguageCode] = acc[currentLanguageCode] ? acc[currentLanguageCode] += 1 : 1;
                return acc;
            }, reducedLanguages)
            return reducedLanguages
        }, {} as BinderFindResult)
        return Object.keys(languageUsedMap).sort(function (a, b) { return languageUsedMap[b] - languageUsedMap[a]; }).map(l => {
            return ({ languageCode: l, atLeastOneCanPublish: undefined, atLeastOneCanUnpublish: undefined })
        });
    }

    private async filterHits(hits, filters: ItemFilterFunction<Binder>[]) {
        let filteredHits = [];
        const result = [];
        const itemFilterFunctions = {
            batch: filters.filter(({ batchProcessing }) => batchProcessing).map(({ process }) => process) as ItemBatchFilterProcess<Binder>[],
            nonBatch: filters.filter(({ batchProcessing }) => !batchProcessing).map(({ process }) => process) as ItemFilterProcess<Binder>[],
        }

        const scoresMap: Map<string, string> = hits.reduce((map, hit) => map.set(hit._id, hit._score), new Map())

        const itemsFromESHits = hits.map(this.binderFromESHit);
        filteredHits = itemsFromESHits;
        if (itemFilterFunctions.batch.length > 0) {
            filteredHits = await applyBatchItemFilters(itemFilterFunctions.batch, itemsFromESHits);
        }
        // map for filteredHits { [id]: {hit from ES} }
        const helperMapObject = filteredHits.reduce((prev, hit) => { return { ...prev, [hit.id]: hits.find(({ _id }) => _id === hit.id) } }, {});
        for await (const fullBinder of filteredHits) {
            const esHit = helperMapObject[fullBinder.id];
            const isAllowed = (itemFilterFunctions.nonBatch.length > 0) ? (await applyItemFilters(itemFilterFunctions.nonBatch, fullBinder)) : true;
            if (isAllowed) {
                const summary = this.buildSummary(fullBinder);
                const fieldHits = [];
                if (esHit.inner_hits) {
                    const titleContexts = this.getHighlightContexts(esHit, fullBinder, "languages", "iso639_1");
                    const textModulesContexts = this.getHighlightContexts(esHit, fullBinder, "modules.text.chunked", "key");
                    Object.keys(titleContexts).forEach(language => {
                        if (titleContexts[language] == null) return;
                        fieldHits.push(...Object.keys(titleContexts[language]).map(field => ({
                            field,
                            contexts: titleContexts[language][field],
                            languageCode: language
                        })));
                    });
                    Object.keys(textModulesContexts).forEach(language => {
                        if (textModulesContexts[language] == null) return;
                        fieldHits.push(...Object.keys(textModulesContexts[language]).map(field => ({
                            field,
                            contexts: textModulesContexts[language][field],
                            languageCode: language
                        })));
                    });
                }

                const fieldHitsForClient = fieldHits.some(fieldHit => fieldHit.contexts.length > 0) ?
                    fieldHits :
                    [];
                result.push({
                    score: scoresMap.get(summary.id),
                    binderSummary: summary,
                    fieldHits: fieldHitsForClient,
                });
            }
        }
        return result
    }

    async getItemsToPurge(msBeforePurge: number): Promise<Binder[]> {
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
        return this.runQuery(query, this.bindersFromESHits.bind(this))
    }

    // eslint-disable-next-line @typescript-eslint/ban-types
    async bulk(toSave: Partial<Binder>[], toDelete: Binder[], refresh = false): Promise<Object> {
        const bulk = toSave.reduce((reduced, binder) => {
            if (binder.id) {
                const binderId = binder["id"];
                return reduced.concat([
                    { update: { _index: this.getIndexName(), _id: binderId, } },
                    { doc: omit(["id"], binder) }
                ]);
            }
            else {
                return reduced.concat([
                    { index: { _index: this.getIndexName(), } },
                    binder
                ]);
            }
        }, []);
        toDelete.forEach(binder => {
            bulk.push({ delete: { _index: this.getIndexName(), _id: binder.id, } });
        });

        const operation = {
            body: bulk,
            refresh: !!refresh
        };
        return this.withClient(client => client.bulk(operation));
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
                            "field": "languages.iso639_1",
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

    async scrollBindersWithFilter(
        filter: BinderFilter,
        processBatch: (binders: Binder[]) => Promise<void>
    ): Promise<void> {
        const query = await ESQueryBuilder.fromBinderOrPublicationFilter(
            this.getIndexName(),
            filter,
            { maxResults: Number.MAX_VALUE, binderIdField: "_id" } as ServerSideSearchOptions,
            this.queryBuilderHelper,
            undefined,
            this.logger
        );
        await this.runScroll(query, 3600, 100, async esHits => {
            const binders = esHits.map(this.binderFromESHit);
            await processBatch(binders);
        });
    }
}
