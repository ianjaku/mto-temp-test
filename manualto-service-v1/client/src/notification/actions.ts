import { APISubscribeToRoutingKeys } from "../api/notificationService";
import { RoutingKeyType } from "@binders/client/lib/clients/notificationservice/v1/contract";

export function setupNotifications(userId: string): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).bindersConfig.proxiedAPiPath) {
        // skip web socket connection for now if we are running in a proxied environment
        // reason: this proxy setup is only used by crate and their proxy server does not support web sockets
        return;
    }
    // listen to events for user
    APISubscribeToRoutingKeys([{
        type: RoutingKeyType.USER,
        value: userId,
    }]);
}