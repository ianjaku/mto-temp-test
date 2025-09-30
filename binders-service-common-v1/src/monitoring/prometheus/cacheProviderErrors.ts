import * as prometheusClient from "prom-client";
import { createCounter, getMetricName } from "../prometheus";

let cacheProviderErrorsCounter: prometheusClient.Counter | undefined;

export const createCacheProviderErrorsCounter = (): void => {
    cacheProviderErrorsCounter = createCounter(
        getMetricName("cache_provider_errors"),
        "Counter tracking the reported cache provider errors",
        [],
    );
};

export const incrementCacheProviderErrorsCounterByOne = (): void => {
    cacheProviderErrorsCounter?.inc();
};
