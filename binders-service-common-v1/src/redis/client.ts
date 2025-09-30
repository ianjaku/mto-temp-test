import { Config, ConfigError } from "@binders/client/lib/config/config";
import { Logger, LoggerBuilder } from "../util/logging";
import Redis from "ioredis";

export type RedisClient = Redis;

export interface RedisServerConfig {
    useSentinel: boolean;
    host: string;
    port: number;
    sentinels?: { host: string, port: number }[]
}

export function getRedisClient(connectionDetails: RedisServerConfig, logger: Logger, notifyKeyspaceEvents?: string): RedisClient {
    let redis: RedisClient;
    logger.info(`host ${connectionDetails.host}, port ${connectionDetails.port}, useSentinel ${connectionDetails.useSentinel}`, "redis-client")
    if (connectionDetails.useSentinel) {
        redis = new Redis({
            sentinels: connectionDetails.sentinels,
            name: "mymaster",
            updateSentinels: true,
            sentinelReconnectStrategy: () => 10000
        });
    } else {
        redis = new Redis(connectionDetails);
    }
    if (notifyKeyspaceEvents) {
        redis.on("ready", () => { redis.config("SET", "notify-keyspace-events", notifyKeyspaceEvents) });
    }
    redis.on("error", (err) => {

        logger.error(`Redis connection error: ${err}`, "redis-client")

    })
    return redis;
}

export const REDIS_DATABASES = [
    "css",
    "documents",
    "pubsub",
    "sessions",
    "accountsPermissions",
    "rateLimiter",
    "requestBlockers",
    "accountsettings",
    "mostUsedLanguages",
    "test",
    "persistent-cache",
    "mtlanguages"
] as const;

export type RedisDatabase = typeof REDIS_DATABASES[number];

export interface RedisClientBuilderOptions {
    config: Config,
    databaseName: RedisDatabase
}

function getDBConfigKey(databaseName: RedisDatabase) {
    return `redis.${databaseName}`;
}

export class RedisClientBuilder {
    static fromConfig(config: Config, databaseName: RedisDatabase, notifyKeyspaceEvents?: string): RedisClient {
        const serverConfigOption = config.getObject<RedisServerConfig>(getDBConfigKey(databaseName));
        if (serverConfigOption.isNothing()) {
            throw new ConfigError(`Could not find required config setting: redis.${databaseName}`);
        }
        const serverConfig = serverConfigOption.get();
        if (!serverConfig.host || !serverConfig.port) {
            throw new ConfigError(`Could not find required config setting (host/port): redis.${databaseName}`);
        }
        const logger = LoggerBuilder.fromConfig(config, "RedisClient")
        return getRedisClient(serverConfig, logger, notifyKeyspaceEvents);
    }

    static build(options: RedisClientBuilderOptions): RedisClient {
        const {
            config,
            databaseName
        } = options;
        return RedisClientBuilder.fromConfig(config, databaseName);
    }

    static canBuild(config: Config, databaseName: RedisDatabase): boolean {
        return config.getObject(getDBConfigKey(databaseName)).isJust();
    }
}
