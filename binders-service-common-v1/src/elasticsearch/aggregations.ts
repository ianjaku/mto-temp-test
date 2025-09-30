
export type Aggregation <T> = {
    groupBy: keyof T,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filter?: any
}

export interface BucketAggregation<T> extends Aggregation <T> {
    aggregation?: Aggregation<T>
}

export interface TermsAggregation<T>  extends BucketAggregation<T>{
    agg: "terms";
    size?: number;
}

export interface SumAggregation<T> extends Aggregation<T> {
    agg: "sum"
}

export interface CardinalityAggregation<T> extends Aggregation<T> {
    agg: "cardinality"
}

export type TimeBucket = "days" | "weeks" | "months";

export interface DateHistogramAggregation<T> extends BucketAggregation<T>{
    agg: "date_histogram",
    resolution: TimeBucket,
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const toAgg = <T>(agg: Aggregation<T>) => {
    if ((agg as DateHistogramAggregation<T>).agg === "date_histogram") {
        return toDateHistAgg(agg as DateHistogramAggregation<T>);
    }
    if ((agg as TermsAggregation<T>).agg === "terms") {
        return toTermsAgg(agg as TermsAggregation<T>);
    }
    if ((agg as SumAggregation<T>).agg === "sum") {
        return toSumAgg(agg as SumAggregation<T>);
    }
    if ((agg as CardinalityAggregation<T>).agg === "cardinality") {
        return toCardinalityAgg(agg as CardinalityAggregation<T>);
    }
    throw new Error(`Unknown aggregation ${JSON.stringify(agg)}`);
}

const toDateHistogramInterval = (bucket: TimeBucket) => {
    if (bucket === "days") {
        return "1d"
    }
    if (bucket === "weeks") {
        return "1w"
    }
    if (bucket === "months") {
        return "1M"
    }
    return "1d";
}

const toCardinalityAgg = <T>(agg: CardinalityAggregation<T>) => {
    return {
        [agg.agg]: {
            field: agg.groupBy
        }
    }
}

const toDateHistAgg = <T>(agg: DateHistogramAggregation<T>) => {
    const filter = agg.filter || {};
    return {
        [agg.agg]: {
            field: agg.groupBy,
            ...filter,
            interval: toDateHistogramInterval(agg.resolution)
        }
    }
}

const toTermsAgg = <T>(agg: TermsAggregation<T>) => {
    const filter = agg.filter || {};
    return {
        [agg.agg]: {
            field: agg.groupBy,
            ...filter,
            size: agg.size || 1000
        }
    }
}

const toSumAgg = <T>(agg: SumAggregation<T>) => {
    const filter = agg.filter || {};
    return {
        [agg.agg]: {
            field: agg.groupBy,
            ...filter
        }
    }
}