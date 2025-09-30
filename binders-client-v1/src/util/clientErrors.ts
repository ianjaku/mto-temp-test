import { Application } from "../clients/trackingservice/v1/contract";
import { TrackingServiceClient } from "../clients/trackingservice/v1/client";
import browserRequestHandler from "../clients/browserClient";
import { config } from "../config";

export const logClientError = async (
    application: Application,
    toLog: Error | ErrorEvent | string,
    errorMessagePrefix = "",
): Promise<void> => {
    const context = {
        application,
        url: window.location.href,
    }
    if (toLog instanceof Error && errorMessagePrefix) {
        try {
            toLog.message = `${errorMessagePrefix} ${toLog.message}`;
        } catch (e) {
            if (!(e.message.includes("only a getter"))) {
                throw e;
            }
        }
    }

    const trackingClient = TrackingServiceClient.fromConfig(config, "v1", browserRequestHandler);
    await trackingClient.logClientError(toLog, context);
}
