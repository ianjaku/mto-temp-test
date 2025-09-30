/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/ban-types */
import {
    BinderFilter,
    BinderSearchResultOptions,
    CollectionFilter,
    HierarchicalFilter,
    PublicationAndCollectionFilter,
    PublicationFilter
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { ServerSideSearchOptions, isServerSideSearchOptions } from "../model";
import {
    ESQueryBuilder as CommonESQueryBuilder
} from "@binders/binders-service-common/lib/elasticsearch/builder";
import { DeleteByQueryRequest } from "@elastic/elasticsearch/api/types";
import { ESQueryBuilderHelper } from "./helper";
import { ElasticQuery } from "@binders/binders-service-common/lib/elasticsearch/elasticrepository";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { intersection } from "ramda";

const ADMIN_ACCOUNTS = [
    //   "aid-20fac188-7a97-458b-b186-b2a3511b3b78", // Toms test account
    //   "aid-0fb03b72-d6ed-4204-abbd-f64b8879b4a6"  // Binders
];
const IMPOSSIBLE_NAME = "BINDERSNONEEXISTINGNAME";
const MAX_BOOL_CLAUSE_NO = 1023

function createTermsFromIds(ids: string[], termField: string): Object {
    const queryPart = { terms: {} };
    queryPart.terms[termField] = ids;
    return queryPart;
}

function createPublicationQueryPart(binderId: string): Object {
    return {
        bool: {
            must: [
                {
                    term: { binderId }
                },
                {
                    term: { isActive: true }
                }
            ]
        }
    }
}

export class ESQueryBuilder {

    private static baseQuery(
        indexName: string | string[],
        queryBody: Object,
        searchOptions?: BinderSearchResultOptions,
    ) {
        const query = {
            index: indexName,
            body: {
                query: queryBody
            }
        };

        if (typeof searchOptions !== "undefined") {
            query["size"] = searchOptions.maxResults;
            if ("pagingOffset" in searchOptions) {
                query["from"] = searchOptions.pagingOffset;
            }
            if ("orderBy" in searchOptions) {
                const dirSuffix = searchOptions["ascending"] === false ? "desc" : "asc";
                query["sort"] = `${searchOptions["orderBy"]}:${dirSuffix}`;
            }
            if (searchOptions["resolveTotalHitsValue"]) {
                query["track_total_hits"] = true;
            }
        }
        return query;
    }

    static queryById(indexName: string | string[], idValue: string) {
        const query = {
            match: {
                _id: idValue
            }
        };
        return ESQueryBuilder.baseQuery(indexName, query);
    }

    static queryByIds(indexName: string | string[], idValues: string[]) {
        const query = {
            ids: {
                values: idValues
            }
        };
        const searchOptions = { maxResults: Math.min(9999, idValues.length * 2) }
        return ESQueryBuilder.baseQuery(indexName, query, searchOptions);
    }

    static getById(indexName: string | string[], idValue: string): { index: string, id: string, type?: string } {
        const query = {
            index: indexName as string,
            id: idValue
        };
        return query
    }

    static queryString(
        indexName: string | string[],
        queryString: string,
        accountId: string,
        searchOptions: BinderSearchResultOptions,
    ) {
        const query = this.getBindersQuery(queryString, searchOptions.strictLanguages)
        const baseQuery = ESQueryBuilder.baseQuery(indexName, query, searchOptions);
        return ESQueryBuilder.addAccountFilter(baseQuery, [accountId]);
    }

    static searchCollectionsQuery(
        indexName: string | string[],
        queryString: string,
        filter: BinderFilter,
        searchOptions: BinderSearchResultOptions,
        queryHelper: ESQueryBuilderHelper,
        logger?: Logger,
    ): Promise<Object> {
        return ESQueryBuilder.fromBinderOrPublicationFilter(indexName, filter, searchOptions, queryHelper, undefined, logger)
            .then(baseQuery => ESQueryBuilder.addFilter(baseQuery, this.getCollectionsQuery(queryString, searchOptions.strictLanguages)));
    }

    static queryStringWithFilter(
        indexName: string | string[],
        queryString: string,
        filter: BinderFilter,
        searchOptions: BinderSearchResultOptions,
        queryHelper: ESQueryBuilderHelper,
        searchableFields?: string[],
        logger?: Logger,
    ): Promise<Object> {

        let query
        if (searchableFields && searchableFields.length > 0) {
            query = {
                simple_query_string: {
                    query: queryString,
                    ...(searchableFields ? { fields: searchableFields } : {})
                },
            };
        } else {
            query = this.getBindersQuery(queryString, searchOptions.strictLanguages)
        }

        return ESQueryBuilder.fromBinderOrPublicationFilter(indexName, filter, searchOptions, queryHelper, undefined, logger)
            .then(baseQuery => ESQueryBuilder.addFilter(baseQuery, query));
    }

    public static getCollectionsQuery(queryString: string, languages?: string[]) {
        if (queryString === "") {
            return this.getSimpleSearchLanguageQuery(
                ["titles.languageCode"],
                languages
            );
        }
        return {
            nested: {
                path: "titles",
                query: {
                    bool: {
                        must: [
                            {
                                simple_query_string: {
                                    fields: [
                                        "titles.storyTitle",
                                        "titles.title"
                                    ],
                                    query: queryString
                                }
                            },
                            ...(
                                (languages == null || languages.length === 0) ?
                                    [] :
                                    [{
                                        bool: {
                                            should: languages.map(lang => ({
                                                term: {
                                                    "titles.languageCode": lang
                                                }
                                            }))
                                        }
                                    }]
                            )
                        ]
                    }
                },
                inner_hits: {
                    highlight: {
                        fields: {
                            "titles.title": {
                                "require_field_match": true
                            }
                        },
                        "pre_tags": [
                            "<span class=\"search-hit\">"
                        ],
                        "post_tags": [
                            "</span>"
                        ]
                    }
                }
            }
        };
    }

    private static getSimpleSearchLanguageQuery(
        fields: string[],
        languages: string[]
    ) {
        if (languages == null || languages.length === 0) {
            throw new Error("Query string and languages cannot both be empty");
        }
        const should = [];
        fields.forEach(field => {
            languages.forEach(lang => {
                should.push({
                    term: {
                        [field]: lang
                    }
                })
            });
        });
        return {
            bool: {
                should
            }
        }
    }

    private static getBindersQuery(queryString: string, languages?: string[]) {
        if (queryString === "") {
            return this.getSimpleSearchLanguageQuery(
                ["languages.iso639_1", "modules.text.chunked.iso639_1"],
                languages
            );
        }
        return {
            bool: {
                should: [
                    {
                        nested: {
                            path: "languages",
                            query: {
                                bool: {
                                    must: [
                                        {
                                            simple_query_string: {
                                                fields: [
                                                    "languages.storyTitle",
                                                    "languages.title"
                                                ],
                                                query: queryString
                                            }
                                        },
                                        ...(
                                            (languages == null || languages.length === 0) ?
                                                [] :
                                                [{
                                                    bool: {
                                                        should: languages.map(lang => ({
                                                            term: {
                                                                "languages.iso639_1": lang
                                                            }
                                                        }))
                                                    }
                                                }]
                                        )
                                    ]
                                }
                            },
                            inner_hits: {
                                highlight: {
                                    fields: {
                                        "languages.storyTitle": {
                                            "require_field_match": true
                                        }
                                    },
                                    "pre_tags": [
                                        "<span class=\"search-hit\">"
                                    ],
                                    "post_tags": [
                                        "</span>"
                                    ]
                                }
                            }
                        }
                    },
                    {
                        bool: {
                            must: [
                                // to make sure we don't match on html and css in the chunks, a search hit is only valid when it appears
                                // both in the analyzed html-stripped field (textContent), and the normal non-analyzed field (chunks).
                                // We can't ditch the latter here because we need it for the highlights formatting (which doesn't work on analyzed fields)
                                {
                                    nested: {
                                        path: "modules.text.chunked",
                                        query: {
                                            simple_query_string: {
                                                fields: [
                                                    "modules.text.chunked.chunks.textContent"
                                                ],
                                                query: queryString
                                            }
                                        }
                                    }
                                },
                                {
                                    nested: {
                                        path: "modules.text.chunked",
                                        query: {
                                            bool: {
                                                must: [
                                                    {
                                                        simple_query_string: {
                                                            fields: [
                                                                "modules.text.chunked.chunks"
                                                            ],
                                                            query: queryString
                                                        }
                                                    },
                                                    ...(
                                                        (languages == null || languages.length === 0) ?
                                                            [] :
                                                            [{
                                                                bool: {
                                                                    should: languages.map(lang => ({
                                                                        term: {
                                                                            "modules.text.chunked.iso639_1": lang
                                                                        }
                                                                    }))
                                                                }
                                                            }]
                                                    )
                                                ]
                                            }
                                        },
                                        inner_hits: {
                                            highlight: {
                                                fields: {
                                                    "modules.text.chunked.chunks": {
                                                        "require_field_match": true
                                                    }
                                                },
                                                "pre_tags": [
                                                    "<span class=\"search-hit\">"
                                                ],
                                                "post_tags": [
                                                    "</span>"
                                                ],
                                                number_of_fragments: 10,
                                            }
                                        }
                                    }
                                }
                            ]
                        }
                    }
                ]
            }
        };
    }

    static publicationQueryString(
        indexName: string | string[],
        queryString: string,
        filter: BinderFilter,
        searchOptions: BinderSearchResultOptions,
        queryHelper: ESQueryBuilderHelper,
        logger?: Logger,
    ): Promise<Object> {
        let query = {
            bool: {
                ...(searchOptions?.strictLanguages == null ?
                    {} :
                    {
                        must: [
                            {
                                bool: {
                                    should: searchOptions.strictLanguages.map(lang => ({
                                        term: {
                                            "language.iso639_1": lang
                                        }
                                    }))
                                }
                            }
                        ]
                    }),
                should: [
                    ...(searchOptions.preferredLanguages == null ?
                        [] :
                        [{
                            terms: {
                                "language.iso639_1": searchOptions.preferredLanguages,
                                boost: 2
                            }
                        }]),
                    {
                        nested: {
                            path: "language",
                            query: {
                                simple_query_string: {
                                    fields: [
                                        "language.storyTitle",
                                    ],
                                    query: queryString
                                }
                            }
                        }
                    },
                    {
                        bool: {
                            must: [
                                {
                                    nested: {
                                        path: "modules.text.chunked",
                                        query: {
                                            simple_query_string: {
                                                fields: [
                                                    "modules.text.chunked.chunks.textContent"
                                                ],
                                                query: queryString
                                            }
                                        },
                                    }
                                },
                                {
                                    nested: {
                                        path: "modules.text.chunked",
                                        query: {
                                            simple_query_string: {
                                                fields: [
                                                    "modules.text.chunked.chunks"
                                                ],
                                                query: queryString
                                            }
                                        },
                                    }
                                }
                            ]
                        }
                    }
                ]
            }
        };
        if (queryString === "") {
            query = this.getSimpleSearchLanguageQuery(["language.iso639_1"], searchOptions.strictLanguages);
        }

        return ESQueryBuilder.fromBinderOrPublicationFilter(indexName, filter, searchOptions, queryHelper, undefined, logger)
            .then(baseQuery => ESQueryBuilder.addFilter(baseQuery, query));

    }

    static baseQueryWithSource(
        indexName: string | string[],
        queryBody: Object,
        source: string | string[] | false,
        searchOptions?: BinderSearchResultOptions,
    ) {
        // @see https://www.elastic.co/guide/en/elasticsearch/reference/current/search-request-source-filtering.html
        const baseQuery = ESQueryBuilder.baseQuery(
            indexName,
            queryBody,
            searchOptions,
        );
        return {
            ...baseQuery,
            body: {
                ...baseQuery.body,
                _source: source,
            },
        };
    }

    private static buildLanguagesFilter(languageCodes: string[]): Object {
        const orParts = [];
        languageCodes.forEach(languageCode => {
            orParts.push({ term: { "language.iso639_1": languageCode } });
        });
        if (orParts.length === 0) {
            return { term: { "language.iso639_1": IMPOSSIBLE_NAME } };
        }
        else {
            return { bool: { should: orParts } };
        }
    }

    private static buildhierarchicalIncludeFilters(filters: HierarchicalFilter[]) {
        return {
            bool: {
                must: filters.map(itemIds => ({
                    bool: {
                        should: [
                            {
                                terms: {
                                    ancestorIds: itemIds
                                }
                            },
                            {
                                terms: {
                                    "_id": itemIds
                                }
                            },
                            {
                                terms: {
                                    "binderId": itemIds
                                }
                            }
                        ]
                    }
                }))
            }
        }
    }

    private static buildHierarchicalExcludeFilters(filters: HierarchicalFilter[]) {
        return {
            bool: {
                must_not: filters.map(itemIds => ({
                    bool: {
                        should: [
                            {
                                terms: {
                                    ancestorIds: itemIds
                                }
                            },
                            {
                                terms: {
                                    "_id": itemIds
                                }
                            },
                            {
                                terms: {
                                    "binderId": itemIds
                                }
                            }
                        ]
                    }
                }))
            }
        }
    }

    static buildAccountsFilter(accounts: string[]): Object {
        const orParts = [];
        accounts.forEach(account => {
            orParts.push({ term: { accountId: account } });
        });
        if (orParts.length === 0) {
            return { match_all: {} };
        }
        else {
            return { bool: { should: orParts } };
        }
    }

    static buildSoftDeleteFilter(
        filter: "show-deleted" | "show-non-deleted" = "show-non-deleted",
    ) {
        return {
            bool: {
                [filter === "show-non-deleted" ? "must_not" : "must"]: {
                    exists: {
                        field: "deletionTime"
                    }
                }
            }
        };
    }

    // Either both deletedGroupCount AND deletedGroupCount must both exist or neither must exist
    static buildHideRecursiveDeleteDescendantsFilter() {
        return {
            bool: {
                should: [
                    {
                        bool: {
                            must: [
                                {
                                    exists: {
                                        field: "deletedGroupCount"
                                    }
                                },
                                {
                                    exists: {
                                        field: "deletedGroupCollectionId"
                                    }
                                }
                            ]
                        }
                    },
                    {
                        bool: {
                            must_not: {
                                exists: {
                                    field: "deletedGroupCollectionId"
                                }
                            }
                        }
                    }
                ]
            }
        }
    }

    static buildDeletedByFilter(userId: string) {
        return {
            term: {
                deletedById: userId
            }
        }
    }

    static buildDeletedGroupFilter(collectionId: string) {
        return {
            term: {
                deletedGroupCollectionId: collectionId
            }
        }
    }

    static buildDeletionTimeRangeFilter(
        from: Date | null,
        until: Date | null
    ) {
        return {
            bool: {
                must: {
                    range: {
                        deletionTime: {
                            gte: from ?? undefined,
                            lte: until ?? undefined
                        }
                    }
                }
            }
        }
    }

    static async fromPublicationFilter(
        indexName: string | string[],
        filter: PublicationFilter,
        searchOptions: BinderSearchResultOptions,
        helper: ESQueryBuilderHelper,
        allowedAccounts?: string[],
        logger?: Logger
    ): Promise<ElasticQuery> {
        const baseQuery = await ESQueryBuilder.fromBinderOrPublicationFilter(indexName, filter, searchOptions, helper, allowedAccounts, logger);
        return filter.isActive === undefined ?
            baseQuery :
            ESQueryBuilder.addActiveFilter(baseQuery, filter.isActive === 1);
    }

    static fromPublicationFilterAggregated(
        indexName: string | string[],
        filter: PublicationFilter,
        searchOptions: BinderSearchResultOptions,
        helper: ESQueryBuilderHelper,
        aggregationField: string,
        logger?: Logger,
    ): Promise<ElasticQuery> {
        return this.fromPublicationFilter(indexName, filter, searchOptions, helper, undefined, logger)
            .then(query => CommonESQueryBuilder.addTermsAggregationFilter(query, aggregationField));
    }


    static maybeDivideIdsIntoMultipleTerms(ids: string[], termField: string) {
        if (!ids || ids.length === 0) {
            return undefined
        }
        const copiedIds = [...ids]
        const idsTermsParts = []

        while (copiedIds.length > 0) {
            const termsPart = createTermsFromIds(copiedIds.splice(0, MAX_BOOL_CLAUSE_NO), termField)
            idsTermsParts.push(termsPart)
        }
        return {
            bool: {
                should: idsTermsParts
            }
        };
    }

    private static maybeDivideBindersIdsForPublication(binderIds: string[]) {
        if (!binderIds || binderIds.length === 0) {
            return undefined
        }
        const copiedIds = [...binderIds]
        const queryParts = []

        while (copiedIds.length > 0) {
            const bindersIds = copiedIds.splice(0, MAX_BOOL_CLAUSE_NO)
            queryParts.push({
                bool: {
                    should: bindersIds.map(createPublicationQueryPart)
                }
            })
        }

        return queryParts
    }

    static deleteAllForAccount(
        indexName: string | string[],
        accountId: string
    ): DeleteByQueryRequest {
        return {
            index: indexName,
            body: {
                query: {
                    term: {
                        accountId
                    }
                }
            }
        }
    }

    static async fromBinderOrPublicationFilter(
        indexName: string | string[],
        filter: BinderFilter & PublicationFilter & CollectionFilter,
        searchOptions: BinderSearchResultOptions | ServerSideSearchOptions,
        helper: ESQueryBuilderHelper,
        allowedAccounts?: string[],
        logger?: Logger,
    ): Promise<ElasticQuery> {
        const binderIdField = isServerSideSearchOptions(searchOptions) && searchOptions.binderIdField ?
            searchOptions.binderIdField :
            "binderId";
        const filterParts: Promise<Object>[] = [];
        const publicationFilter = filter;
        if (publicationFilter.ids !== undefined && publicationFilter.ids.length > 0) {
            const queryPart = ESQueryBuilder.maybeDivideIdsIntoMultipleTerms(filter.ids, "_id")
            if (queryPart) {
                filterParts.push(Promise.resolve(queryPart));
            }
        }
        if (filter.binderIds !== undefined && filter.binderIds.length > 0) {
            const binderIdsOr = filter.binderIds.length > 0 ?
                ESQueryBuilder.maybeDivideIdsIntoMultipleTerms(filter.binderIds, binderIdField) :
                { term: { binderId: IMPOSSIBLE_NAME } };

            filterParts.push(Promise.resolve(binderIdsOr));
        }
        if (filter.ids !== undefined && filter.ids.length > 0) {
            const idsOr = filter.ids.length > 0 ?
                ESQueryBuilder.maybeDivideIdsIntoMultipleTerms(filter.ids, "_id") :
                { term: { binderId: IMPOSSIBLE_NAME } };

            filterParts.push(Promise.resolve(idsOr));
        }
        if (filter.minCreatedDate != null) {
            filterParts.push(Promise.resolve({
                range: {
                    created: {
                        gte: new Date(filter.minCreatedDate)
                    }
                }
            }));
        }
        if (filter.binderId !== undefined) {
            const queryPart = { term: {} };
            queryPart.term[binderIdField] = filter.binderId;
            filterParts.push(Promise.resolve(queryPart));
        }
        if (filter.languageCodes !== undefined) {
            filterParts.push(Promise.resolve(ESQueryBuilder.buildLanguagesFilter(filter.languageCodes)));
        }
        if (filter.hierarchicalIncludeFilters != null && filter.hierarchicalIncludeFilters.length > 0) {
            filterParts.push(Promise.resolve(ESQueryBuilder.buildhierarchicalIncludeFilters(filter.hierarchicalIncludeFilters)));
        }
        if (filter.hierarchicalExcludeFilters != null && filter.hierarchicalExcludeFilters.length > 0) {
            filterParts.push(Promise.resolve(ESQueryBuilder.buildHierarchicalExcludeFilters(filter.hierarchicalExcludeFilters)));
        }
        if (filter.domain !== undefined) {
            filterParts.push(
                helper.mapDomainToAccountIds(filter.domain)
                    .then(aids => ESQueryBuilder.buildAccountsFilter(aids))
            );
        }
        if (filter.showInOverview !== undefined) {
            filterParts.push(Promise.resolve({ term: { showInOverview: filter.showInOverview } }));
        }
        const softDeleteFilter = (filter as BinderFilter)?.softDelete?.show ?? "show-non-deleted";
        if (softDeleteFilter !== "show-all") {
            filterParts.push(
                Promise.resolve(
                    ESQueryBuilder.buildSoftDeleteFilter(softDeleteFilter)
                )
            );
        }
        const hideRecursiveDescendants = (filter as BinderFilter)?.softDelete?.hideRecursiveDeleteDescendants;
        if (hideRecursiveDescendants === true) {
            filterParts.push(
                Promise.resolve(
                    ESQueryBuilder.buildHideRecursiveDeleteDescendantsFilter()
                )
            );
        }
        const deletedGroupCollectionId = (filter as BinderFilter)?.deletedGroupCollectionId;
        if (deletedGroupCollectionId != null) {
            filterParts.push(
                Promise.resolve(
                    ESQueryBuilder.buildDeletedGroupFilter(
                        deletedGroupCollectionId
                    )
                )
            )
        }
        const deletedById = (filter as BinderFilter)?.softDelete?.deletedById
        if (deletedById != null) {
            filterParts.push(
                Promise.resolve(
                    ESQueryBuilder.buildDeletedByFilter(deletedById)
                )
            );
        }
        const deletionTimeRange = (filter as BinderFilter)?.softDelete?.dateRange;
        if (deletionTimeRange != null) {
            filterParts.push(
                Promise.resolve(
                    ESQueryBuilder.buildDeletionTimeRangeFilter(
                        new Date(deletionTimeRange.from),
                        new Date(deletionTimeRange.until)
                    )
                )
            )
        }
        if (filter.domainCollection) {
            filterParts.push(
                Promise.resolve({ term: { domainCollectionId: filter.domainCollection } })
            );
        }
        if (filter.accountId) {
            filterParts.push(
                Promise.resolve({ term: { accountId: filter.accountId } })
            );
        }
        if (filter.accountIds) {
            filterParts.push(
                Promise.resolve(ESQueryBuilder.buildAccountsFilter(filter.accountIds))
            );
        }
        if ((<CollectionFilter>filter).rootCollections) {
            filterParts.push(Promise.resolve(ESQueryBuilder.buildRootCollectionsFilter((<CollectionFilter>filter).rootCollections)));
        }

        const resolvedFilterParts = await Promise.all(filterParts);
        const validFilterParts = resolvedFilterParts.filter(p => p != null);
        if (validFilterParts.length < resolvedFilterParts.length) {
            logger?.error("Unexpected null filter parts while building the query!", "es-query-builder");
        }
        if (validFilterParts.length === 0) {
            throw new Error(`Invalid filter matches all: ${JSON.stringify(filter, null, 2)}`);
        }
        const query = {
            bool: {
                must: validFilterParts
            }
        };

        const baseQuery = ESQueryBuilder.baseQuery(indexName, query, searchOptions);
        if (!allowedAccounts) {
            return baseQuery;
        }
        return ESQueryBuilder.addAccountFilter(baseQuery, allowedAccounts);
    }

    static buildRootCollectionsFilter(accountIds: string[]) {
        function buildAccountIdFilter(accountId: string) {
            return {
                bool: {
                    must: [
                        { term: { accountId } },
                        { term: { isRootCollection: true } }
                    ]
                }
            };
        }
        return {
            bool: {
                should: accountIds.map(buildAccountIdFilter)
            }
        };
    }

    static buildCountByElementQuery(
        indexName: string | string[],
        elementKeys: Array<string>,
        aggregationField: string
    ): ElasticQuery {
        const baseQuery = ESQueryBuilder.baseQuery(indexName, undefined);
        const filtersObj = elementKeys.reduce((reduced, key) => {
            return {
                ...reduced,
                [key]: {
                    "nested": {
                        "query": {
                            "term": {
                                "elements.key": key,
                            }
                        },
                        "path": "elements"
                    }
                }
            };
        }, {});
        const keysAggregation = {
            [aggregationField]: {
                "filters": {
                    "filters": filtersObj,
                },
                "aggs": {
                    "count": {
                        "nested": {
                            "path": "elements"
                        },
                        "aggs": {
                            "elementCount": {
                                "terms": {
                                    "field": "elements.key",
                                    "size": 999
                                }
                            }
                        }
                    }
                }
            }
        };
        baseQuery.body["size"] = 0;
        baseQuery.body["aggs"] = keysAggregation;
        return baseQuery;
    }

    static fromPublicationAndCollectionFilter(
        indexName: string | string[],
        filter: PublicationAndCollectionFilter,
        searchOptions: BinderSearchResultOptions,
        domainCollectionId?: string
    ): ElasticQuery {
        const idsOrParts = [];
        if (filter.ids !== undefined && filter.ids.length > 0) {
            const queryPart = ESQueryBuilder.maybeDivideIdsIntoMultipleTerms(filter.ids, "_id")
            if (queryPart) {
                idsOrParts.push(queryPart);
            }
        }
        if (filter.binderIds !== undefined && filter.binderIds.length > 0) {
            const queryParts = ESQueryBuilder.maybeDivideBindersIdsForPublication(filter.binderIds)
            if (queryParts) {
                idsOrParts.push(...queryParts);
            }
        }

        const binderIdsOr = idsOrParts.length > 0 ?
            idsOrParts :
            [{ term: { _id: IMPOSSIBLE_NAME } }];
        let query: Object;
        if (binderIdsOr && binderIdsOr.length > 0) {
            query = {
                bool: {
                    should: [...binderIdsOr]
                }
            };
        } else {
            query = { match_all: {} };
        }

        const baseQuery = ESQueryBuilder.baseQuery(indexName, query, searchOptions);

        if (!domainCollectionId) {
            return baseQuery;
        }
        return ESQueryBuilder.addDomainCollectionIdFilter(baseQuery, domainCollectionId);
    }

    static addHighlighting(
        query,
        fields: string[],
    ) {
        const newQuery = Object.assign({}, query);
        const fieldsMap = fields.reduce<Record<string, Record<string, boolean>>>((map, field) => {
            map[field] = { "require_field_match": false };
            return map;
        }, {});
        newQuery["body"]["highlight"] = {
            "fields": fieldsMap,
            "pre_tags": ["<span class=\"search-hit\">"],
            "post_tags": ["</span>"],
            "number_of_fragments": 10,
        };
        return newQuery;
    }

    private static addFilter(query, filter) {
        const newQuery = Object.assign({}, query);
        newQuery["body"]["query"] = {
            bool: {
                must: [
                    filter,
                    query["body"]["query"]
                ]
            }
        };
        return newQuery;
    }

    private static addAccountFilter(query, allowedAccounts?: string[]) {
        if (intersection(allowedAccounts, ADMIN_ACCOUNTS).length !== 0) {
            return query;
        }
        if (allowedAccounts === undefined) {
            return query;
        }
        const accountFilter = ESQueryBuilder.buildAccountsFilter(allowedAccounts);
        return ESQueryBuilder.addFilter(query, accountFilter);
    }

    private static addDomainCollectionIdFilter(query, domainCollectionId: string) {
        if (domainCollectionId === undefined) {
            return query;
        }
        return ESQueryBuilder.addFilter(query, { term: { domainCollectionId } });
    }

    static addActiveFilter(query, isActive) {
        return ESQueryBuilder.addFilter(query, { term: { isActive: isActive ? "true" : "false" } });
    }

    static addNotHiddenFilter(query) {
        return ESQueryBuilder.addFilter(query, {
            bool: {
                should: [
                    {
                        term: {
                            isHidden: false,
                        }
                    },
                    {
                        bool: {
                            must_not: {
                                exists: { field: "isHidden" },
                            }
                        }
                    },
                ],
            }
        });
    }

    static addIsHiddenFilter(query) {
        return ESQueryBuilder.addFilter(query, { term: { "isHidden": "true" } });
    }

    static addNotBelongToHidden(query, hiddenCollectionsElementsIds) {
        return ESQueryBuilder.addFilter(query, {
            bool: {
                must_not: {
                    terms: {
                        binderId: hiddenCollectionsElementsIds,
                    }
                }
            }
        });
    }

    static async fromCollectionFilter(
        indexName: string | string[],
        filter: CollectionFilter,
        searchOptions: BinderSearchResultOptions,
        helper: ESQueryBuilderHelper,
    ): Promise<ElasticQuery> {
        const binderIdField = (<ServerSideSearchOptions>searchOptions).binderIdField ? (<ServerSideSearchOptions>searchOptions).binderIdField : "binderId";
        const filterParts: Array<Promise<Object>> = [];
        if (filter.binderId !== undefined) {
            const queryPart = { term: {} };
            queryPart.term[binderIdField] = filter.binderId;
            filterParts.push(Promise.resolve(queryPart));
        }

        if (filter.ids && filter.ids.length > 0) {
            const termsIdsQuery = ESQueryBuilder.maybeDivideIdsIntoMultipleTerms(filter.ids, "_id")
            if (termsIdsQuery) {
                filterParts.push(Promise.resolve(termsIdsQuery));
            }
        }
        if (filter.itemIds && filter.itemIds.length > 0) {
            const termsIdsQuery = ESQueryBuilder.maybeDivideIdsIntoMultipleTerms(filter.itemIds, "elements.key")
            const deletedTermsIdsQuery = ESQueryBuilder.maybeDivideIdsIntoMultipleTerms(filter.itemIds, "deletedElements.key")
            if (termsIdsQuery) {
                const nestedQuery = {
                    bool: {
                        should: [
                            {
                                nested: {
                                    query: {
                                        ...termsIdsQuery
                                    },
                                    path: "elements"
                                }
                            },
                            {
                                nested: {
                                    query: {
                                        ...deletedTermsIdsQuery
                                    },
                                    path: "deletedElements",
                                }
                            }
                        ]
                    }
                }
                filterParts.push(Promise.resolve(nestedQuery));
            }
        }
        const softDeleteFilter = (filter as BinderFilter)?.softDelete?.show ?? "show-non-deleted";
        if (softDeleteFilter !== "show-all") {
            filterParts.push(
                Promise.resolve(
                    ESQueryBuilder.buildSoftDeleteFilter(softDeleteFilter)
                )
            );
        }
        const deletedById = (filter as BinderFilter)?.softDelete?.deletedById
        if (deletedById != null) {
            filterParts.push(
                Promise.resolve(
                    ESQueryBuilder.buildDeletedByFilter(deletedById)
                )
            );
        }
        const deletionTimeRange = (filter as BinderFilter)?.softDelete?.dateRange;
        if (
            deletionTimeRange != null &&
            (deletionTimeRange.from != null || deletionTimeRange.until != null)
        ) {
            filterParts.push(
                Promise.resolve(
                    ESQueryBuilder.buildDeletionTimeRangeFilter(
                        deletionTimeRange.from ? new Date(deletionTimeRange.from) : null,
                        deletionTimeRange.until ? new Date(deletionTimeRange.until) : null
                    )
                )
            )
        }
        if (filter.languageCodes && filter.languageCodes.length > 0) {
            filterParts.push(Promise.resolve(ESQueryBuilder.buildLanguagesFilter(filter.languageCodes)));
        }

        if (filter.rootCollections && filter.rootCollections.length > 0) {
            filterParts.push(Promise.resolve(ESQueryBuilder.buildRootCollectionsFilter(filter.rootCollections)));
        }
        if (filter.showInOverview !== undefined) {
            filterParts.push(Promise.resolve({ term: { showInOverview: filter.showInOverview } }));
        }
        if (filter.domainCollection) {
            filterParts.push(Promise.resolve({ term: { domainCollectionId: filter.domainCollection } }));
        }
        function updateAccounts(domain: string): Promise<string[]> {
            return helper.mapDomainToAccountIds(domain);
        }
        let allowedAccountIds = [];
        if (filter.domain || filter.accountId) {
            allowedAccountIds = filter.domain ?
                await updateAccounts(filter.domain) :
                [filter.accountId];
        } else if (filter.accountIds) {
            allowedAccountIds = filter.accountIds;
        }
        const resolvedFilterParts = await Promise.all(filterParts);
        let query: Object;
        if (resolvedFilterParts.length === 0 && allowedAccountIds.length === 0) {
            throw new Error("No filter defined.");
        }
        if (resolvedFilterParts.length > 0) {
            query = {
                bool: {
                    must: resolvedFilterParts
                }
            };
        }
        else {
            query = { match_all: {} };
        }

        const baseQuery = ESQueryBuilder.baseQuery(indexName, query, searchOptions);
        return ESQueryBuilder.addAccountFilter(baseQuery, allowedAccountIds);
    }

    static buildItemsWithOwnerFilter(
        indexName: string | string[],
        ownerId: string,
        accountId: string
    ): Promise<ElasticQuery> {
        const query = {
            bool: {
                should: {
                    nested: {
                        path: "ownership",
                        query: {
                            bool: {
                                filter: [
                                    {
                                        term: { "ownership.ids": ownerId }
                                    }
                                ]
                            }
                        }
                    }
                }
            }
        };
        const searchOptions = { maxResults: 9999 };
        const baseQuery = ESQueryBuilder.baseQuery(indexName, query, searchOptions);
        return ESQueryBuilder.addAccountFilter(baseQuery, [accountId]);
    }
}