import { BackendTrackingServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { EventType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { log } from "../logging";
import sleep from "@binders/binders-service-common/lib/util/sleep";

export async function waitForEvents(
    maxWaitInMilliSeconds: number, accountId: string,
    eventType: EventType, count: number
): Promise<void> {
    if (maxWaitInMilliSeconds <= 0) {
        throw new Error("Timed out waiting for events to be stored");
    }
    const config = BindersConfig.get();
    const trackingClient = await BackendTrackingServiceClient.fromConfig(config, "acceptance-testing");
    const filter = {
        eventTypes: [eventType]
    }
    const events = await trackingClient.findEvents(accountId, filter);
    log(`Found ${events.length} events out of ${count} for account ${accountId}`);
    if (events.length === count) {
        return;
    }
    const interval = 1000;
    await sleep(interval);
    return waitForEvents(maxWaitInMilliSeconds - interval, accountId, eventType, count);
}