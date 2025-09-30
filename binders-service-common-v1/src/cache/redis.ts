import { BaseCache, ICacheOptions, IGetSet } from ".";
import { RedisClient, RedisClientBuilder, RedisClientBuilderOptions } from "../redis/client";
import { getCachingProxy, getFlushingProxy } from "./proxy";
import { Logger } from "../util/logging";

export interface IRedisGetSetOptions {
    redis: RedisClient,
    logger: Logger
}

function needsConnect (details: RedisClientDetails): details is RedisClientBuilderOptions {
    return !!(details as RedisClientBuilderOptions).databaseName;
}

export class RedisGetSet implements IGetSet {
    constructor(private options: IRedisGetSetOptions) {

    }

    async get(k: string): Promise<string | undefined> {
        const { logger, redis } = this.options;
        logger.trace(`Getting key ${k}`, "redis-get-set");
        const value = await redis.get(k);
        return (value === null) ? undefined : value;
    }

    async set(k: string, v: string): Promise<void> {
        const { logger, redis } = this.options;
        logger.trace(`Setting key ${k}`, "redis-get-set");
        await redis.set(k, v);
    }

    async ttl(k: string, ttl: number): Promise<void> {
        const { logger, redis } = this.options;
        logger.trace(`Expiring key ${k} - ${ttl}`, "redis-get-set");
        await redis.expire(k, ttl);
    }

    async flush(k: string): Promise<void> {
        const { logger, redis } = this.options;
        logger.trace(`Flushing key ${k}`, "redis-get-set");
        await redis.del(k);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    static build(redisClientDetails: RedisClientDetails, logger: Logger) {
        const redis: RedisClient = needsConnect(redisClientDetails) ?
            RedisClientBuilder.build(redisClientDetails):
            redisClientDetails;
        return new RedisGetSet({ redis, logger });
    }
}

export type RedisClientDetails = RedisClientBuilderOptions | RedisClient;

export class RedisCacheBuilder {
    static build(redisClientDetails: RedisClientDetails, cacheOptions: ICacheOptions, logger: Logger) {
        const getSet = RedisGetSet.build(redisClientDetails, logger);
        return new BaseCache({
            ...cacheOptions,
            getSet
        })
    }

    static getProxy<ToProxy>(
        redisClientDetails: RedisClientDetails, cacheOptions: ICacheOptions,
        toProxy: ToProxy, logger: Logger
    ): ToProxy {
        const cache = RedisCacheBuilder.build(redisClientDetails, cacheOptions, logger);
        return getCachingProxy(toProxy, cache)
    }

    static getFlushingProxy<ToProxy>(
        redisClientDetails: RedisClientDetails, cacheOptions: ICacheOptions,
        toProxy: ToProxy, logger: Logger
    ): ToProxy {
        const cache = RedisCacheBuilder.build(redisClientDetails, cacheOptions, logger);
        return getFlushingProxy(toProxy, cache)
    }


}