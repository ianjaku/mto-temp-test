import * as prometheusClient from "prom-client";
import {
    createCounter,
    getMetricName
} from  "@binders/binders-service-common/lib/monitoring/prometheus";


const COUNTER_NAME_SUFFIX = "acr-retag-failures";
const COUNTER_NAME = getMetricName(COUNTER_NAME_SUFFIX);
let COUNTER: prometheusClient.Counter;

export function setupRetagFailures(): void {
    COUNTER = createCounter(COUNTER_NAME, "Check if the corp site is up and running", []);
}

export function incrementRetagFailures(): void {
    COUNTER.inc();
}