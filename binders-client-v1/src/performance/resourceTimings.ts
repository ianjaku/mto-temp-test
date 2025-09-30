import { getQueryStringVariable } from "../util/uri";
import { isDev } from "../util/environment";

/*

    Queue -> Redirect checks -> App Cache -> DNS lookup -> TCP connect -> Send Request -> Wait for response -> Download response

    |----------------------------------------------- total duration ------------------------------------------------------------|

          |---- redirect ----|-- cache --|-----DNS -----|- connection -|

    |-------------------- request delay --------------------------------|------------ reponse delay ---------|---- download ----|

    |----------------------------------- time to first byte -------------------------------------------------|


    https://nicj.net/resourcetiming-in-practice/
    https://developer.mozilla.org/en-US/docs/Web/API/Resource_Timing_API/Using_the_Resource_Timing_API

*/

interface RequestTimingBreakdown {
    redirect: number;
    cache: number;
    dns: number;
    connection: number;
    requestDelay: number;
    responseDelay: number;
    download: number;
}

// https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming/initiatorType
export type InitiatorType = "audio" | "beacon" | "body"
    | "css" | "embed" | "fetch" | "frame" | "iframe" | "image"
    | "img" | "input" | "link" | "navigation" | "object" | "ping"
    | "script" | "track" | "video" | "xmlhttprequest";

export interface RequestPerformance {
    totalDuration: number;
    durationBreakdown: RequestTimingBreakdown;
    transferSize: number;
    cacheHit: boolean;
    name: string;
    initiatorType: InitiatorType
}

function resourceTimingToRequestBreakdown(browserResourceTiming: PerformanceResourceTiming): RequestTimingBreakdown {
    return {
        redirect: browserResourceTiming.redirectEnd - browserResourceTiming.redirectStart,
        cache: browserResourceTiming.domainLookupStart > 0 ?
            browserResourceTiming.domainLookupStart - browserResourceTiming.fetchStart :
            0,
        dns: browserResourceTiming.domainLookupEnd - browserResourceTiming.domainLookupStart,
        connection: browserResourceTiming.connectEnd - browserResourceTiming.connectStart,
        requestDelay: browserResourceTiming.requestStart > 0 ?
            browserResourceTiming.requestStart - browserResourceTiming.startTime:
            0,
        responseDelay: browserResourceTiming.responseStart - browserResourceTiming.requestStart,
        download: browserResourceTiming.responseEnd - (browserResourceTiming.responseStart || browserResourceTiming.fetchStart)
    }
}

function resourceTimingToRequestPerformance(browserResourceTiming: PerformanceResourceTiming): RequestPerformance {
    return {
        totalDuration: browserResourceTiming.duration,
        transferSize: browserResourceTiming.transferSize,
        cacheHit: browserResourceTiming.transferSize === 0 && browserResourceTiming.decodedBodySize > 0,
        durationBreakdown: resourceTimingToRequestBreakdown(browserResourceTiming),
        name: browserResourceTiming.name,
        initiatorType: browserResourceTiming.initiatorType as InitiatorType
    }
}

async function logSlowRequest(timing: PerformanceResourceTiming): Promise<void> {
    // eslint-disable-next-line no-console
    console.debug("[SLOW REQUEST]", timing.initiatorType, timing.name, timing.duration);
    // eslint-disable-next-line no-console
    console.debug(JSON.stringify(resourceTimingToRequestPerformance(timing), null, 4));
}

const DURATION_THRESHOLD = Number.parseInt(getQueryStringVariable("slowlogThreshold") || "2000", 10);

function perfObserver(list) {
    list.getEntries().forEach( (entry) => {
        if (entry.duration > DURATION_THRESHOLD) {
            logSlowRequest(entry);
        }
    })
}

function setupPerformanceObservers(): void {
    const observer = new PerformanceObserver(perfObserver);
    observer.observe({ entryTypes: [ "resource" ] });
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    resources.forEach( (resource) => {
        if (resource.duration > 2000) {
            logSlowRequest(resource);
        }
    });
}

export function maybeSetupPerformanceObservers(): void {
    const monitorPerformance = isDev() || getQueryStringVariable("slowlog") === "1";
    if (monitorPerformance) {
        setupPerformanceObservers();
    }
}