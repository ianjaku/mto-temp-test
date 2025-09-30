import {
    AccountsLastUsageInformation,
    EventPayload
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { TrackingServiceClient } from "@binders/client/lib/clients/trackingservice/v1/client";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import config from "../config";
import eventQueue from "@binders/client/lib/react/event/EventQueue";


export const trackingClient = TrackingServiceClient.fromConfig(config, "v1", browserRequestHandler);
eventQueue.setAuthTokenProvider(() => trackingClient.createLogAuthToken());

export const APILogEvents = (events: EventPayload[], urgent: boolean): Promise<boolean> => (
    trackingClient.log(events.filter(e => !!e.eventType), undefined, urgent)
)

export const APIAccountsLastUsageInformation = async (accountIds: string[]): Promise<AccountsLastUsageInformation> =>
    await trackingClient.accountsLastUsageInformation(accountIds)