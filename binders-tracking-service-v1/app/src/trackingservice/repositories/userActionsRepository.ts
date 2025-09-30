import {
    Aggregation,
    TermsAggregation
} from "@binders/binders-service-common/lib/elasticsearch/aggregations";
import {
    ChooseLanguageData,
    ChunkTiming,
    ChunkTimingsMap,
    ChunkTimingsPerPublication,
    DupUserActionReport,
    ILanguageStatistics,
    IRange,
    IUserAction,
    IUserActionDataReadSession,
    IUserActionQuery,
    MultiInsertOptions,
    UserActionType
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { equals, min, omit, sum } from "ramda";
import { BulkBuilder } from "@binders/binders-service-common/lib/elasticsearch/bulkbuilder";
import { Config } from "@binders/client/lib/config/config";
import { ESQueryBuilder } from "@binders/binders-service-common/lib/elasticsearch/builder";
import {
    ElasticRepository
} from "@binders/binders-service-common/lib/elasticsearch/elasticrepository";
import { ElasticSearchResultOptions } from "@binders/client/lib/clients/client";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { MAX_RESULTS } from "../config";
import { Maybe } from "@binders/client/lib/monad";
import { UserActionIdentifier } from "@binders/binders-service-common/lib/authentication/identity";
import { buildUserActionsQuery } from "./builder";
import { getCurrentIndexName } from "../../essetup/ensureAliases";
import { hashUserAction } from "@binders/client/lib/clients/trackingservice/v1/helpers";

export type UserActionAggregation<T, V> = {
    [P in keyof Partial<T>]: V | UserActionAggregation<T, V>
}

export type Range = {
    rangeStart: Date;
    rangeEnd: Date;
};
type UserActionsAvailableParams = {
    accountId: string,
    publicationIds: string[],
    itemIds: string[],
    binderIds: string[],
    userIds: string[],
    excludeUserIds: string[],
    startRange: Partial<Range>,
    endRange: Partial<Range>,
    userActionTypes: UserActionType[],
    incomplete: boolean,
    userIsAuthor: boolean,
    excludeUserActionTypes: UserActionType[],
    start: number,
    end: number,
    missingField: string,
};
export type UserActionsFilter = Partial<UserActionsAvailableParams>;

export interface IEditorInfo {
    userId: string;
    documentCount: number;
    editCount: number;
}

export interface IUserActionResults {
    hits: IUserAction[]
    /**
     * A value representing how many hits ES counted for the query</br>
     * <b>WARNING</b> it defaults to 10.000 unless forced to count all of them
     */
    total: number
}

export interface IUserActionsRepository {
    find(
        filter: UserActionsFilter,
        postFilter?: (ua: IUserAction) => boolean,
        limitResults?: number
    ): Promise<IUserAction[]>;
    findOldestPerItemId(
        filter: UserActionsFilter
    ): Promise<Map<string, IUserAction>>;
    countUserActions(
        filter: UserActionsFilter,
        limitResults?: number
    ): Promise<number>;
    aggregate<V>(filter: UserActionsFilter, aggregation: Aggregation<IUserAction>, options?: Partial<AggregationOptions<V>>): Promise<UserActionAggregation<IUserAction, V>>;
    countPerItemId(filter: UserActionsFilter): Promise<{ [itemId: string]: number }>;
    multiInsertUserAction(userActions: IUserAction[], options?: MultiInsertOptions): Promise<IUserAction[]>;
    multiUpdateUserAction(userActions: IUserAction[]): Promise<IUserAction[]>;
    forEach(filter: UserActionsFilter, action: (action: IUserAction) => void): Promise<void>;
    findFirst(filter: UserActionsFilter, predicate: (u: IUserAction<unknown>) => boolean, orderBy?: string): Promise<Maybe<IUserAction<unknown>>>;
    mostActiveEditors(accountId: string, count: number): Promise<IEditorInfo[]>;
    deleteUserActions(query: IUserActionQuery): Promise<number>;
    deleteUserActionsByFilter(query: UserActionsFilter): Promise<number>;
    getChunkTimings(accountId: string, binderId: string, startRange?: IRange, endRange?: IRange): Promise<ChunkTimingsPerPublication>;
    getLanguagesStatistics(accountId: string, binderId: string, startRange?: IRange, endRange?: IRange): Promise<ILanguageStatistics[]>;
    detectDuplicateUserActions(rangeStart: number): Promise<DupUserActionReport>;
    dedupeUserActions(report: DupUserActionReport): Promise<number>;
}

export interface AggregationOptions<V> {
    parseBucket: (bucket) => V;
}

export interface UserActionsRepositoryOptions {
    indexName: string;
}

export class ElasticUserActionsRepository extends ElasticRepository implements IUserActionsRepository {
    constructor(config: Config, logger: Logger, repoOptions: Partial<UserActionsRepositoryOptions> = {}) {
        super({
            config,
            clusterConfigKey: "elasticsearch.clusters.useractions",
            indexName: repoOptions.indexName || getCurrentIndexName(),
            aliasedIndexName: "useractions",
        }, logger);
    }

    async getChunkTimings(
        accountId: string,
        binderId: string,
        startRange?: IRange,
        endRange?: IRange
    ): Promise<ChunkTimingsPerPublication> {
        const readSessionUserActions = await this.find({
            accountId,
            itemIds: [binderId],
            startRange,
            endRange,
            userActionTypes: [UserActionType.DOCUMENT_READ],
        }) as IUserAction<IUserActionDataReadSession>[];
        const timingsPerPublicationId = this.groupTimingsPerPublicationId(readSessionUserActions);
        const avgChunkTimingsPerPublicationId: ChunkTimingsPerPublication = {};
        for (const [publicationId, chunkTimings] of timingsPerPublicationId.entries()) {
            avgChunkTimingsPerPublicationId[publicationId] = this.joinPublicationChunkTimings(chunkTimings);
        }
        return avgChunkTimingsPerPublicationId;
    }

    private groupTimingsPerPublicationId(readSessionUserActions: IUserAction<IUserActionDataReadSession>[]) {
        const timingsPerPublicationId = new Map<string, ChunkTimingsMap[]>();
        for (const userAction of readSessionUserActions) {
            const { data: { publicationId, chunkTimingsMap: chunkTimingsMapRaw } } = userAction;
            if (chunkTimingsMapRaw == null) {
                continue;
            }
            const chunkTimings = timingsPerPublicationId.get(publicationId) ?? [];
            try {
                chunkTimings.push(JSON.parse(chunkTimingsMapRaw));
            } catch (e) {
                this.logger.error(`Failed to parse as JSON ${chunkTimingsMapRaw}`, "chunk-timings");
                continue;
            }
            timingsPerPublicationId.set(publicationId, chunkTimings);
        }
        return timingsPerPublicationId;
    }

    private joinPublicationChunkTimings(chunkTimingsMaps: ChunkTimingsMap[]) {
        const joinedChunkTimings = new Map<string, { wordCount: number, timesSpentMs?: number[] }>();
        for (const chunkTimingsMap of chunkTimingsMaps) {
            for (const [chunkId, chunkTiming] of Object.entries(chunkTimingsMap) as [string, ChunkTiming][]) {
                const aggregatedChunkTiming = joinedChunkTimings.get(chunkId) ?? { wordCount: chunkTiming.wordCount, timesSpentMs: [] };
                aggregatedChunkTiming.timesSpentMs.push(chunkTiming.timeSpentMs);
                joinedChunkTimings.set(chunkId, aggregatedChunkTiming);
            }
        }

        const avgAggregatedChunkTimings: ChunkTimingsMap = {};
        for (const [chunkId, { wordCount, timesSpentMs }] of joinedChunkTimings.entries()) {
            const timeSpentMs = timesSpentMs.length === 0 ? 0 : sum(timesSpentMs) / timesSpentMs.length;
            avgAggregatedChunkTimings[chunkId] = { wordCount, timeSpentMs };
        }
        return avgAggregatedChunkTimings;
    }

    async getLanguagesStatistics(
        accountId: string,
        binderId: string,
        startRange?: IRange,
        endRange?: IRange
    ): Promise<ILanguageStatistics[]> {
        const chooseLanguageActions = await this.find({
            accountId,
            binderIds: [binderId],
            startRange,
            endRange,
            userActionTypes: [UserActionType.CHOOSE_LANGUAGE],
        });

        const languageMap = chooseLanguageActions.reduce((acc, userAction) => {
            const userActionData = userAction.data as ChooseLanguageData;
            const languageCode = userActionData.language;
            return {
                ...acc,
                [languageCode]: {
                    languageCode,
                    amount: (acc[languageCode] ? acc[languageCode].amount : 0) + 1,
                    isMachineTranslation: userActionData.isMachineTranslation,
                }
            }
        }, {} as { [languageCode: string]: ILanguageStatistics });
        return Object.values(languageMap);
    }

    async mostActiveEditors(accountId: string, count: number): Promise<IEditorInfo[]> {
        const overallFilter: UserActionsFilter = {
            accountId,
            userActionTypes: [UserActionType.ITEM_EDITED]
        }
        const overallAggregation: TermsAggregation<IUserAction> = {
            agg: "terms",
            groupBy: "userId",
            size: count
        };
        const aggs = await this.aggregate(overallFilter, overallAggregation);
        const mostActiveUsers = Object.keys(aggs);
        if (mostActiveUsers.length === 0) {
            return [];
        }
        const mostActiveFilter = {
            userIds: mostActiveUsers,
            userActionTypes: [UserActionType.ITEM_EDITED]
        };
        const mostActiveAggregation = {
            agg: "terms",
            groupBy: "userId",
            aggregation: {
                agg: "terms",
                groupBy: "data.itemId"
            }
        }
        const mostActiveData = await this.aggregate(mostActiveFilter, mostActiveAggregation as Aggregation<IUserAction>);
        const result = [];
        for (const userId in mostActiveData) {
            let editCount = 0;
            let documentCount = 0;
            for (const binderId in mostActiveData[userId]) {
                documentCount++;
                editCount += mostActiveData[userId][binderId];
            }
            result.push({
                userId,
                editCount,
                documentCount
            })
        }
        return result;
    }

    async find(
        filter: UserActionsFilter,
        postFilter?: (ua: IUserAction) => boolean,
        resultsLimit = Number.MAX_SAFE_INTEGER
    ): Promise<IUserAction[]> {
        const { aliasedIndexName } = this.repoConfig;
        const transform = this.userActionsFromESHits.bind(this);
        const maxHitsPerQuery = min(9999, resultsLimit);
        const options: ElasticSearchResultOptions = { maxResults: maxHitsPerQuery };
        const query = await this.buildUserActionsQuery(filter, aliasedIndexName as string, { ...options, resolveTotalHitsValue: true });
        const start = new Date().getTime();

        const userActionsResults = await this.runQuery<IUserActionResults>(query, transform);

        const results: IUserAction[] = [];
        userActionsResults.hits.forEach(hit => {
            if (postFilter === undefined || postFilter(hit)) {
                results.push(hit);
            }
        })
        // To avoid the performance impact on large datasets, we're using the total number of hits
        // that get resolved only in the first query, subsequent ones will avoid calculating it
        const totalNumberOfHits = userActionsResults.total;
        let lastSearchResult = userActionsResults;
        let lastSearchAfter = undefined;

        while (results.length < resultsLimit && lastSearchResult.hits.length === maxHitsPerQuery) {
            this.logger.debug(`Fetching next batch: ${results.length} / ${totalNumberOfHits}`, "elastic-search");
            const lastResult = lastSearchResult.hits[lastSearchResult.hits.length - 1];
            const searchAfterElement = lastResult["sort"];
            if (equals(lastSearchAfter, searchAfterElement)) {
                break;
            }
            lastSearchAfter = searchAfterElement;
            const searchAfterQuery = await this.buildUserActionsQuery(filter, aliasedIndexName as string, options, searchAfterElement);
            lastSearchResult = await this.runQuery<IUserActionResults>(searchAfterQuery, transform);
            lastSearchResult.hits.forEach(hit => {
                if (postFilter === undefined || postFilter(hit)) {
                    results.push(hit);
                }
            })
        }
        this.logger.debug(`Query took ${new Date().getTime() - start} ms`, "elastic-search")
        return results
    }

    async findOldestPerItemId(
        filter: UserActionsFilter
    ): Promise<Map<string, IUserAction>> {

        const { aliasedIndexName } = this.repoConfig;
        const query = await this.buildUserActionsQuery(filter, aliasedIndexName as string, { maxResults: 0 });

        (query.body as Record<string, unknown>).aggs = {
            items: {
                terms: {
                    field: "data.itemId",
                    size: 99999,
                },
                aggs: {
                    oldest_action: {
                        top_hits: {
                            sort: [{ start: { order: "asc" } }],
                            size: 1
                        }
                    }
                }
            }
        };

        const transform = async (result) => {
            const oldestActionsMap = new Map<string, IUserAction>();
            if (result.aggregations?.items?.buckets) {
                for (const bucket of result.aggregations.items.buckets) {
                    const itemId = bucket.key;
                    if (bucket.oldest_action?.hits?.hits?.length > 0) {
                        const hit = bucket.oldest_action.hits.hits[0];
                        const userAction = this.userActionFromESHit(hit);
                        oldestActionsMap.set(itemId, userAction);
                    }
                }
            }
            return oldestActionsMap;
        };

        return this.runQuery(query, transform);
    }

    async countUserActions(
        filter: UserActionsFilter,
        resultsLimit = Number.MAX_SAFE_INTEGER
    ): Promise<number> {
        const { aliasedIndexName } = this.repoConfig;
        const options = {
            maxResults: min(9999, resultsLimit) as number,
        }
        const query = await this.buildUserActionsQuery(filter, aliasedIndexName as string, options);
        return await this.runCount(aliasedIndexName, query.body as Record<string, unknown>);
    }

    async aggregate<V>(filter: UserActionsFilter, aggregation: Aggregation<IUserAction>,
        options: Partial<AggregationOptions<V>> = {}): Promise<UserActionAggregation<IUserAction, V>> {
        const { aliasedIndexName } = this.repoConfig;
        const query = await this.buildUserActionsQuery(filter, aliasedIndexName as string, { maxResults: 0 });
        const queryWithAggs = ESQueryBuilder.addAggregations<IUserAction>(query, aggregation);
        const transform = (result) => {
            const parseAggregation = (resultAggregations, requestAggregation: Aggregation<IUserAction>) => {
                if (!resultAggregations) {
                    return {};
                }
                const key = requestAggregation.groupBy;
                const { buckets } = resultAggregations[key];
                if (!buckets) {
                    return resultAggregations[key].value;
                }
                const parsed: UserActionAggregation<IUserAction, V> = {};
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const shouldRecurse = !!((requestAggregation as any).aggregation);
                for (const bucket of buckets) {
                    let result;
                    if (shouldRecurse) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        result = parseAggregation(bucket, (requestAggregation as any).aggregation as Aggregation<IUserAction>);
                    } else {
                        result = options.parseBucket ? options.parseBucket(bucket) : bucket.doc_count;
                    }
                    parsed[bucket.key] = result;
                }
                return parsed;
            };
            return parseAggregation(result.aggregations, aggregation);
        };
        return this.runQuery(queryWithAggs, transform);
    }

    async countPerItemId(filter: UserActionsFilter): Promise<{ [itemId: string]: number }> {
        const { aliasedIndexName } = this.repoConfig;
        const query = await this.buildUserActionsQuery(filter, aliasedIndexName as string, { maxResults: 0 });
        const queryWithAggs = ESQueryBuilder.addTermsAggregationFilter(query, "data.itemId");
        const transform = (result: { [itemId: string]: number }) => {
            const buckets = result.aggregations["data.itemId_terms"]["buckets"];
            return buckets.reduce((reduced, bucket) => {
                const { key: itemId, doc_count } = bucket;
                return {
                    ...reduced,
                    [itemId]: doc_count,
                }
            }, {});
        }
        return this.runQuery(queryWithAggs, transform);
    }

    async multiInsertUserAction(userActions: IUserAction[], options?: MultiInsertOptions): Promise<IUserAction[]> {
        const { indexName } = this.repoConfig;

        // Remove duplicates & and generate id with UserActionIdentifier
        const userActionsMap = new Map<string, IUserAction>();
        for (const userAction of userActions) {
            const id = UserActionIdentifier.create(userAction).value();
            const actionWithValidId = { ...userAction, id };
            userActionsMap.set(id, actionWithValidId);
        }
        const nonDuplicateUserActions = Array.from(userActionsMap.values());
        const bulkBuilder = nonDuplicateUserActions.reduce(
            (builder, userAction) => builder.addCreate(
                indexName as string,
                userAction,
                userAction.id,
            ),
            new BulkBuilder([])
        );
        await this.runBulk(bulkBuilder, { ignoreDuplicates: true, refresh: options?.refresh });
        return nonDuplicateUserActions;
    }

    async multiUpdateUserAction(userActions: IUserAction[]): Promise<IUserAction[]> {
        const bulkBuilder = userActions.reduce(
            (builder, userAction) => {
                const { id, index } = userAction;
                const updatedUserAction = omit(["id", "index"], userAction);
                return builder.addIndex(index as string, updatedUserAction, id)
            }, new BulkBuilder([])
        );
        await this.runBulk(bulkBuilder, { ignoreDuplicates: true });
        return userActions;
    }

    private userActionFromESHit(esHit): IUserAction {
        const userAction = esHit["_source"];
        userAction["id"] = esHit["_id"];
        userAction["index"] = esHit["_index"];
        userAction["sort"] = esHit["sort"]
        return userAction;
    }

    private userActionsFromESHits({ hits }) {
        return {
            hits: hits.hits.map(this.userActionFromESHit),
            total: hits.total.value
        }
    }

    async forEach(filter: UserActionsFilter, action: (action: IUserAction) => void): Promise<void> {
        const { aliasedIndexName } = this.repoConfig;
        const query = await this.buildUserActionsQuery(filter, aliasedIndexName as string, { maxResults: 9999 });
        const processBatch = async (batch) => {
            for (const uAction of batch) {
                action(uAction._source);
            }
        }
        await this.runScroll(query, 500, 100, processBatch);
    }

    async findFirst(filter: UserActionsFilter, predicate: (u: IUserAction<unknown>) => boolean, orderBy?: string): Promise<Maybe<IUserAction<unknown>>> {
        const { aliasedIndexName } = this.repoConfig;
        const query = await this.buildUserActionsQuery(filter, aliasedIndexName as string, { maxResults: 9999, orderBy });
        let result = null;
        const processBatch = async (batch: unknown[]) => {
            for (const hit of batch) {
                const userAction = this.userActionFromESHit(hit);
                if (predicate(userAction)) {
                    result = userAction;
                    return true;
                }
            }
            return false;
        };
        await this.runScroll(query, 500, 50, processBatch);
        return Maybe.fromUndefinedOrNull(result);
    }

    async deleteUserActions(query: IUserActionQuery): Promise<number> {
        const { accountId, userActionType, ids } = query;
        if (accountId === undefined && userActionType === undefined && ids === undefined) {
            throw new Error("Error in deleteUserActions: Must specify at least one query property");
        }
        const queryParts = [];
        if (accountId) {
            queryParts.push({ term: { accountId } })
        }
        if (userActionType) {
            queryParts.push({ match: { userActionType } })
        }
        if (ids) {
            queryParts.push({ terms: { _id: ids } })
        }
        this.logger.debug(`Deleting useractions with queryParts ${JSON.stringify(queryParts)}`, "elastic-search");
        const esQuery = {
            index: this.repoConfig.aliasedIndexName,
            body: {
                query: {
                    bool: {
                        must: queryParts
                    }
                }
            }
        }

        try {
            const result = await this.deleteByQuery(esQuery);
            return result?.deleted || 0;
        } catch (err) {
            if (err?.body?.deleted) {
                return err.body.deleted;
            }
            throw err;
        }
    }


    async detectDuplicateUserActions(rangeStart: number): Promise<DupUserActionReport> {
        const { aliasedIndexName } = this.repoConfig;
        const query = {
            index: aliasedIndexName,
            body: {
                size: 0,
                query: {
                    range: {
                        start: {
                            gte: rangeStart
                        }
                    }
                },
                aggs: {
                    userActionDuplicates: {
                        terms: {
                            field: "userActionType",
                            size: 9999,
                        },
                        aggs: {
                            accountDuplicates: {
                                terms: {
                                    field: "accountId",
                                    size: 9999,
                                },
                                aggs: {
                                    startDuplicates: {
                                        terms: {
                                            field: "start",
                                            min_doc_count: 2,
                                            size: 9999,
                                        },
                                        aggs: {
                                            endDuplicates: {
                                                terms: {
                                                    field: "end",
                                                    min_doc_count: 2,
                                                    size: 9999,
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }


        const dupUserActionReport: DupUserActionReport = {};
        const transform = async (result) => {
            const parseAggregation = (resultAggregations) => {
                if (!resultAggregations) {
                    return {};
                }
                for (const userActionTypeBucket of resultAggregations.userActionDuplicates.buckets) {
                    for (const accountBucket of userActionTypeBucket.accountDuplicates.buckets) {
                        for (const startBucket of accountBucket.startDuplicates.buckets) {
                            for (const endBucket of startBucket.endDuplicates.buckets) {
                                if (endBucket.doc_count > 1) {
                                    const userActionType = userActionTypeBucket.key;
                                    const accountId = accountBucket.key;
                                    const start = startBucket.key;
                                    const end = endBucket.key;
                                    dupUserActionReport[accountId] = dupUserActionReport[accountId] || {};
                                    dupUserActionReport[accountId][userActionType] = dupUserActionReport[accountId][userActionType] || [];
                                    dupUserActionReport[accountId][userActionType].push({
                                        hash: hashUserAction(userActionType, accountId, start, end),
                                        count: endBucket.doc_count
                                    });
                                }
                            }
                        }
                    }
                }
                return dupUserActionReport;
            };
            return parseAggregation(result.aggregations);
        };
        return this.runQuery<DupUserActionReport>(query, transform, { requestTimeout: 60000 }); // 1 minute timeout instead of default 30 seconds
    }

    async dedupeUserActions(dupUserActionReport: DupUserActionReport): Promise<number> {
        const userActionIdsToDelete = [];
        for (const accountId of Object.keys(dupUserActionReport)) {
            for (const userActionType of Object.keys(dupUserActionReport[accountId])) {
                for (const { hash } of dupUserActionReport[accountId][userActionType]) {
                    const [, , start, end] = hash.split("_");
                    const userActions = await this.find({
                        accountId,
                        userActionTypes: [parseInt(userActionType)],
                        start: parseInt(start),
                        end: parseInt(end),
                    })
                    const idsToDelete = userActions.slice(1).map((uAction) => uAction.id)
                    userActionIdsToDelete.push(...idsToDelete);
                }
            }
        }
        return await this.deleteUserActions({ ids: userActionIdsToDelete });
    }

    async deleteUserActionsByFilter(filter: UserActionsFilter, maxItemsToDelete = MAX_RESULTS): Promise<number> {
        const esQuery = await this.buildUserActionsQuery(
            filter,
            this.repoConfig.aliasedIndexName as string,
            { maxResults: maxItemsToDelete }
        );
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = await this.deleteByQuery(esQuery as any);
            return result?.deleted || 0;
        } catch (err) {
            if (err?.body?.deleted) {
                return err.body.deleted;
            }
            throw err;
        }
    }

    private async buildUserActionsQuery(
        userActionsFilter: UserActionsFilter,
        indexName: string,
        options: ElasticSearchResultOptions,
        searchAfterElement?: (number | string)[]) {
        return buildUserActionsQuery(userActionsFilter, indexName, options, searchAfterElement)
    }


}
