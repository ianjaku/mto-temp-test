import { Aggregation, BucketAggregation, toAgg } from "./aggregations";
import { ElasticSearchResultOptions } from "@binders/client/lib/clients/client";

type ESQuery = Record<string, unknown> & {
    body: {
        aggs?: Record<string, unknown>,
        query?: Record<string, unknown>
    }
}

export class ESQueryBuilder {

    static baseQuery(
        indexName: string | string[],
        queryBody: Record<string, unknown>,
        searchOptions?: ElasticSearchResultOptions
    ): ESQuery {
        const query = {
            index: indexName,
            body: {
                query: queryBody
            }
        };

        if (typeof searchOptions !== "undefined") {
            query["size"] = searchOptions.maxResults;
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


    static getById(
        indexName: string,
        idValue: string
    ): { index: string; id: string } {
        return {
            index: indexName,
            id: idValue
        };
    }

    static addTermsAggregationFilter(query, aggregationField: string): ESQuery {
        const aggsKey = `${aggregationField}_terms`;
        if (!query.body.aggs) {
            query.body.aggs = {};
        }
        query.body.aggs = {
            [aggsKey]: {
                "terms": {
                    "field": aggregationField,
                    "size": 9999
                }
            }
        };
        return query;
    }

    static addAggregations<T>(query, aggregation: Aggregation<T>): ESQuery {
        const getESAggregegation = (agg: Aggregation<T>) => {
            const subAgg = (agg as BucketAggregation<T>).aggregation ?
                getESAggregegation( (agg as BucketAggregation<T>).aggregation ) :
                {};
            return {
                "aggs": {
                    [agg.groupBy]: {
                        ...toAgg(agg),
                        ...subAgg
                    }
                }
            };

        };
        const allAggregations = getESAggregegation(aggregation);
        return {
            ...query,
            body: {
                ...query.body,
                ...allAggregations
            }
        }
    }
}
