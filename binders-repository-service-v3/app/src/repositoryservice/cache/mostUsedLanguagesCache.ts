import { RedisClient, RedisClientBuilder } from "@binders/binders-service-common/lib/redis/client";
import { Config } from "@binders/client/lib/config/config";

const EXPIRE_IN_24_HOURS = 24 * 60 * 60;

export interface IMostUsedLanguagesCache {
    setMostUsedLanguages(accountIdsCsv: string, mostUsedLanguages: string[]): Promise<void>;
    getMostUsedLanguages(accountIdsCsv: string): Promise<string[]>;
    invalidateForAccount(accountIdsCsv: string): Promise<void>;
}

export class MostUsedLanguagesCache implements IMostUsedLanguagesCache {

    static VERSION = 1;

    constructor(protected redis: RedisClient) {
    }

    private buildAccountKey(accountIdsCsv: string) {
        return `${accountIdsCsv}-most-used-languages-${MostUsedLanguagesCache.VERSION}`;
    }

    async setMostUsedLanguages(accountIdsCsv: string, mostUsedLanguages: string[]): Promise<void> {
        const accountKey = this.buildAccountKey(accountIdsCsv);
        await this.redis.set(accountKey, `${mostUsedLanguages.join(",")}`);
        await this.redis.expire(accountKey, EXPIRE_IN_24_HOURS);
    }

    async getMostUsedLanguages(accountIdsCsv: string): Promise<string[]> {
        const accountKey = this.buildAccountKey(accountIdsCsv);
        const value = await this.redis.get(accountKey);
        return value ? value.split(",") : undefined;
    }

    async invalidateForAccount(accountIdsCsv: string): Promise<void> {
        const setKey = this.buildAccountKey(accountIdsCsv);
        await this.redis.del(setKey);
    }

    static fromConfig(config: Config): MostUsedLanguagesCache {
        const client = RedisClientBuilder.fromConfig(config, "mostUsedLanguages");
        return new MostUsedLanguagesCache(client);
    }
}
