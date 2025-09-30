/* eslint-disable no-console */
import { BackendTrackingServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";

const config = BindersConfig.get();

const getTrackingServiceClient = () => BackendTrackingServiceClient.fromConfig(config, "aggregate-user-events");

(async () => {
    const trackingClient = await getTrackingServiceClient();
    const filter = {
        accountId: "aid-0fb03b72-d6ed-4204-abbd-f64b8879b4a6",
        userIds: ["uid-bc1cb531-f35d-4934-aa9c-5d9997e644bc"],
        userGroupIds: ["gid-6c96c906-7e3f-4dff-99d6-8dc56f6cda80", "gid-5348ca23-b5fe-4555-a435-356c880adc80"]
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const userActions = await trackingClient.findUserActions(filter);
    process.exit(0);
})();