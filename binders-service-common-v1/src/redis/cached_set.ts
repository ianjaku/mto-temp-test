import { Logger } from "../util/logging";
import { RedisClient } from "./client";

interface ICachedRedisSetOptions {
    key: string;
    refreshInterval: number;
    debug?: boolean;
    logger?: Logger;
}

export class CachedRedisSet {

    private cached: Set<string>;
    private lastLoad: number;
    public reloadCount: number;

    constructor(private client: RedisClient, private options: ICachedRedisSetOptions) {
        this.cached = undefined;
        this.lastLoad = undefined;
        this.reloadCount = 0;
    }

    async getSet(): Promise<Set<string>> {
        if (this.cached === undefined || this.cacheExpired() ) {
            return this.loadSet();
        }
        return this.cached;
    }

    async addItemToSet(value: string): Promise<Set<string>> {
        await this.client.sadd(this.options.key, value);
        return this.loadSet();
    }

    async removeValueFromSet(value: string): Promise<Set<string>> {
        await this.client.srem(this.options.key, value);
        return this.loadSet();

    }

    private cacheExpired(): boolean {
        if (this.lastLoad === undefined) {
            return true;
        }
        const now = new Date().getTime();
        return now > (this.lastLoad + this.options.refreshInterval);
    }

    private async loadSet(): Promise<Set<string>> {
        if (this.options.debug && this.options.logger) {
            this.options.logger.info("Reloading set from redis", "redis-cache-set");
        }
        const membersArray = await this.client.smembers(this.options.key);
        this.cached = new Set(membersArray);
        this.lastLoad = new Date().getTime();
        this.reloadCount++;
        return this.cached;
    }
}
