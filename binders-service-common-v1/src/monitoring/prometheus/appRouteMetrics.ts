import { createCounter, createHistogram, getMetricName } from "../prometheus";
import { WebRequest } from "../../middleware/request";

const LABEL_NAMES = ["verb", "route"];

const createRouteCounter = () => {
    const name = getMetricName("api_routes_count");
    const help = "Counter keeping track of the number of API calls";
    const labelNames = LABEL_NAMES;
    return createCounter(name, help, labelNames);
};

const createRouteDurationHistogram = () => {
    const name = getMetricName("api_routes_hist");
    const help = "Histogram of times spent per route in milliseconds";
    const labelNames = LABEL_NAMES;
    const buckets = [10, 100, 1000, 5000, 10000];
    return createHistogram(name, help, labelNames, buckets);
};

const counter = createRouteCounter();
const durationHistogram = createRouteDurationHistogram();

const getLabels = (request) => ({
    verb: request.method,
    route: (request.appRoute && request.appRoute.path)
});

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const updateRoutesCounter = (request: WebRequest) => {
    const labels = getLabels(request);
    counter.inc(labels, 1);
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const updateRoutesDuration = (request: WebRequest) => {
    if (request.timings && !!request.timings.duration) {
        const labels = getLabels(request);
        const { duration } = request.timings;
        durationHistogram.observe(labels, duration);
    }
};