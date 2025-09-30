import * as prometheusClient from "prom-client";
import { createCounter, getMetricName } from "../prometheus";

const SERVICE_LABEL = "service";
const REQUEST_PATH = "request_path";

let tooManyRequestsCounter: prometheusClient.Counter;
let appServiceName = "";

export function createTooManyRequestsCounter(serviceName: string): void {
    appServiceName = serviceName
    const name = getMetricName("too_many_requests_count");
    const help = "Counter keeping track of the number of times we return 429 to the client.";
    tooManyRequestsCounter = createCounter(name, help, [SERVICE_LABEL, REQUEST_PATH]);
}

export const incrementTooManyRequestsCounter = (requestPath: string, serviceName = ""): void => {
    if (!tooManyRequestsCounter) {
        createTooManyRequestsCounter(serviceName);
    }
    tooManyRequestsCounter.inc({ [SERVICE_LABEL]: appServiceName, [REQUEST_PATH]: requestPath });
}
