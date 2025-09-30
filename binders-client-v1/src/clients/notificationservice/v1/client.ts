import {
    Alert,
    CreateAlertParams,
    CreateNotificationTargetParams,
    CustomNotification,
    Notification,
    NotificationEvent,
    NotificationKind,
    NotificationServiceContract,
    NotificationTarget,
    NotificationTemplate,
    RelativeDate,
    RoutingKey,
    ScheduledEvent,
    SendNotificationOptions,
    SentNotification,
    ServiceNotification,
    ServiceNotificationType,
    SimpleTarget,
    WebSocketMessage,
    WebSocketMessageType
} from  "./contract";
import { BindersServiceClient, RequestHandler } from "../../client";
import { BindersServiceClientConfig } from "../../config";
import { Config } from "../../../config/config";
import { getAppRoutes } from "./routes";
import { isDev } from "../../../util/environment";

export class NotificationServiceClient extends BindersServiceClient implements NotificationServiceContract {
    private routingKeys = new Set<RoutingKey>();
    private webSocket: WebSocket;
    private readonly handleServiceNotification: (serviceNotification: ServiceNotification) => void;
    private messageQueue: string[] = [];

    constructor(
        endpointPrefix: string,
        requestHandler: RequestHandler,
        handleServiceNotification: (serviceNotification: ServiceNotification) => void,
        accountIdProvider?: () => string,
    ) {
        super(endpointPrefix, getAppRoutes(), requestHandler, accountIdProvider);
        if (typeof window !== "undefined") {
            if (window["bindersConfig"]["proxiedAPiPath"]) {
                // skip web socket connection for now if we are running in a proxied environment
                // reason: this proxy setup is only used by crate and their proxy server does not support web sockets
                return;
            }
        }
        if (handleServiceNotification != null) {
            this.handleServiceNotification = handleServiceNotification;
            this.wsConnect();
        }
    }

    public static fromConfig(
        config: Config,
        version: string,
        requestHandler: RequestHandler,
        onServiceNotification: (serviceNotification: ServiceNotification) => void,
        accountIdProvider?: () => string,
    ): NotificationServiceClient {
        const versionedPath = BindersServiceClientConfig.getVersionedPath(config, "notification", version);
        return new NotificationServiceClient(versionedPath, requestHandler, onServiceNotification, accountIdProvider);
    }

    public sendNotification(
        notification: Notification,
        options?: SendNotificationOptions
    ): Promise<void> {
        return this.handleRequest("sendNotification", {
            body: {
                notification,
                options
            }
        });
    }

    public sendPublishRequestNotification(
        accountId: string,
        binderId: string
    ): Promise<void> {
        return this.handleRequest("sendPublishRequestNotification", {
            body: {
                accountId,
                binderId
            }
        });
    }

    findNotificationTargets(
        accountId: string,
        notificationKind?: NotificationKind,
        itemIds?: string[]
    ): Promise<NotificationTarget[]> {
        return this.handleRequest("findNotificationTargets", {
            body: {
                accountId,
                notificationKind,
                itemIds
            }
        });
    }

    findScheduledNotifications(
        accountId: string,
        itemId: string,
        kind?: NotificationKind
    ): Promise<ScheduledEvent[]> {
        return this.handleRequest("findScheduledNotifications", {
            body: {
                accountId,
                itemId,
                kind
            }
        });
    }

    findSentNotifications(
        accountId: string,
        itemId: string
    ): Promise<SentNotification[]> {
        return this.handleRequest("findSentNotifications", {
            body: {
                accountId,
                itemId
            }
        })
    }

    addNotificationTarget(
        params: CreateNotificationTargetParams
    ): Promise<NotificationTarget> {
        return this.handleRequest("addNotificationTarget", {
            body: params
        });
    }

    deleteNotificationTarget(
        accountId: string,
        targetId: string,
        notificationKind: NotificationKind,
        itemId?: string
    ): Promise<void> {
        return this.handleRequest("deleteNotificationTarget", {
            body: {
                accountId,
                targetId,
                notificationKind,
                itemId
            }
        });
    }

    addNotificationTemplate(
        accountId: string,
        templateData: Partial<CustomNotification>,
        templateName: string,
        scheduledDate?: Date | RelativeDate,
        scheduledTime?: Date
    ): Promise<NotificationTemplate> {
        return this.handleRequest("addNotificationTemplate", {
            body: {
                accountId,
                templateData,
                templateName,
                scheduledDate,
                scheduledTime
            }
        });
    }

    deleteNotificationTemplate(
        accountId: string,
        notificationTemplateId: string
    ): Promise<void> {
        return this.handleRequest("deleteNotificationTemplate", {
            body: {
                accountId,
                notificationTemplateId
            }
        })
    }

    deleteNotificationTargets(
        targetId: string,
        accountId?: string
    ): Promise<void> {
        return this.handleRequest("deleteNotificationTargets", {
            body: {
                targetId,
                accountId
            }
        });
    }

    getNotificationTemplatesForAccount(
        accountId: string,
    ): Promise<NotificationTemplate[]> {
        return this.handleRequest("getNotificationTemplatesForAccount", {
            pathParams: {
                accountId,
            }
        });
    }

    public closeWs(): void {
        this.webSocket.close();
    }

    public subscribe(routingKeys: RoutingKey[]): void {
        if (routingKeys.length === 0) {
            return;
        }
        const messageObject = {
            type: WebSocketMessageType.SUBSCRIBE,
            body: routingKeys
        } as WebSocketMessage;
        this.wsMessage(JSON.stringify(messageObject));
    }

    public unsubscribe(routingKeys: RoutingKey[]): void {
        if (routingKeys.length === 0) {
            return;
        }
        const messageObject = {
            type: WebSocketMessageType.UNSUBSCRIBE,
            body: routingKeys
        } as WebSocketMessage;
        this.wsMessage(JSON.stringify(messageObject));
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public dispatch(routingKey: RoutingKey, eventType: ServiceNotificationType, eventBody): void {
        const event: NotificationEvent = {
            routingKey,
            body: {
                type: eventType,
                body: eventBody,
            },
        };
        const messageObject = {
            type: WebSocketMessageType.DISPATCH,
            body: event,
        } as WebSocketMessage;
        this.wsMessage(JSON.stringify(messageObject));
    }

    public async deleteAllForAccount(accountId: string): Promise<void> {
        return this.handleRequest("deleteAllForAccount", {
            pathParams: {
                accountId
            }
        });
    }

    public async runScheduledEvents(): Promise<void> {
        return this.handleRequest("runScheduledEvents", {});
    }

    private async wsConnect() {
        const webSocket = await this.handleWsConnect();
        webSocket.addEventListener("message", this.onServiceNotification.bind(this));
        webSocket.addEventListener("close", this.onWsClose.bind(this));
        webSocket.addEventListener("error", this.onWsError.bind(this));
        this.webSocket = webSocket;
    }

    private onServiceNotification(event: MessageEvent) {
        let serviceNotification = JSON.parse(event.data);
        if (serviceNotification.type === ServiceNotificationType.CONNECTION_SUCCESS) {
            this.subscribe(Array.from(this.routingKeys));
            this.checkMessageQueue();
            return;
        }
        if (typeof serviceNotification === "string") {
            serviceNotification = JSON.parse(serviceNotification);
        }
        if (serviceNotification.type === ServiceNotificationType.ROUTING_KEYS_UPDATED) {
            this.routingKeys = serviceNotification.body;
        } else {
            this.handleServiceNotification(serviceNotification);
        }
    }

    private onWsClose() {
        const wsConnect = this.wsConnect.bind(this);
        setTimeout(() => {
            // eslint-disable-next-line no-console
            console.log("Reconnecting websocket...");
            wsConnect();
        }, 5000);
    }

    private onWsError(error: ErrorEvent) {
        const errorMsg = isDev() && error.message.startsWith("connect ECONNREFUSED") ? error.message : error;
        // eslint-disable-next-line no-console
        console.error("Websocket error", errorMsg);
    }

    private wsMessage(message: string) {
        this.messageQueue.push(message);
        this.checkMessageQueue();
    }

    private checkMessageQueue() {
        const message = this.messageQueue.length > 0 && this.messageQueue[0];
        if (message) {
            try {
                if (this.webSocket.readyState !== 1) {
                    throw new Error("Cannot send over websocket, readyState is not 1");
                }
                this.webSocket.send(message);
                this.messageQueue.shift();
                this.checkMessageQueue();
            }
            catch (err) {
                // eslint-disable-next-line no-console
                console.error(err);
            }
        }
    }

    async sendCustomNotification(
        accountId: string,
        itemId: string,
        targets: SimpleTarget[],
        subject: string,
        text: string,
        sendAt?: Date
    ): Promise<CustomNotification> {
        return this.handleRequest("sendCustomNotification", {
            body: {
                accountId,
                itemId,
                targets,
                subject,
                text,
                sendAt
            }
        })
    }

    async updateScheduledNotification(
        scheduledEventId: string,
        notification: Notification,
        sendAt: Date
    ): Promise<void> {
        return this.handleRequest("updateScheduledNotification", {
            body: {
                scheduledEventId,
                notification,
                sendAt,
                itemId: notification?.itemId,
                accountId: notification?.accountId
            }
        })
    }

    createAlert(params: CreateAlertParams): Promise<Alert> {
        return this.handleRequest("createAlert", {
            body: {
                params
            }
        });
    }

    updateAlert(alert: Alert): Promise<Alert> {
        return this.handleRequest("updateAlert", {
            body: {
                alert
            }
        });
    }

    deleteAlert(alertId: string): Promise<void> {
        return this.handleRequest("deleteAlert", {
            pathParams: {
                alertId
            }
        });
    }

    getAlert(id: string): Promise<Alert> {
        return this.handleRequest("getAlert", {
            pathParams: {
                id
            }
        })
    }

    findActiveAlerts(accountId: string): Promise<Alert[]> {
        return this.handleRequest("findActiveAlerts", {
            pathParams: {
                accountId
            }
        });
    }

    findAllAlerts(): Promise<Alert[]> {
        return this.handleRequest("findAllAlerts", {});
    }
}
