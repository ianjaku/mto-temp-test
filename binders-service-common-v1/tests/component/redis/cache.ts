import { ICacheOptions, buildCacheKey } from "../../../src/cache";
import { BindersConfig } from "../../../src/bindersconfig/binders";
import { DimConsoleLogger } from "../../../src/util/logging/dim";
import { RedisCacheBuilder } from "../../../src/cache/redis";
import { RedisClientBuilder } from "../../../src/redis/client";
import { v4 } from "uuid";

const config = BindersConfig.get();
const logger = DimConsoleLogger.fromConfig(config, "cache-test");

const redisClient = RedisClientBuilder.fromConfig(config, "test");

class A {
    async a(toParse: string, radix: number) {
        return Number.parseInt(toParse, radix);
    }
}

async function countKeys (prefix: string): Promise<number> {
    const keys = await redisClient.keys(`${prefix}*`);
    return keys.length;
}

it("should cache the results in redis", async () => {
    const options: ICacheOptions = {
        keyPrefix: `cache-test-${v4()}`,
        cacheVersion: 1,
        ttl: 0
    }
    const redisKeyPrefix = buildCacheKey(options.keyPrefix, options.cacheVersion, "");
    const cachedA = RedisCacheBuilder.getProxy(redisClient, options, new A(), logger);
    expect(await countKeys(redisKeyPrefix)).toEqual(0);
    await cachedA.a("123", 10);
    expect(await countKeys(redisKeyPrefix)).toEqual(1);
    await cachedA.a("123", 10);
    return expect(await countKeys(redisKeyPrefix)).toEqual(1);
})

afterAll( () => redisClient.quit());