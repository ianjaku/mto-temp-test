import * as prometheusClient from "prom-client";
import { createCounter, getMetricName } from "../prometheus";
import { RepositoryConfig } from "../../elasticsearch/elasticrepository"

const LABEL_NAMES = ["index"];

export type Counter = prometheusClient.Counter;

const createSearchShardFailureCounter = (): Counter => {
    const name = getMetricName("elastic_search_shard_failures");
    const help = "Counter keeping track of the number of elastic search shard failures";
    const labelNames = LABEL_NAMES;
    return createCounter(name, help, labelNames);
};

let searchShardFailureCounter;

export function createElasticCounters(): void {
    searchShardFailureCounter = createSearchShardFailureCounter();
}

export type ESSearchResult = {
    _shards?: {
        failed?: number
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        failures: any
    }
}

export function incrementSearchShardFailureCounterFromSearchResult(searchResult: ESSearchResult, repoConfig: RepositoryConfig): void {
    if (searchResult?._shards?.failed) {
        // eslint-disable-next-line no-console
        console.log("SHARD FAILED", { shards: JSON.stringify(searchResult?._shards) })
        let { indexName } = repoConfig;
        if (Array.isArray(indexName)) {
            indexName = indexName.join(",");
        }
        incrementSearchShardFailureCounter(indexName || "n/a", searchResult._shards.failed);
    }
}

export const incrementSearchShardFailureCounter = (index: string, incValue = 1): void => {
    if (searchShardFailureCounter) {
        searchShardFailureCounter.inc({ index }, incValue)
    }
}