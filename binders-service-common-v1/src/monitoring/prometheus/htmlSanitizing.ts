import * as prometheusClient from "prom-client";
import { createCounter, getMetricName } from "../prometheus";

export const BINDER_COUNTER_LABEL = "binder_html_was_sanitized";
export const NOTIFICATION_COUNTER_LABEL = "notification_html_was_sanitized"
export const COMMENT_COUNTER_LABEL = "comment_html_was_sanitized"
export const FEEDBACK_COUNTER_LABEL = "feedback_html_was_sanitized"

export type Counter = prometheusClient.Counter;
let htmlSanitizerStrippedHtmlCounter;

export function createHtmlSanitizerStrippedHtmlCounter(counterLabel: string): void {
    const name = getMetricName("html_sanitizer_stripped_html");
    const help = "Counter keeping track of html that was stripped by sanitizing chunk html";
    htmlSanitizerStrippedHtmlCounter = createCounter(name, help, [counterLabel]);
}

export const incrementHtmlSanitizerStrippedHtmlCounter = (counterLabel: string): void => {
    if (htmlSanitizerStrippedHtmlCounter) {
        htmlSanitizerStrippedHtmlCounter.inc({ [counterLabel]: 1 }, 1);
    }
}
