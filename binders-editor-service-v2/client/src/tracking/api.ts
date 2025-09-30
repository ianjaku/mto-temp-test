import { EventPayload } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { TrackingServiceClient } from "@binders/client/lib/clients/trackingservice/v1/client";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config";
import eventQueue from "@binders/client/lib/react/event/EventQueue";

export const trackingClient = TrackingServiceClient.fromConfig(config, "v1", browserRequestHandler);
eventQueue.setAuthTokenProvider(() => trackingClient.createLogAuthToken());

export function APILogEvents(events: EventPayload[], urgent: boolean, userId?: string): Promise<boolean> {
    return trackingClient.log(events.filter(e => !!e.eventType), userId, urgent)
}

export function APIReadSessionsCsv(accountId: string): Promise<string> {
    return trackingClient.readSessionsCsv(accountId);
}
