import * as prometheusClient from "prom-client";
import { createCounter, getMetricName } from "../prometheus";

const counterLabel = "authorization_cache_invalid";

let invalidAuthorizationCacheCounter: prometheusClient.Counter;

export function createInvalidAuthorizationCacheCounter(): void {
    if (invalidAuthorizationCacheCounter != null) return;
    const name = getMetricName("authorization_cache_invalid");
    const help = "This counter keeps track of every time the authorization cache was not equal to the live version.";
    invalidAuthorizationCacheCounter = createCounter(name, help, [counterLabel]);
}

export const incrementInvalidAuthorizationCacheCounter = (): void => {
    if (invalidAuthorizationCacheCounter) {
        invalidAuthorizationCacheCounter.inc({ [counterLabel]: 1 }, 1);
    }
}
