/* eslint-disable no-console */
import { BackendNotificationServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";


async function run() {
    const config = BindersConfig.get();
    const notificationService = await BackendNotificationServiceClient.fromConfig(config, "runScheduledEvents.ts", null);
    await notificationService.runScheduledEvents();
}

run()
    .then(() => console.log("I have completed your bidding, Master."))
    .catch((e) => {
        console.log("I failed :'(");
        console.error(e);
    });
