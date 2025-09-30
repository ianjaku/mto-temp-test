import { Alert, CreateAlertParams } from "@binders/client/lib/clients/notificationservice/v1/contract";
import {
    NotificationServiceClient
} from  "@binders/client/lib/clients/notificationservice/v1/client";
import config from "../config";
import { getBackendRequestHandler } from "./handler";

const client = NotificationServiceClient.fromConfig(
    config,
    "v1",
    getBackendRequestHandler(),
    null
);

export function APICreateAlert(params: CreateAlertParams): Promise<Alert> {
    return client.createAlert(params);
}

export function APIUpdateAlert(alert: Alert): Promise<Alert> {
    return client.updateAlert(alert);
}

export function APIFindAllAlerts(): Promise<Alert[]> {
    return client.findAllAlerts();
}

export function APIGetAlert(id: string): Promise<Alert> {
    return client.getAlert(id);
}

export function APIDeleteAlert(id: string): Promise<void> {
    return client.deleteAlert(id);
}
