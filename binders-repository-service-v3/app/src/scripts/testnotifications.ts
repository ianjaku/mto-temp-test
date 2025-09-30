/* eslint-disable no-console */
import { NotificationKind, NotifierKind } from "@binders/client/lib/clients/notificationservice/v1/contract";
import { BackendNotificationServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";


const config = BindersConfig.get();

const doIt = async () => {
    const client = await BackendNotificationServiceClient.fromConfig(config, "test-notifications", () => undefined);
    const target = {
        accountId: "aid-cc46dd54-7382-4131-9757-c99bda1193dc",
        itemId: "AWKRemVdgRcJXleWPqKV",
        notifierKind: NotifierKind.USER_EMAIL,
        notificationKind: NotificationKind.PUBLISH,
        targetId: "uid-1a6f6e15-b574-44ee-9d2d-9bf1350ceed0"
    }
    await client.addNotificationTarget(target)
}

doIt().then(
    () => {
        console.log("All done!");
        process.exit(0);
    },
    (err) => {
        console.error(err);
        process.exit(1);
    }
)