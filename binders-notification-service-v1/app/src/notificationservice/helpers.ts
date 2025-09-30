import {
    RoutingKey,
} from "@binders/client/lib/clients/notificationservice/v1/contract";

export const REDIS_CHANNEL_PREFIX = "items-";
export const EXPIRED_PATTERN = "__keyevent@0__:expired";

export function routingKeyToRedisChannel(routingKey: RoutingKey): string {
    return `${REDIS_CHANNEL_PREFIX}${JSON.stringify(routingKey)}`;
}

export function redisChannelToRoutingKey(channel: string): RoutingKey {
    const withoutPrefix = channel.substr(REDIS_CHANNEL_PREFIX.length);
    return JSON.parse(withoutPrefix);
}
