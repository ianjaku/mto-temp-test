import { Logger } from "@binders/binders-service-common/lib/util/logging";
import setupCorpSiteMonitor from "./monitors/corpsite";
import { setupRetagFailures } from "./monitors/retagFailures";

export function setupMonitor(logger: Logger): void {
    setupCorpSiteMonitor(logger);
    setupRetagFailures();
}