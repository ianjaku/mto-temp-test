import * as prometheusClient from "prom-client";
import { createCounter, getMetricName } from "../prometheus";

const COUNTER_LABEL = "duplicate_text_modules_conflict_detected";
const METADATA_LABEL = "metadata";

export type Counter = prometheusClient.Counter;
let duplicateTextModulesConflictCounter;

export function createDuplicateTextModulesConflictCounter(): void {
    const name = getMetricName("duplicate_text_modules_conflict");
    const help = "Counter keeping track of binders found with duplicate text modules that both have content so deduplicateTextModuleKeys code cannot fix it automatically. Suggested action is to manually remove one of the text modules and deeper investigate how this conflict could have happened.";
    duplicateTextModulesConflictCounter = createCounter(name, help, [COUNTER_LABEL, METADATA_LABEL]);
}

export const incrementDuplicateTextModulesConflictCounter = (metadata: {
    binderId: string,
    accountId: string,
    duplicateKeys: string,
}): void => {
    if (duplicateTextModulesConflictCounter) {
        duplicateTextModulesConflictCounter.inc({ [COUNTER_LABEL]: 1, [METADATA_LABEL]: JSON.stringify(metadata) }, 1);
    }
}
