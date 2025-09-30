import { RedisClient, RedisClientBuilder } from "../../redis/client";
import { Config } from "@binders/client/lib/config/config";
import { splitEvery } from "ramda";

export const createPermanentCacheRedis = (
    config: Config
): RedisClient => {
    return RedisClientBuilder.fromConfig(config, "persistent-cache");
}

export const redisMismemberWithValues = async (
    redisClient: RedisClient,
    key: string,
    items: string[]
): Promise<{
    found: string[],
    notFound: string[]
}> => {
    const itemChunks = splitEvery(10, items);
    const queryResultParts = [];
    for (let i = 0; i < itemChunks.length; i++) {
        const result = await Promise.all(
            itemChunks[i].map(m => redisClient.sismember(key, m))
        );
        queryResultParts.push(result);
    }
    const queryResult = queryResultParts.flat();
    const found: string[] = [];
    const notFound: string[] = [];
    for (const index in queryResult) {
        const id = items[index];
        if (queryResult[index] === 1) {
            found.push(id);
        } else {
            notFound.push(id)
        }
    }
    return {
        found,
        notFound
    }
}
