import * as elastic from "@elastic/elasticsearch";
import {
    ClusterHealthResponse,
    DeleteByQueryRequest,
    DeleteByQueryResponse,
    Refresh
} from "@elastic/elasticsearch/api/types";
import {
    ESSearchResult,
    incrementSearchShardFailureCounterFromSearchResult
} from "../monitoring/prometheus/elasticMetrics";
import { BulkBuilder } from "./bulkbuilder";
import { Config } from "@binders/client/lib/config/config";
import { ESQueryBuilder } from "./builder";
import { IndicesGetMappingIndexMappingRecord } from "@elastic/elasticsearch/api/types";
import { IndicesPutMapping } from "@elastic/elasticsearch/api/requestParams";
import { InvalidOperation } from "@binders/client/lib/util/errors";
import { Logger } from "../util/logging";
import { Progress } from "@binders/client/lib/util/progress";
import autobind from "class-autobind";
import { getIndexNames } from "./catIndices";
import { isProduction } from "@binders/client/lib/util/environment";
import { withClient } from "./client";

export const DEFAULT_BATCH_SIZE = 100;
/**
 * One hour scroll age, commonly used in scripts and scrolls
 */
export const DEFAULT_SCROLL_AGE = 3600;

export interface RepositoryConfig {
    config: Config;
    clusterConfigKey: string;
    indexName: string | string[];
    aliasedIndexName?: string | string[];
}


export interface ReindexConfig {
    mapping: Record<string, unknown>;
    oldIndexName: string
    newIndexName: string
    settings?: Record<string, unknown>
}

export interface TaskStatus {
    total: number
    created: number
    deleted: number
    batches: number
    version_conflicts: number
}

export interface ElasticTaskApiResponse {
    completed: boolean
    task: {
        description: string
        status: TaskStatus
    }
}

export type ElasticQuery = Record<string, unknown>;

export enum RepositoryConfigType {
    Binders,
    Collections,
    Pulbications
}

export type ESHit<T> = {
    _id: string,
    _source: Omit<T, "id">,
} & ESSearchResult;

export interface BulkOptions {
    ignoreDuplicates: boolean;
    refresh?: boolean | "wait_for";
}

export class ElasticRepository {

    constructor(protected readonly repoConfig: RepositoryConfig, protected logger: Logger) {
        autobind(this);
    }

    updateIndex(newIndex: string): void {
        this.repoConfig.indexName = newIndex;
    }

    health(): Promise<ClusterHealthResponse> {
        return this.withClient(async client => (await client.cluster.health<ClusterHealthResponse>()).body);
    }

    withClient<T>(
        cb: (client: elastic.Client) => Promise<T>,
        extraElasticConfig: Record<string, unknown> = {},
    ): Promise<T> {
        return withClient<T>(this.repoConfig.config, this.repoConfig.clusterConfigKey, cb, extraElasticConfig);
    }

    protected validateSearchResult<T>(searchResult: ESHit<T>): Promise<ESHit<T>> {
        incrementSearchShardFailureCounterFromSearchResult(searchResult, this.repoConfig);
        if (searchResult["error"]) {
            this.logger.error(`Search error: ${JSON.stringify(searchResult["error"])}`, "es-search-error")
            return Promise.reject(searchResult["error"]);
        }
        if (searchResult["errors"]) {
            this.logger.error(`Search errors: ${JSON.stringify(searchResult)}`, "es-search-error")
        }
        return Promise.resolve(searchResult);
    }

    protected fromESHit<T>(esHit: ESHit<T>): T {
        return {
            ...esHit._source,
            id: esHit._id
        } as unknown as T;
    }

    // eslint-disable-next-line
    protected fromESHits<T>(results): T[] {
        this.logger.trace(`Found ${results.hits.hits.length} matching docs`, "es-stats");
        return results.hits.hits.map(this.fromESHit);
    }

    public runQuery<T>(
        query: ElasticQuery,
        transform: (source) => Promise<T>,
        extraElasticConfig: Record<string, unknown> = {},
    ): Promise<T> {
        this.logger.trace("Running ES query", "es-stats", { query });
        return this.withClient<T>(
            async client => {
                const result = await client.search(query);
                const validatedResult = await this.validateSearchResult<T>(result.body as ESHit<T>);
                return transform(validatedResult);
            },
            extraElasticConfig,
        );
    }

    async runCreate(indexName: string, id: string, document: unknown): Promise<void> {
        return this.withClient(async client => {
            await client.create({
                id,
                index: indexName,
                body: document
            });
        })
    }

    async runCount(indexName?: string | string[], query?: ElasticQuery): Promise<number> {
        return this.withClient(async client => {
            const requestBody = {
                index: indexName || this.getIndexName()
            };
            if (query) {
                requestBody["body"] = query;
            }
            const result = await client.count<{ count: number }>(requestBody);
            return result.body.count;
        });
    }

    runSearch<T>(query: Record<string, unknown>): Promise<T> {
        const transform = this.fromESHits.bind(this);
        return this.runQuery<T>({
            index: this.getIndexName(),
            ...query
        }, transform);
    }

    async getMapping(): Promise<IndicesGetMappingIndexMappingRecord> {
        const index = await this.getActualIndexName();
        const requestOptions = {
            index
        };
        return this.withClient<IndicesGetMappingIndexMappingRecord>(async client => {
            const mapping = await client.indices.getMapping(requestOptions);
            return mapping.body[index];
        });
    }

    async runScroll<T>(query: Record<string, unknown>, scrollAgeInSeconds: number, batchSize: number, processBatch: (batch: T[]) => Promise<void | boolean>, useAliasedIndex = true): Promise<void> {
        const scrollAge = `${scrollAgeInSeconds}s`;
        const index = useAliasedIndex ? this.getIndexName() : await this.getActualIndexName()
        const queryCopy: elastic.RequestParams.Search = {
            index,
            scroll: scrollAge,
            ...query,
            size: batchSize,
        };
        const validate = this.validateSearchResult.bind(this);
        const logger = this.logger;
        let progress = Progress.empty();
        const nextBatch = async (client: elastic.Client, searchResponseBody): Promise<void> => {
            const total = +searchResponseBody.hits.total.value;
            progress = progress.setTotal(total).tickBy(+searchResponseBody.hits.hits.length);
            logger.debug(progress.formatDefault(), "elastic-scroll");
            if (searchResponseBody.hits.hits.length === 0) {
                logger.debug("Done scrolling", "elastic-scroll");
                return;
            }
            try {
                const shouldStop = await processBatch(searchResponseBody.hits.hits);
                if (!searchResponseBody._scroll_id || shouldStop) {
                    return;
                }
                const newScrollResponse = await client.scroll({
                    method: "POST",
                    body: {
                        scroll_id: searchResponseBody._scroll_id,
                        scroll: scrollAge
                    }
                });
                return nextBatch(client, newScrollResponse.body)
            } catch (error) {
                logger.error(`Something went wrong! ${error.message}`, "elastic-scroll");
                throw error;
            }
        };
        return this.withClient(async client => {
            const result = await client.search(queryCopy);
            const validatedResult = await validate(result.body);
            const scrollId = result.body._scroll_id;
            try {
                await nextBatch(client, validatedResult)
            } finally {
                this.clearScroll(client, scrollId);
            }
        });
    }

    async clearScroll(client: elastic.Client, scrollId: string): Promise<void> {
        try {
            await client.clear_scroll({
                method: "DELETE",
                body: {
                    scroll_id: scrollId
                }
            });
        } catch (error) {
            this.logger.warn(`Failed to clear scroll. Reason: ${error.message}`, "elastic-scroll");
        }
    }

    async runGet<T>(indexName: string, documentId: string): Promise<T> {
        const query = ESQueryBuilder.getById(indexName, documentId);
        return this.withClient(async client => {
            const result = await client.get(query);
            const validatedResult = await this.validateSearchResult<T>(result.body as ESHit<T>);
            return this.fromESHit<T>(validatedResult);
        });
    }

    async ensureMapping(mapping: Record<string, unknown>, skipExistsCheck = false): Promise<void> {
        const index = await this.getActualIndexName();
        const logger = this.logger;
        const request = { index, body: mapping };
        const exists = await this.indexExists(index);
        if (exists && !skipExistsCheck) {
            logger.info(`Index already exists (skip check: ${skipExistsCheck}), don't update mapping`, "elastic-init");
        } else {
            try {
                if (!exists) {
                    await this.createIndex(index);
                }
                logger.info("Putting mapping to elastic", "elastic-init");
                await this.withClient(client => client.indices.putMapping(request))
            } catch (error) {
                logger.error("Could not ensure mapping.", "elastic-init", error);
                process.abort();
            }
        }
    }


    async ensureSettings(settings: unknown, isUpgrade = false): Promise<boolean> {
        const index = await this.getActualIndexName();
        const logger = this.logger;
        if (isProduction() && !isUpgrade) {
            return false;
        }

        try {
            const exists = await this.indexExists(index);
            if (!exists) {
                await this.createIndex(index)
            }
            await this.closeIndex(index);
            await this.putSettings(index, settings);
            await this.openIndex(index);
            return !exists;
        } catch (error) {
            logger.logException(error, "elastic-ensure-settings");
            process.abort();
        }
    }

    protected async closeIndex(indexName: string): Promise<void> {
        await this.withClient(client => client.indices.close({ index: indexName }));
    }

    protected async putSettings(indexName: string, settings: unknown): Promise<void> {
        await this.withClient(client => client.indices.putSettings({ index: indexName, body: settings }));
    }

    protected async openIndex(indexName: string): Promise<void> {
        await this.withClient(client => client.indices.open({ index: indexName }));
    }

    protected async insert(dao: Record<string, unknown>): Promise<string> {
        const id = dao["id"] as string;
        delete dao["id"];
        const insert = {
            id,
            index: this.getIndexName(),
            body: dao,
            refresh: "true" as Refresh
        };
        return this.withClient<string>(async client => {
            const apiResult = await client.index(insert as elastic.RequestParams.Index);
            return apiResult.body._id;
        });
    }

    protected async update<T extends { id?: string }>(dao: T): Promise<T> {
        const id = dao.id;
        if (typeof id === "undefined") {
            throw new InvalidOperation("Could not update, missing id property");
        }
        delete dao["id"];
        const update = {
            id,
            index: this.getIndexName(),
            body: dao,
            refresh: "true" as Refresh
        };

        return this.withClient(async client => {
            await client.index(update as elastic.RequestParams.Index);
            return Object.assign({ id }, dao);
        });
    }

    protected async deleteByQuery(query: DeleteByQueryRequest): Promise<DeleteByQueryResponse> {
        this.logger.trace("Deleting by query", "es-stats", { query });
        return this.withClient(async client => {
            const response = await client.deleteByQuery(query as elastic.RequestParams.DeleteByQuery);
            return response.body;
        });
    }

    async runBulk(bulkBuilder: BulkBuilder, options: BulkOptions): Promise<void> {
        const { actions } = bulkBuilder.build();
        const refresh = (options.refresh != null) ? options.refresh : "wait_for";
        return this.withClient(async client => {
            const response = await client.bulk({
                body: actions,
                refresh,
            });
            const validatedResult = await this.validateSearchResult(response.body as ESHit<Record<string, unknown>>);
            if (validatedResult["errors"]) {
                const errors = validatedResult["items"]
                    .filter(item => hasESCreationDuplicateError(item) && !options.ignoreDuplicates);
                if (errors.length > 0) {
                    throw new Error(errors.map(err => JSON.stringify(err)).join("\n"));
                }
            }
        });
    }

    protected async duplicate<T extends { id: string, accountId?: string }>(dao: T): Promise<string> {
        const { id: srcId } = dao;
        if (!srcId) {
            throw new InvalidOperation("Could not duplicate, missing id property");
        }
        const index = this.getIndexName()
        const sourceItem = await this.runGet<T>(index, srcId);
        const duplicatedItem = {
            index,
            body: { ...sourceItem, id: undefined },
            refresh: "true"
        };

        const duplicateFn = async client => await client.index(duplicatedItem);
        const { body } = await this.withClient(duplicateFn);
        return body["_id"];
    }

    private verifyId(id: unknown, operation: string) {
        if (typeof id === "undefined") {
            throw new InvalidOperation(`Could not ${operation}, missing id property`);
        }
    }

    protected async delete(id: string): Promise<void> {
        this.verifyId(id, "delete");
        const toDelete = {
            refresh: "true" as Refresh,
            index: this.getIndexName(),
            id,
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await this.withClient(client => client.delete(toDelete as any));
    }

    async ensureIndex(params: { index: string }): Promise<boolean> {
        const { index } = params;
        const exists = await this.indexExists(index);
        if (exists) {
            return true;
        }
        return this.createIndex(index);
    }

    async aliasExists(name: string): Promise<boolean> {
        return this.withClient(async client => {
            return (await client.indices.existsAlias({ name })).body;
        });
    }

    async aliasCreate(aliasName: string, indexName: string | string []): Promise<void> {
        return this.withClient(async client => {
            const params = { index: indexName, name: aliasName };
            await client.indices.putAlias(params);
        });
    }

    async aliasEnsure(aliasName: string, indexName: string | string []): Promise<void> {
        const exists = await this.aliasExists(aliasName);
        if (!exists) {
            await this.aliasCreate(aliasName, indexName);
        }
    }

    async removeAlias(aliasName: string): Promise<boolean> {
        const params = {
            index: await this.getActualIndexName(),
            name: aliasName
        };
        return this.withClient(async client => {
            const { acknowledged } = (await client.indices.deleteAlias(params)).body;
            return acknowledged;
        })
    }
    ensureIndexTemplates(params: { name: string, body: Record<string, unknown> }): Promise<boolean> {
        return this.withClient(async client => {
            const { acknowledged } = (await client.indices.putTemplate(params)).body;
            return acknowledged;
        });
    }

    getAliasedIndices(aliasName: string): Promise<string[]> {
        return this.withClient(async client => {
            const result = (await client.indices.getAlias({ name: aliasName })).body;
            return Object.keys(result);
        });
    }

    async getIndices(): Promise<Array<string>> {
        return this.withClient(getIndexNames);
    }

    async reindex(config: ReindexConfig, requestTimeout = "5m"): Promise<void> {
        const { mapping, oldIndexName, newIndexName, settings } = config
        await this.ensureIndex({ index: newIndexName });
        if (settings) {
            await this.closeIndex(newIndexName);
            await this.putSettings(newIndexName, settings);
            await this.openIndex(newIndexName);
        }
        return this.withClient(async client => {
            const params: IndicesPutMapping = {
                index: newIndexName,
                body: mapping,
            };
            await client.indices.putMapping(params);
            await client.reindex(
                {
                    body: {
                        source: { index: oldIndexName },
                        dest: { index: newIndexName }
                    }
                },
                { requestTimeout }
            );
        })
    }

    async startReindex(config: ReindexConfig): Promise<string> {
        const { mapping, oldIndexName, newIndexName, settings } = config
        await this.ensureIndex({ index: newIndexName });
        if (settings) {
            await this.closeIndex(newIndexName);
            await this.putSettings(newIndexName, settings);
            await this.openIndex(newIndexName);
        }
        return this.withClient(async client => {
            await client.indices.putMapping({ index: newIndexName, body: mapping });
            const response = await client.reindex(
                {
                    wait_for_completion: false,
                    body: {
                        source: { index: oldIndexName },
                        dest: { index: newIndexName }
                    }
                },

            );
            this.logger.info(`Task id: ${response.body.task}`, "start-reindex")
            return response.body.task
        })
    }

    async waitForReindexComplete(taskId: string): Promise<ElasticTaskApiResponse> {
        const category = "wait-for-reindex-complete"
        return this.withClient(async (client: elastic.Client) => {
            let taskResponse: ElasticTaskApiResponse = (await client.tasks.get({ task_id: taskId })).body as ElasticTaskApiResponse
            while (!taskResponse.completed) {
                this.logger.info(taskResponse.task.description, category)
                const { created, total } = taskResponse.task.status
                this.logger.info(`Progress: created ${created} out of ${total}`, category)
                await new Promise(resolve => setTimeout(resolve, 10000))
                taskResponse = (await client.tasks.get({ task_id: taskId })).body as ElasticTaskApiResponse
            }
            this.logger.info("Reindex completed", category)
            this.logger.info(JSON.stringify(taskResponse), category)
            return taskResponse
        })

    }

    async indexExists(indexName: string): Promise<boolean> {
        return this.withClient(async client => {
            return (await client.indices.exists({ index: indexName })).body;
        });
    }

    deleteIndex(indexName: string): Promise<void> {
        return this.withClient(async client => {
            await client.indices.delete({ index: indexName });
        });
    }

    async createIndex(indexName: string): Promise<boolean> {
        return this.withClient(async client => {
            const result = await client.indices.create({ index: indexName });
            return result.body.acknowledged;
        });
    }

    getIndexName(): string {
        return this.repoConfig.aliasedIndexName as string
    }

    async getActualIndexName(): Promise<string> {
        return Promise.resolve(this.repoConfig.indexName as string)
    }

    async updateAlias(aliasName: string, newIndexName: string): Promise<void> {
        return this.withClient(async (client: elastic.Client) => {
            const aliasExists = await client.indices.existsAlias({
                name: aliasName
            })
            const actions = []

            if (aliasExists.body) {
                const aliasInfo = await client.indices.getAlias({
                    name: aliasName
                })
                const currentIndexName = Object.keys(aliasInfo.body)[0]
                actions.push({ remove: { index: currentIndexName, alias: aliasName } })
            }
            actions.push({ add: { index: newIndexName, alias: aliasName } })
            await client.indices.updateAliases({
                body: {
                    actions: actions
                }
            })
        })
    }

    async checkIndicesByVersion(elasticMajorVersion: string, indexPrefix?: string): Promise<string[]> {
        const category = "check-es-indices-version"
        return this.withClient(async (client: elastic.Client) => {
            const response = await client.cat.indices({ format: "json" })
            const indicesByVersion = []
            for (const index of response.body as CatIndicesResponse[]) {
                if (indexPrefix && !index.index.startsWith(indexPrefix)) {
                    continue
                }

                const settingsResponse = await client.indices.getSettings({ index: index.index })
                const versionNumber = settingsResponse.body[index.index].settings.index.version.created
                const version = versionNumber.toString().substring(0, 1)

                if (version === elasticMajorVersion) {
                    this.logger.info(`Index ${index.index} was created in Elasticsearch ${version}`, category)
                    indicesByVersion.push(index.index)
                }
            }
            return indicesByVersion
        })
    }
}


interface CatIndicesResponse {
    index: string
}


const BINDERS_ALIAS = "binders"
const BINDERS_INDEX = "binders-binders-v3"
const COLLECTIONS_ALIAS = "colections"
const COLLECTIONS_INDEX = "binders-collections-v3"
const PUBLICATIONS_ALIAS = "publications"
export const PUBLICATIONS_INDEX = "publications-v3"

type IndexData = {
    aliasedIndexNames: string[];
    indexNames: string[];
};

export const REPO_CONFIGS_BY_TYPE = {
    [RepositoryConfigType.Binders]: {
        aliasedIndexName: BINDERS_ALIAS,
        indexName: BINDERS_INDEX
    },
    [RepositoryConfigType.Collections]: {
        aliasedIndexName: COLLECTIONS_ALIAS,
        indexName: COLLECTIONS_INDEX
    },
    [RepositoryConfigType.Pulbications]: {
        aliasedIndexName: PUBLICATIONS_ALIAS,
        indexName: PUBLICATIONS_INDEX
    },
};

export class ElasticRepositoryConfigFactory {

    static build(config: Config, types: RepositoryConfigType[]): RepositoryConfig {
        const initialIndexDataValues: IndexData = {
            aliasedIndexNames: [],
            indexNames: []
        };

        const { aliasedIndexNames, indexNames } = types.reduce((acc, curr) => {
            const { aliasedIndexName, indexName } = REPO_CONFIGS_BY_TYPE[curr];
            acc.aliasedIndexNames.push(aliasedIndexName);
            acc.indexNames.push(indexName);
            return acc;
        }, initialIndexDataValues);

        return {
            config,
            clusterConfigKey: "elasticsearch.clusters.binders",
            aliasedIndexName: castStringResult(aliasedIndexNames),
            indexName: castStringResult(indexNames)
        };
    }
}


function castStringResult(input: string[]): string | string[] {
    if (input.length === 1) {
        return input[0];
    } else {
        return input;
    }
}

function hasESCreationDuplicateError(item: Record<string, unknown>): boolean {
    const errorType = item?.["create"]?.["error"]?.["type"] ?? "";
    return errorType === "document_already_exists_exception" || errorType === "version_conflict_engine_exception";
}