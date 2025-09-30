import { RedisClient, RedisClientBuilder } from "@binders/binders-service-common/lib/redis/client";
import { Config } from "@binders/client/lib/config/config";

const EXPIRE_IN_24_HOURS = 24 * 60 * 60;

export interface IPublicItemCache {
    setPublicItemCount(accountId: string, count: number): Promise<void>;
    getPublicItemCount(accountId: string): Promise<number>;
    invalidateForAccount(accountId: string): Promise<void>;
}

export class PublicItemsCache implements IPublicItemCache {

    static VERSION = 1;

    constructor(protected redis: RedisClient) {
    }

    private buildAccountKey(accountId: string) {
        return `${accountId}-public-items-${PublicItemsCache.VERSION}`;
    }

    async setPublicItemCount(accountId: string, count: number): Promise<void> {
        const accountKey = this.buildAccountKey(accountId);
        await this.redis.set(accountKey, `${count}`);
        await this.redis.expire(accountKey, EXPIRE_IN_24_HOURS);
    }

    async getPublicItemCount(accountId: string): Promise<number> {
        const accountKey = this.buildAccountKey(accountId);
        const value = await this.redis.get(accountKey);
        return value ? parseInt(value) : undefined;
    }

    async invalidateForAccount(accountId: string): Promise<void> {
        const setKey = this.buildAccountKey(accountId);
        await this.redis.del(setKey);
    }

    static fromConfig(config: Config): PublicItemsCache {
        const client = RedisClientBuilder.fromConfig(config, "accountsPermissions");
        return new PublicItemsCache(client);
    }
}
