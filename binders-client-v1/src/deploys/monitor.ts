import { BindersServiceClient } from "../clients/client";
import browserRequestHandler from "../clients/browserClient";
import { getQueryStringVariable } from "../util/uri";
import { isDev } from "../util/environment";

const MONITOR_INTERVAL_MS = 30_000 ;
export const MOCK_FORCE_UPDATE_QUERY_VARIABLE = "mockForceUpdate";

const client = new BindersServiceClient(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((window as any)?.bindersConfig.pathPrefix) ?? "",
    {},
    browserRequestHandler
);

const getBuildInfo = () => client.statusBuildInfo();

export type PollInterval = number;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let previousBuildInfo = (window as any).buildInfo;
let frontendNeedsNotification = (getQueryStringVariable(MOCK_FORCE_UPDATE_QUERY_VARIABLE) != null) || false;

const startMonitor = async () => {
    if (!isDev()) {
        setInterval(
            async () => {
                try {
                    const newBuildInfo = await getBuildInfo();
                    if (!previousBuildInfo) {
                        previousBuildInfo = newBuildInfo;
                        return;
                    }
                    if (!newBuildInfo) {
                        return;
                    }
                    if (newBuildInfo.commit !== previousBuildInfo.commit) {
                        frontendNeedsNotification = true;
                    }
                    if (!frontendNeedsNotification) {
                        previousBuildInfo = newBuildInfo;
                    }
                } catch (err) {
                    //
                }
            },
            MONITOR_INTERVAL_MS
        )
    }
}

startMonitor();

export const monitorBuildInfo = (outdatedEvent: () => void): PollInterval => {

    return setInterval(
        async () => {
            if (frontendNeedsNotification) {
                outdatedEvent();
            }
        },
        1000
    ) as unknown as PollInterval;
}

export const stopMonitor = (intervalId: PollInterval): void => clearInterval(intervalId);