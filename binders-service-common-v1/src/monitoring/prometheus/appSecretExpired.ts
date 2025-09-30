import * as prometheusClient from "prom-client";
import { createCounter, getMetricName } from "../prometheus";


export type Counter = prometheusClient.Counter;
let azureAppExpiredSecretCounter;

export function createAzureAppExpiredSecretCounter(appDisplayName: string): void {
    const name = getMetricName("azure_app_has_expired_secret");
    const help = "Counter keeping track of azure apps that has expired";
    azureAppExpiredSecretCounter = createCounter(name, help, [appDisplayName]);
}

export const incrementAzureAppExpiredSecretCounter = (appDisplayName: string): void => {
    if (!azureAppExpiredSecretCounter) {
        createAzureAppExpiredSecretCounter(appDisplayName)
    }
    if (azureAppExpiredSecretCounter) {
        azureAppExpiredSecretCounter.inc({ [appDisplayName]: 1 }, 1);
    }
}
