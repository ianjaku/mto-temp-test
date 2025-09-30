import {
    AllUserActionTypes,
    IEventFilter,
    UserActionType
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { ESQueryBuilder } from "@binders/binders-service-common/lib/elasticsearch/builder";
import { ElasticQuery } from "@binders/binders-service-common/lib/elasticsearch/elasticrepository";
import { ElasticSearchResultOptions } from "@binders/client/lib/clients/client";
import { IAggregationFilter } from "../models/aggregation";
import { MAX_RESULTS } from "../config";
import { UserActionsFilter } from "./userActionsRepository";
import mongoose from "mongoose";

const USERACTION_TYPES_TO_EXCLUDE_BY_DEFAULT: UserActionType[] = [
    UserActionType.NOT_READ,
    UserActionType.USER_ONLINE,
    UserActionType.COLLECTION_VIEW,
];

const DEFAULT_USERACTION_TYPES = AllUserActionTypes.filter(
    ua => !USERACTION_TYPES_TO_EXCLUDE_BY_DEFAULT.includes(ua)
);

export const queryFromEventFilterAndAccount = (accountId: string, filter: IEventFilter): Record<string, unknown> => {
    const query = queryFromEventFilter(filter);
    const accountIds = makeAccountIdsForFilter(accountId, filter);
    return {
        ...query,
        account_id: mongoose.trusted({ $in: accountIds.map(String) }),
    };
}

export const queryFromEventFilter = (filter: IEventFilter): Record<string, unknown> => {
    const { accountIds, eventTypes, excludeEventTypes, hasSessionId, hasAccountId, userId, data } = filter;
    const dataQueries: Record<string, unknown> = {};
    if (data) {
        Object.entries(data).forEach(([key, value]) => {
            dataQueries[`data.${key}`] = value;
        });
    }

    return {
        ...(accountIds ? { account_id: mongoose.trusted({ $in: accountIds.map(String) }) } : {}),
        ...(eventTypes ? { event_type: mongoose.trusted({ $in: eventTypes.map(Number) }) } : {}),
        ...(excludeEventTypes ? { event_type: mongoose.trusted({ $nin: excludeEventTypes.map(Number) }) } : {}),
        ...(hasSessionId !== undefined ? { "data.sessionId": mongoose.trusted({ $exists: Boolean(hasSessionId) }) } : {}),
        ...(hasAccountId !== undefined ? { "account_id": mongoose.trusted({ $exists: Boolean(hasAccountId) }) } : {}),
        ...(userId ? { user_id: userId } : {}),
        ...dataQueries,
        ...applyRange(filter),
        ...applyIdRange(filter),
        ...(filter.excludeEventsWithValidChunkTimingsMap ? { chunkTimingsMap: null } : {}),
    };
}

export const queryFromAggregationFilter = (accountId: string, filter: IAggregationFilter): Record<string, unknown> => {
    const { aggregatorTypes } = filter;
    const accountIds = makeAccountIdsForFilter(accountId, filter);
    return {
        account_id: mongoose.trusted({ $in: accountIds.map(String) }),
        ...(aggregatorTypes ? { aggregatorTypes: mongoose.trusted({ $in: aggregatorTypes.map(Number) }) } : {}),
        ...applyRange(filter),
    }
}

const makeAccountIdsForFilter = (accountId: string, filter: { accountIds?: string[] }): string[] => {
    const { accountIds } = filter;
    return [accountId].concat(accountIds || []).filter(acc => !!acc);
}

export const applyIdRange = (filter: IEventFilter | IAggregationFilter): Record<string, unknown> => {
    const { idRange } = filter;
    if (!idRange || Object.keys(idRange).length === 0) {
        return {};
    }
    const { startIdNonInclusive, endIdNonInclusive } = idRange;
    return {
        "_id": {
            ...(startIdNonInclusive ? mongoose.trusted({ $gt: String(startIdNonInclusive) }) : {}),
            ...(endIdNonInclusive ? mongoose.trusted({ $lt: String(endIdNonInclusive) }) : {})
        }
    };
}

export const applyRange = (filter: IEventFilter | IAggregationFilter): Record<string, unknown> => {
    const { range } = filter;
    if (!range || Object.keys(range).length === 0) {
        return {};
    }
    const { rangeStart, rangeEnd, fieldName, fallbackFieldName, excludeRangeStart, excludeRangeEnd } = range;
    const rangeStartOperator = excludeRangeStart ? "$gt" : "$gte";
    const rangeEndOperator = excludeRangeEnd ? "$lt" : "$lte";
    const byFieldName = {
        [fieldName]: {
            ...(rangeStart ? mongoose.trusted({ [rangeStartOperator]: new Date(rangeStart) }) : {}),
            ...(rangeEnd ? mongoose.trusted({ [rangeEndOperator]: new Date(rangeEnd) }) : {})
        }
    }
    return !fallbackFieldName ?
        byFieldName :
        {
            $or: [
                {
                    ...byFieldName,
                },
                {
                    $and: [
                        {
                            [fieldName]: mongoose.trusted({ $exists: false })
                        },
                        {
                            [fallbackFieldName]: {
                                ...(rangeStart ? mongoose.trusted({ [rangeStartOperator]: new Date(rangeStart) }) : {}),
                                ...(rangeEnd ? mongoose.trusted({ [rangeEndOperator]: new Date(rangeEnd) }) : {})
                            }
                        }
                    ],
                }
            ]
        };
}

export const buildUserActionsQuery = (
    userActionsFilter: UserActionsFilter,
    indexName: string,
    options: ElasticSearchResultOptions = { maxResults: MAX_RESULTS },
    searchAfterElement?: (number | string)[]
): ElasticQuery => {
    const { accountId, publicationIds, itemIds, binderIds, userIds, startRange, endRange,
        userActionTypes, incomplete, userIsAuthor, excludeUserActionTypes, excludeUserIds, start, end,
        missingField } = userActionsFilter;
    const must: Array<Record<string, unknown>> = [];
    const must_not: Record<string, unknown> = undefined;
    const filterParts = { must, must_not };

    if (accountId) {
        filterParts.must.push({
            term: {
                accountId,
            }
        });
    }
    if (itemIds && itemIds.length > 0) {
        filterParts.must.push({
            terms: {
                "data.itemId": itemIds
            }
        });
    }
    if (binderIds && binderIds.length > 0) {
        filterParts.must.push({
            terms: {
                "data.binderId": binderIds
            }
        });
    }
    if (incomplete) {
        filterParts.must.push({
            term: {
                "data.incomplete": incomplete,
            }
        });
    }
    if (userIds && userIds.length > 0) {
        filterParts.must.push({
            terms: {
                "userId": userIds
            }
        });
    }
    if (excludeUserIds?.length) {
        filterParts.must.push({
            "bool": {
                "must_not": {
                    "terms": {
                        "userId": excludeUserIds
                    }
                }
            }
        });
    }
    if (startRange) {
        const { rangeStart, rangeEnd } = startRange;
        if (rangeStart || rangeEnd) {
            filterParts.must.push({
                range: {
                    "start": {
                        ...(rangeStart ? { gte: new Date(rangeStart).toISOString() } : {}),
                        ...(rangeEnd ? { lte: new Date(rangeEnd).toISOString() } : {}),
                    }
                }
            });
        }
    }
    if (endRange) {
        const { rangeStart, rangeEnd } = endRange;
        if (rangeStart || rangeEnd) {
            filterParts.must.push({
                range: {
                    "end": {
                        ...(rangeStart ? { gte: new Date(rangeStart).toISOString() } : {}),
                        ...(rangeEnd ? { lte: new Date(rangeEnd).toISOString() } : {}),
                    }
                }
            });
        }
    }
    if (start) {
        filterParts.must.push({
            term: {
                "start": start,
            }
        });
    }
    if (end) {
        filterParts.must.push({
            term: {
                "end": end,
            }
        });
    }
    if (userActionTypes && userActionTypes.length > 0) {
        filterParts.must.push({
            terms: {
                userActionType: userActionTypes,
            }
        });
    } else {
        filterParts.must.push({
            terms: {
                userActionType: DEFAULT_USERACTION_TYPES,
            }
        })
    }
    if (excludeUserActionTypes && excludeUserActionTypes.length > 0) {
        filterParts.must.push({
            "bool": {
                "must_not": {
                    "terms": {
                        userActionType: excludeUserActionTypes
                    }
                }
            }
        });
    }
    if (publicationIds && publicationIds.length > 0) {
        filterParts.must.push({
            terms: {
                "data.publicationId": publicationIds
            }
        })
    }
    if (userIsAuthor === true) {
        filterParts.must.push({
            terms: {
                "data.userIsAuthor": ["true"],
            }
        })
    }
    if (userIsAuthor === false) {
        filterParts.must.push({
            bool: {
                should: [
                    {
                        terms: {
                            "data.userIsAuthor": ["false"]
                        }
                    },
                    {
                        bool: {
                            must_not: {
                                exists: { field: "data.userIsAuthor" }
                            }
                        }
                    }
                ]
            }
        })
    }

    if (missingField) {
        filterParts.must_not = {
            exists: {
                field: missingField,
            },
        };
    }

    const query = {
        bool: {
            ...filterParts
        }
    };
    const baseQuery = ESQueryBuilder.baseQuery(indexName, query, options);
    if (options.orderBy) {
        baseQuery["sort"] = `${options.orderBy}:desc`;
    } else {
        baseQuery["sort"] = ["start:desc", "accountId:desc", "userId:desc"];
    }

    if (searchAfterElement) {
        baseQuery["body"]["search_after"] = searchAfterElement
    }
    return baseQuery
}
