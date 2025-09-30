import * as prometheusClient from "prom-client";
import { createCounter, getMetricName } from "../prometheus";

let tooManyRequestsOnRouteCounter: prometheusClient.Counter;

export function createTooManyRequestsOnRouteCounter(route: string): void {
    const name = getMetricName(`too_many_requests_on_route_count_${route.replace(/\W+/g, "_")}`);
    const help = `Counter keeping track of the number of times we return 429 to the client for route ${route}`;
    tooManyRequestsOnRouteCounter = createCounter(name, help, []);
}

export const incrementTooManyRequestsOnRouteCounter = (route: string): void => {
    if (!tooManyRequestsOnRouteCounter) {
        createTooManyRequestsOnRouteCounter(route);
    }
    tooManyRequestsOnRouteCounter.inc();
}
