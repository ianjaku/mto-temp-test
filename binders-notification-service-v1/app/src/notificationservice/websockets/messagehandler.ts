import * as WebSocket from "ws";
import {
    EXPIRED_PATTERN,
    REDIS_CHANNEL_PREFIX,
    redisChannelToRoutingKey,
    routingKeyToRedisChannel
} from "../helpers";
import {
    IDispatchHookResult,
    NotificationEvent,
    RoutingKey,
    RoutingKeyType,
    ServiceNotification,
    ServiceNotificationType,
    WebSocketMessage,
    WebSocketMessageType
} from "@binders/client/lib/clients/notificationservice/v1/contract";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { RedisClient } from "@binders/binders-service-common/lib/redis/client";

/**
 * Manages the web sockets' subscription to channels
 */
class ClientSubscriptionsManager {
    private logger?: Logger;
    private clientSubscriptions: Record<string, Set<string>>;

    constructor() {
        this.clientSubscriptions = {};
    }

    setLogger(logger: Logger) {
        this.logger = logger;
    }

    getSubscriptionForChannel(channel: string): string[] {
        const subscriptions = this.clientSubscriptions[channel];
        return subscriptions ? Array.from(subscriptions) : [];
    }

    addSubscriptionsToChannels(webSocketId: string, channels: string[]): void {
        this.clientSubscriptions = channels.reduce((reduced, channel) => {
            if (reduced[channel]) {
                reduced[channel].add(webSocketId);
                return reduced;
            }
            return {
                ...reduced,
                [channel]: new Set([webSocketId]),
            };
        }, this.clientSubscriptions);
    }

    removeSubscriptionFromChannels(webSocketId: string, channels: string[]): void {
        this.clientSubscriptions = channels.reduce((reduced, channel) => {
            if (reduced[channel]) {
                const webSocketIds = reduced[channel];
                webSocketIds.delete(webSocketId);
                reduced[channel] = webSocketIds;
                return reduced;
            }
            this.logger?.error(`Unsubscribing from routing key ${channel}, but it doesn't exist`, "unsubscribe");
            return {
                ...reduced
            };
        }, this.clientSubscriptions);
    }

    getSubscribedChannels(webSocketId: string): string[] {
        return Object.keys(this.clientSubscriptions)
            .filter(channel => this.clientSubscriptions[channel].has(webSocketId));
    }

    removeAllSubscriptions(webSocketId: string): void {
        this.clientSubscriptions = Object.keys(this.clientSubscriptions).reduce((reduced, channel) => {
            const updatedWebSocketIds = this.clientSubscriptions[channel];
            updatedWebSocketIds.delete(webSocketId);
            return { ...reduced, [channel]: updatedWebSocketIds };
        }, {} as Record<string, Set<string>>);
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DispatchHook = (routingKey: RoutingKey, body: any, logger: Logger) => Promise<IDispatchHookResult>;
export type StateProvider = (routingKey: RoutingKey) => Promise<ServiceNotification>;

type WebSocketConnection = {
    webSocket: WebSocket,
    userId?: string,
    currentPermissions?: {
        accountId: string,
        isAdmin: boolean
    }
};

/**
 * Handles web socket connections and passes messages between them and Redis channels
 */
export default class MessageHandler {

    private logger?: Logger;
    private webSockets: Map<string, WebSocketConnection>;
    private clientSubscriptionManager: ClientSubscriptionsManager;

    constructor(
        private redisPublisher: RedisClient,
        private redisSubscriber: RedisClient,
        private dispatchHooks: Map<ServiceNotificationType, DispatchHook>,
        private initialStateProviders: Map<RoutingKeyType, Array<StateProvider>>,
        private isUserAnAdminInAccount: (userId: string, accountId: string) => Promise<boolean>,
        private verbose = false
    ) {
        this.webSockets = new Map();
        this.clientSubscriptionManager = new ClientSubscriptionsManager();
        this.subScribeToRedis();
    }

    private subScribeToRedis() {

        this.redisSubscriber.on("ready", () => {
            this.redisSubscriber.subscribe(EXPIRED_PATTERN);
        });
        this.redisSubscriber.on("message", (channel: string, message: string) => {
            if (this.verbose) {
                this.logger?.trace(`message on channel ${channel}: ${message}`, "redis-pubsub");
            }
            if (channel === EXPIRED_PATTERN) {
                const [, accountId] = message.split(":");
                this.dispatch({
                    routingKey: {
                        type: RoutingKeyType.ACCOUNT,
                        value: accountId,
                    },
                    body: {
                        type: ServiceNotificationType.KEY_EXPIRED,
                        body: {
                            key: message,
                        }
                    }
                });
            }
        });

        this.redisSubscriber.on("pmessage", (pattern: string, channel: string, message: string) => {
            if (this.verbose) {
                this.logger?.trace(`pmessage on channel ${channel}: ${message} - pattern ${pattern}, dispatching...`, "redis-pubsub");
            }
            const webSocketIds = this.clientSubscriptionManager.getSubscriptionForChannel(channel);
            this.sendOverWebSockets(webSocketIds, JSON.parse(message));
        });
        this.redisSubscriber.psubscribe(`${REDIS_CHANNEL_PREFIX}*`);
    }

    setLogger(logger: Logger): void {
        this.logger = logger;
        this.clientSubscriptionManager.setLogger(logger);
    }

    handleWebSocketConnection(webSocket: WebSocket, userId?: string): void {
        const webSocketId = this.addWebSocket(webSocket, userId);
        webSocket.on("message", (msg: string) => this.handleWebSocketMessage(webSocketId, msg));
        webSocket.on("error", (error) => this.logger?.error(`Encountered ws error: ${error.message}`, "websocket-error"));
        webSocket.on("close", () => this.deleteWebSocket(webSocketId));
        webSocket.send(JSON.stringify({
            type: ServiceNotificationType.CONNECTION_SUCCESS
        }));
    }

    /**
     * Handles messages received over web socket
     */
    private async handleWebSocketMessage(webSocketId: string, msg: string): Promise<void> {
        const webSocketMessage = JSON.parse(msg) as WebSocketMessage;
        const { type, body } = webSocketMessage;
        switch (type) {
            case WebSocketMessageType.SUBSCRIBE:
                return this.subscribe(webSocketId, body);
            case WebSocketMessageType.UNSUBSCRIBE:
                return this.unsubscribe(webSocketId, body);
            case WebSocketMessageType.DISPATCH:
                return this.dispatch(body);
        }
    }

    private addWebSocket(webSocket: WebSocket, userId?: string): string {
        const webSocketId = this.generateWebSocketId();
        this.webSockets.set(webSocketId, { webSocket, userId });
        return webSocketId;
    }

    private async subscribe(webSocketId: string, rawRoutingKeys: (string|RoutingKey)[]): Promise<void> {
        const routingKeys = this.prepareRoutingKeys(rawRoutingKeys);
        const channels = routingKeys.map(routingKeyToRedisChannel);
        this.clientSubscriptionManager.addSubscriptionsToChannels(webSocketId, channels);
        this.acknowledgeRoutingKeysUpdate(webSocketId);
        await this.determinePermissionsForSubscription(webSocketId, routingKeys);
        this.runInitialStateProviders(webSocketId, routingKeys);
    }

    private prepareRoutingKeys(rawRoutingKeys: (string|RoutingKey)[]): RoutingKey[] {
        const routingKeys = rawRoutingKeys.map(routingKey => {
            if (typeof routingKey === "string") {
                return {
                    type: RoutingKeyType.ACCOUNT,
                    value: routingKey
                };
            }
            return routingKey;
        });
        routingKeys.push({ type: RoutingKeyType.ALL, value: null });
        return routingKeys;
    }

    private async determinePermissionsForSubscription(webSocketId: string, routingKeys: RoutingKey[]): Promise<void> {
        const webSocketConnection = this.webSockets.get(webSocketId);
        if (webSocketConnection.userId) {
            for (const routingKey of routingKeys) {
                if (routingKey.type === RoutingKeyType.ACCOUNT) {
                    const accountId = routingKey.value;
                    const isAdmin = await this.isUserAnAdminInAccount(webSocketConnection.userId, accountId);
                    webSocketConnection.currentPermissions = { isAdmin, accountId };
                    return;
                }
            }
        }
    }

    private runInitialStateProviders(webSocketId: string, routingKeys: RoutingKey[]): void {
        for (const routingKey of routingKeys) {
            const providers = this.initialStateProviders.get(routingKey.type) ?? [];
            for (const provider of providers) {
                provider(routingKey).then(initialServiceNotification => {
                    if (initialServiceNotification) {
                        this.sendOverWebSockets([webSocketId], initialServiceNotification);
                    }
                });
            }
        }
    }

    private unsubscribe(webSocketId: string, routingKeys: RoutingKey[]): void {
        const channels = routingKeys.map(routingKeyToRedisChannel);
        this.clientSubscriptionManager.removeSubscriptionFromChannels(webSocketId, channels);
        this.webSockets.get(webSocketId).currentPermissions = undefined;
        this.acknowledgeRoutingKeysUpdate(webSocketId);
    }

    private acknowledgeRoutingKeysUpdate(webSocketId: string): void {
        const routingKeys = this.clientSubscriptionManager.getSubscribedChannels(webSocketId)
            .map(redisChannelToRoutingKey);

        this.sendOverWebSockets([webSocketId], {
            type: ServiceNotificationType.ROUTING_KEYS_UPDATED,
            body: routingKeys,
        } as ServiceNotification);
    }

    /**
     * Publishes a notification to Redis
     */
    async dispatch(notificationEvent: NotificationEvent): Promise<void> {
        const { routingKey } = notificationEvent;
        const serviceNotification: ServiceNotification = notificationEvent.body;
        const { type: serviceNotificationType, body: serviceNotificationBody } = serviceNotification;
        if (this.dispatchHooks.has(serviceNotificationType)) {
            const hook = this.dispatchHooks.get(serviceNotificationType);
            const hookResult = await hook(routingKey, serviceNotificationBody, this.logger);
            const { interruptDispatch, overriddenServiceNotification } = hookResult;
            const serviceNotificationToSend = overriddenServiceNotification || serviceNotification;
            if (!interruptDispatch) {
                this.sendToRedis(routingKey, serviceNotificationToSend);
            } else {
                if (this.verbose) {
                    this.logger?.trace(`Dispatch hook returned interruptDispatch=true, not publishing ${JSON.stringify(serviceNotificationToSend)}`, "redis-pubsub");
                }
            }
        } else {
            this.sendToRedis(routingKey, serviceNotification);
        }
    }

    private sendToRedis(routingKey: RoutingKey, serviceNotification: ServiceNotification) {
        if (this.logger) {
            const message = `Publishing on channel ${routingKey.value}: ${JSON.stringify(serviceNotification)}`;
            this.logger.trace(message, "redis-pubsub");
        }
        const redisChannel = routingKeyToRedisChannel(routingKey);
        this.redisPublisher.publish(redisChannel, JSON.stringify(serviceNotification));
    }

    private sendOverWebSockets(webSocketIds: string[], notification: ServiceNotification): void {
        const message = JSON.stringify(notification);
        const { adminsOnly = false } = notification;
        webSocketIds
            .forEach(webSocketId => this.sendOverWebSocket(webSocketId, message, adminsOnly));
    }

    private sendOverWebSocket(webSocketId: string, message: string, adminsOnly: boolean): void {
        const maybeWebSocket = this.webSockets.get(webSocketId);
        if (!maybeWebSocket) {
            return;
        }
        const { webSocket, currentPermissions: { isAdmin = false } = {} } = maybeWebSocket;
        if (adminsOnly && !isAdmin) {
            return;
        }
        try {
            webSocket.send(JSON.stringify(message));
        } catch (err) {
            if (webSocket.readyState !== WebSocket.OPEN) {
                this.deleteWebSocket(webSocketId);
            } else {
                this.logger?.error(err, "websocket-send");
            }
        }
    }

    private deleteWebSocket(webSocketId: string): void {
        this.webSockets.delete(webSocketId);
        this.clientSubscriptionManager.removeAllSubscriptions(webSocketId);
    }

    private generateWebSocketId(): string {
        return ("" + Math.random()).substring(2);
    }
}
