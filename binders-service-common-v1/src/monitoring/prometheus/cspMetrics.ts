import * as prometheusClient from "prom-client";
import { createCounter, getMetricName } from "../prometheus";

let cspReportsCounter: prometheusClient.Counter | undefined;

const BLOCKED_URI_LABEL = "blocked_uri";
const EFFECTIVE_DIRECTIVE = "effective_directive";

export const createCspReportsCounter = (): void => {
    cspReportsCounter = createCounter(
        getMetricName("csp_report"),
        "Counter keeping track of browser reported CSP violations",
        [BLOCKED_URI_LABEL, EFFECTIVE_DIRECTIVE],
    );
};

export const incrementCspReportCounterByOne = (blockedUri: string, effectiveDirective: string): void => {
    cspReportsCounter?.inc({
        [BLOCKED_URI_LABEL]: blockedUri,
        [EFFECTIVE_DIRECTIVE]: effectiveDirective,
    }, 1);
};
