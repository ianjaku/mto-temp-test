import * as prometheusClient from "prom-client";
import { createCounter, getMetricName } from "../prometheus";

const CATEGORY_LABEL = "category"
const SERVICE_LABEL = "service"
export type Counter = prometheusClient.Counter;

let fatalErrorLogCounter;
let appServiceName = "";
export function createFatalErrorLogCounter(serviceName: string): void {
    appServiceName = serviceName
    const name = getMetricName("fatal_log_count");
    const help = "Counter keeping track of logged fatal erros inside app.";
    fatalErrorLogCounter = createCounter(name, help, [SERVICE_LABEL, CATEGORY_LABEL]);
}

export const incrementFatalErrorLogCounter = (category = "",serviceName?: string): void => {
    if(!fatalErrorLogCounter) {
        createFatalErrorLogCounter(serviceName)
    }
    if (fatalErrorLogCounter) {
        fatalErrorLogCounter.inc({ [SERVICE_LABEL]: appServiceName, [CATEGORY_LABEL]: category });
    }
}
