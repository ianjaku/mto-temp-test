import { RoutingKey, ServiceNotification, ServiceNotificationType } from "@binders/client/lib/clients/notificationservice/v1/contract";
import { AccountStoreGetters } from "../stores/zustand/account-store";
import { NotificationServiceClient } from "@binders/client/lib/clients/notificationservice/v1/client";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config";
import { getUserStoreActions } from "../stores/zustand/user-store";

const client = NotificationServiceClient.fromConfig(
    config,
    "v1",
    browserRequestHandler,
    handleServiceNotification,
    AccountStoreGetters.getActiveAccountId,
);

export function APISubscribeToRoutingKeys(routingKeys: RoutingKey[]): void {
    return client.subscribe(routingKeys);
}

export function closeWs(): void {
    client.closeWs();
}

function handleServiceNotification(serviceNotification: ServiceNotification) {
    const { body: serviceNotificationBody } = serviceNotification;
    switch (serviceNotification.type) {
        case ServiceNotificationType.USER_LOGGED_OFF: {
            getUserStoreActions().logout(serviceNotificationBody)
            break;
        }
        default:
            // eslint-disable-next-line no-console
            console.error("Service notification of unknown type received", serviceNotification);
    }
}
