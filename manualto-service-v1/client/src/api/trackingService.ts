import {
    Application,
    ClientErrorContext,
    Event,
    IUserAction
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { AccountStoreGetters } from "../stores/zustand/account-store";
import { TrackingServiceClient } from "@binders/client/lib/clients/trackingservice/v1/client";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config";

export const trackingClient = TrackingServiceClient.fromConfig(
    config,
    "v1",
    browserRequestHandler,
    AccountStoreGetters.getActiveAccountId,
);

export const apiLogEvents = (events: Event[], beacon = false, userId: string): Promise<boolean> => trackingClient.log(events, userId, beacon);

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types,@typescript-eslint/no-explicit-any
export const logError = async (error: any): Promise<void> => {
    try {
        const context: ClientErrorContext = {
            application: Application.READER,
            url: window.location.href
        }
        await trackingClient.logClientError(error, context)
    } catch (err) {
        /* eslint-disable */
        console.log(error);
        console.log(err);
    }
}

export const APIMultiInsertUserAction = async<D>(
    userActions: IUserAction<D>[],
    accountId: string
): Promise<void> => {
    return trackingClient.multiInsertUserAction(userActions, accountId);
}
