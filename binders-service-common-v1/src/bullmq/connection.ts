import type { BindersConfig } from "../bindersconfig/binders";
import { ConnectionOptions } from "bullmq"
import { RedisServerConfig } from "../redis/client";

export function buildConnection(cfg: BindersConfig): ConnectionOptions {
    const connectionDetails =
        cfg.getObject<RedisServerConfig>("redis.sessions").get();

    if (connectionDetails.useSentinel) {
        if (!connectionDetails.sentinels || connectionDetails.sentinels.length === 0) {
            throw new Error("Sentinel configuration missing sentinels array");
        }

        for (const sentinel of connectionDetails.sentinels) {
            if (!sentinel.host || !sentinel.port) {
                throw new Error("Sentinel configuration missing host or port for sentinel");
            }
        }

        return {
            sentinels: connectionDetails.sentinels,
            name: "mymaster"
        };
    }

    if (!connectionDetails.host || !connectionDetails.port) {
        throw new Error("Redis configuration missing required host or port");
    }

    return { 
        host: connectionDetails.host, 
        port: connectionDetails.port 
    };
}