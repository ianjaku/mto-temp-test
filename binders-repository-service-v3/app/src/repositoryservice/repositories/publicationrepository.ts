import * as Immutable from "immutable";
import {
    BinderSearchResultOptions,
    IPublicationsWithInfo,
    ItemBatchFilterProcess,
    ItemFilterFunction,
    ItemFilterProcess,
    Publication,
    PublicationFilter,
    PublicationFindResult,
    PublicationSearchResult,
    PublicationSummary,
    Translation
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    ElasticRepository,
    ElasticRepositoryConfigFactory,
    PUBLICATIONS_INDEX,
    RepositoryConfigType
} from "@binders/binders-service-common/lib/elasticsearch/elasticrepository";
import {
    applyBatchItemFilters,
    applyItemFilters
} from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import {
    dedupePublicationSearchResult,
    filterPublicationsByLanguages
} from "../repositoryfilters";
import { omit, uniq } from "ramda";
import { Config } from "@binders/client/lib/config/config";
import { ESQueryBuilder } from "../esquery/builder";
import { ESQueryBuilderHelper } from "../esquery/helper";
import { ES_MAX_RESULTS } from "../const";
import { ElasticOperation } from "./models/operationLog";
import { IOperationLog } from "../operation-log";
import { Logger } from "@binders/binders-service-common/lib/util/logging";

export interface PublicationFindOptions {
    useScroll?: boolean;
}

function buildSummary(publication: Publication): PublicationSummary {
    return {
        id: publication.id,
        binderId: publication.binderId,
        language: publication.language,
        thumbnail: publication.thumbnail,
        isPublished: publication.isActive,
        publicationDate: publication.publicationDate,
        unpublishDate: publication.unpublishDate,
        publishedBy: publication.publishedBy,
        isMaster: publication.isMaster,
        showInOverview: publication.showInOverview,
        isActive: publication.isActive,
        ancestorIds: publication.ancestorIds
    };
}

// Could be replaced with @elastic/elasticsearch/api/types/Refresh once
// bulk operation accepted refresh type will mention "true" | "false" types
export type Refresh = boolean | "wait_for";

export interface PublicationRepository {
    getPublications(binderIds: string[], maxResults: number, isActive?: number): Promise<Array<Publication>>;
    filterPublicationlessBinders(binderIds: string[]): Promise<Array<string>>;
    patch(publicationId: string, patch: Partial<Publication>): Promise<Publication>;
    save(publication: Publication): Promise<Publication>;
    find(filter: PublicationFilter, options: BinderSearchResultOptions, publicationFindOptions?: PublicationFindOptions): Promise<Array<PublicationFindResult>>;
    findWithInfo(filter: PublicationFilter, options: BinderSearchResultOptions): Promise<IPublicationsWithInfo>;
    delete(publicationId: string): Promise<void>;
    bulk<T>(saves: Partial<Publication>[], deletes: Publication[], refresh?: Refresh): Promise<T>;
    getPublication(publicationId: string): Promise<Publication>;
    searchPublications(
        queryString: string,
        searchOptions: BinderSearchResultOptions,
        publicationFilter: PublicationFilter,
        postFilter?: ItemFilterFunction<Publication>,
    ): Promise<PublicationSearchResult>;
    searchPublicationsViaScroll(queryString: string, searchOptions: BinderSearchResultOptions, publicationFilter: PublicationFilter, processBatch: (esBatch: unknown) => Promise<boolean>): Promise<void>
    scrollPublicationsWithFilter(
        filter: PublicationFilter,
        processBatch: (publications: Publication[]) => Promise<void>
    ): Promise<void>;
}

export class ElasticPublicationsRepository extends ElasticRepository implements PublicationRepository {

    addTranslations(publication: Publication): Promise<Publication> {
        return this.getPublications([publication.binderId], 500, 1)
            .then((publications: Publication[]) => {
                const translations: Translation[] = publications.reduce((reduced, pub) => {
                    const lang = pub.language.iso639_1;
                    return reduced.set(lang, { languageCode: lang, publicationId: pub.id });
                }, Immutable.Map<string, Translation>()).toArray();
                return Object.assign({}, publication, { translations });
            });
    }

    constructor(config: Config, logger: Logger, private readonly queryBuilderHelper: ESQueryBuilderHelper, private readonly operationLogService?: IOperationLog) {
        super(ElasticRepositoryConfigFactory.build(config, [RepositoryConfigType.Pulbications]), logger);
    }


    private publicationFromESHit(esHit) {
        const binder = esHit["_source"];
        binder["id"] = esHit["_id"];
        const authorIdsInHit = binder["authorIds"] || [];
        binder["authorIds"] = authorIdsInHit ? authorIdsInHit.filter(id => !!id) : [];
        return binder;
    }

    private publicationsFromESHits(results): Array<Publication> {
        this.logger.trace(`Found ${results.hits.hits.length} matching publications`, "es-stats");
        return results.hits.hits.map(this.publicationFromESHit);
    }

    private uniqueBinderIdsFromAggregatedESHits(results, aggregationField): Array<string> {
        return results.aggregations[`${aggregationField}_terms`].buckets
            .map(bucket => bucket.key);
    }

    getPublications(binderIds: string[], maxResults: number, isActive?: number): Promise<Array<Publication>> {
        const filter: PublicationFilter = {
            binderIds
        };
        if (isActive !== undefined) {
            filter.isActive = isActive;
        }
        const searchOptions: BinderSearchResultOptions = {
            maxResults
        };
        return <Promise<Array<Publication>>>this.find(filter, searchOptions);
    }

    async filterPublicationlessBinders(binderIds: string[]): Promise<Array<string>> {
        if (binderIds.length === 0) {
            return [];
        }
        const filter: PublicationFilter = {
            binderIds,
            isActive: 1
        };
        return this.findWithTermsAggregation(filter, "binderId", this.logger);
    }

    async getPublication(publicationId: string): Promise<Publication> {
        const validate = this.validateSearchResult.bind(this);
        const transform: (u: unknown) => Publication = this.publicationFromESHit.bind(this);
        const query = ESQueryBuilder.getById(this.getIndexName(), publicationId);
        const addTranslations = this.addTranslations.bind(this);
        return this.withClient(client => client.get(query))
            .then(r => validate(r.body))
            .then(transform)
            .then(publication => addTranslations(publication));
    }

    async patch(publicationId: string, patch: Partial<Publication>): Promise<Publication> {
        const update = {
            id: publicationId,
            index: this.repoConfig.aliasedIndexName as string,
            body: { doc: patch }
        };
        return this.withClient(client => client.update(update))
            .then(async result => {
                await this.logElasticOperation("update", update)
                const publication = this.publicationFromESHit(result.body);
                return this.addTranslations(publication);
            });
    }

    async save(publication: Publication): Promise<Publication> {
        const dao = Object.assign({}, publication);
        delete dao["id"];
        const update = {
            id: publication.id as string,
            index: this.getIndexName(),
            body: dao,
            refresh: true
        };
        return this.withClient(client => client.index(update))
            .then(async (result) => {
                await this.logElasticOperation("index", update)
                dao["id"] = result.body["_id"];
                return dao;
            });
    }

    async delete(publicationId: string): Promise<void> {
        const operation = {
            index: this.getIndexName(),
            id: publicationId
        };

        return this.withClient(async client => { await client.delete(operation) })
            .then(async result => {
                this.logger.info(JSON.stringify(result), "delete-pub")
                await this.logElasticOperation("delete", operation)
            })
    }

    async bulk<T>(toSave: Partial<Publication>[], toDelete: Publication[], refresh: Refresh = false): Promise<T> {
        const bulk = toSave.reduce((reduced, publication) => {
            if (publication.id) {
                const pubId = publication["id"];
                return reduced.concat([
                    { update: { _index: this.getIndexName(), _id: pubId } },
                    { doc: omit(["id"], publication) }
                ]);
            } else {
                return reduced.concat([
                    { index: { _index: this.getIndexName() } },
                    publication
                ]);
            }
        }, []);
        toDelete.forEach(publication => {
            bulk.push({ delete: { _index: this.getIndexName(), _id: publication.id } });
        });

        const operation = {
            body: bulk,
            refresh
        };
        const result = await this.withClient<T>(client => client.bulk(operation) as unknown as Promise<T>);
        await this.logElasticOperation("bulk", operation);
        return result;
    }

    async findWithTermsAggregation(filter: PublicationFilter, aggregationField: string, logger?: Logger): Promise<Array<string>> {
        return ESQueryBuilder.fromPublicationFilterAggregated(
            this.getIndexName(), filter, { maxResults: ES_MAX_RESULTS }, this.queryBuilderHelper, aggregationField, logger)
            .then(query => {
                const transform = this.uniqueBinderIdsFromAggregatedESHits.bind(this);
                return this.runQuery<string[]>(query, (results) => transform(results, aggregationField));
            });
    }

    async find(
        filter: PublicationFilter,
        options: BinderSearchResultOptions,
        publicationFindOptions: PublicationFindOptions = {},
    ): Promise<Array<PublicationFindResult>> {
        const query = await ESQueryBuilder.fromPublicationFilter(
            this.getIndexName(),
            filter,
            options,
            this.queryBuilderHelper,
            undefined,
            this.logger
        );

        let publications: Array<Publication> = [];
        if (publicationFindOptions.useScroll) {
            const scrollAge = 3600;
            const batchSize = 100;
            await this.runScroll(query, scrollAge, batchSize, async hits => {
                publications.push(...hits.map(hit => this.publicationFromESHit(hit)));
                return false;
            });
        } else {
            const transform = this.publicationsFromESHits.bind(this);
            publications = await this.runQuery<Publication[]>(query, transform);
        }

        const filteredByLanguage = filter.preferredLanguages ?
            filterPublicationsByLanguages(publications, filter.preferredLanguages) :
            publications;
        const { includeChunkCount, summary } = options;
        return summary ?
            filteredByLanguage.map((pub) => {
                const chunkCount = includeChunkCount &&
                    pub.modules.text.chunked.length > 0 &&
                    pub.modules.text.chunked[0].chunks.length;
                return {
                    ...buildSummary(pub),
                    ...(chunkCount ? { chunkCount } : {})
                };
            }) :
            filteredByLanguage;
    }

    async findWithInfo(filter: PublicationFilter, options: BinderSearchResultOptions): Promise<IPublicationsWithInfo> {
        const query = await ESQueryBuilder.fromPublicationFilter(
            this.getIndexName(),
            filter,
            options,
            this.queryBuilderHelper,
            undefined,
            this.logger);
        const transform = this.publicationsFromESHits.bind(this);
        let foundPublications = await this.runQuery<Publication[]>(query, transform);
        const languagesUsed = uniq(foundPublications.map(publication => publication.language.iso639_1));
        if (filter.preferredLanguages) {
            foundPublications = filterPublicationsByLanguages(foundPublications, filter.preferredLanguages);
        }
        const publications = filter.summary ? foundPublications.map(buildSummary) : foundPublications;
        return {
            publications,
            languagesUsed,
        };
    }


    async searchPublications(queryString: string, searchOptions: BinderSearchResultOptions, publicationFilter: PublicationFilter,
        postFilter?: ItemFilterFunction<Publication>): Promise<PublicationSearchResult> {

        if (!searchOptions.maxResults) {
            searchOptions.maxResults = 500;
        }

        const queryWithoutHighlighting = await ESQueryBuilder.publicationQueryString(this.getIndexName(),
            queryString, publicationFilter, searchOptions, this.queryBuilderHelper);
        const query = ESQueryBuilder.addHighlighting(
            queryWithoutHighlighting,
            ["language.storyTitle", "language.storyTitleRaw", "modules.text.chunked.chunks"]
        );
        const onlyActiveQuery = ESQueryBuilder.addActiveFilter(query, true);
        const filters = postFilter ? [postFilter] : [];

        const shouldIgnoreHighlight = queryString === "*"
        const transform = (searchResult) => {
            return this.publicationSearchResultFromESHits(
                searchResult,
                filters,
                shouldIgnoreHighlight || (queryString === "" && searchOptions.strictLanguages != null && searchOptions.strictLanguages.length > 0)
            );
        };
        const publicationSearchResult: PublicationSearchResult = await this.runQuery<PublicationSearchResult>(onlyActiveQuery, transform);
        return dedupePublicationSearchResult(publicationSearchResult);
    }

    async searchPublicationsViaScroll(queryString: string, searchOptions: BinderSearchResultOptions, publicationFilter: PublicationFilter, processBatch: (esBatch: unknown) => Promise<boolean>): Promise<void> {
        const scrollAge = 3600
        const batchSize = 100

        const queryWithoutHighlighting = await ESQueryBuilder.publicationQueryString(this.getIndexName(),
            queryString, publicationFilter, searchOptions, this.queryBuilderHelper);

        const query = ESQueryBuilder.addHighlighting(
            queryWithoutHighlighting,
            ["languages.storyTitle", "languages.title", "language.storyTitle", "modules.text.chunked.chunks"]
        );
        const onlyActiveQuery = ESQueryBuilder.addActiveFilter(query, true);
        await this.runScroll(onlyActiveQuery, scrollAge, batchSize, processBatch)
    }

    async scrollPublicationsWithFilter(
        filter: PublicationFilter,
        processBatch: (publications: Publication[]) => Promise<void>
    ): Promise<void> {
        const query = await ESQueryBuilder.fromPublicationFilter(
            this.getIndexName(),
            filter,
            { maxResults: Number.MAX_VALUE },
            this.queryBuilderHelper,
            undefined,
            this.logger
        );
        await this.runScroll(query, 3600, 100, async esHits => {
            const publications = esHits.map(this.publicationFromESHit);
            await processBatch(publications);
        });
    }

    private async publicationSearchResultFromESHits(results, filters: ItemFilterFunction<Publication>[], shouldIgnoreHighlight = false): Promise<PublicationSearchResult> {
        this.logger.trace(`Found ${results.hits.hits.length} matching publications`, "es-stats");
        const hits = results.hits.hits;
        const filteredHits = await this.filterHits(hits, filters, shouldIgnoreHighlight)
        this.logger.trace(`Kept ${filteredHits.length} hits after filtering`, "es-stats");
        return {
            totalHitCount: filteredHits.length,
            hits: filteredHits
        }
    }

    private async filterHits(hits, filters: ItemFilterFunction<Publication>[], shouldIgnoreHighlight = false) {
        let filteredHits = [];
        const result = [];
        const itemFilterFunctions = {
            batch: filters.filter(({ batchProcessing }) => batchProcessing).map(({ process }) => process) as ItemBatchFilterProcess<Publication>[],
            nonBatch: filters.filter(({ batchProcessing }) => !batchProcessing).map(({ process }) => process) as ItemFilterProcess<Publication>[],
        }

        const scoresMap: Map<string, string> = hits.reduce((map, hit) => map.set(hit._id, hit._score), new Map())

        const itemsFromESHits = hits.map(this.publicationFromESHit);
        filteredHits = itemsFromESHits;
        if (itemFilterFunctions.batch.length > 0) {
            filteredHits = await applyBatchItemFilters(itemFilterFunctions.batch, itemsFromESHits);
        }
        // map for filteredHits { [id]: {hit from ES} }
        const helperMapObject = filteredHits.reduce((prev, hit) => { return { ...prev, [hit.id]: hits.find(({ _id }) => _id === hit.id) } }, {})

        for await (const fullPublication of filteredHits) {
            const esHit = helperMapObject[fullPublication.id];
            const isAllowed = (itemFilterFunctions.nonBatch.length > 0) ? (await applyItemFilters(itemFilterFunctions.nonBatch, fullPublication)) : true;
            if (isAllowed) {
                const summary = buildSummary(fullPublication);
                const fieldHits = [];
                if (esHit.highlight) {
                    for (const field in esHit.highlight) {
                        fieldHits.push({
                            field,
                            contexts: esHit.highlight[field],
                        });
                    }
                }
                if (!esHit.highlight && shouldIgnoreHighlight) {
                    result.push({
                        score: scoresMap.get(summary.id),
                        publicationSummary: summary,
                        fieldHits
                    });
                }
                if (fieldHits.some(fieldHit => fieldHit.contexts.length > 0)) {
                    result.push({
                        score: scoresMap.get(summary.id),
                        publicationSummary: summary,
                        fieldHits
                    });
                }
            }
        }
        return result
    }

    private async logElasticOperation(operation: ElasticOperation, payload: Record<string, unknown>): Promise<void> {
        if (this.operationLogService) {
            await this.operationLogService.log(operation, payload);
        } else {
            Promise.resolve();
        }
    }

    async getActualIndexName(): Promise<string> {
        return PUBLICATIONS_INDEX
    }

}
