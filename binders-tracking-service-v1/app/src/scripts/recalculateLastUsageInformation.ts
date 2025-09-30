/* eslint-disable no-console */
import {
    BackendTrackingServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { performance } from "perf_hooks";

const config = BindersConfig.get();

const getTrackingServiceClient = () => BackendTrackingServiceClient.fromConfig(config, "aggregate-user-events");

const extractLastUsageInformation = async () => {
    const trackingClient = await getTrackingServiceClient();
    console.log("Running accounts last usage recalculation");
    const start = performance.now();
    await trackingClient.recalculateAccountsLastUsageInformation();
    console.log(`Took ${(performance.now() - start) / 1000} second to run.`);
}

extractLastUsageInformation()
    .then(
        () => {
            console.log("All done!");
            process.exit(0);
        },
        err => {
            console.error(err);
            process.exit(1);
        }
    );