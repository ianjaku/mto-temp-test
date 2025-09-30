import { IEngineLanguage } from "./types";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { RedisClient } from "@binders/binders-service-common/lib/redis/client";


const LOG_CATEGORY = "translations-cache";
const CACHE_VERSION = 1;
const THREE_DAYS = 3 * 24 * 60 * 60;

export interface CacheOptions {
    redisClient: RedisClient;
    keySuffix: string;
    logger: Logger;
}


export class TranslationLanguagesCache {
    constructor(private options: CacheOptions) {

    }

    async getTranslations(): Promise<IEngineLanguage[] | undefined> {
        const key = this.buildCacheKey();
        const value = await this.options.redisClient.get(key);
        if (!value) {
            this.logTrace(`TranslationsCache: key ${key} not found in cache`);
            return undefined;
        }
        this.logTrace(`TranslationsCache: key ${key} found in cache`);
        return JSON.parse(value);
    }

    async setTranslations(translations: IEngineLanguage[]): Promise<boolean> {
        try {
            const key = this.buildCacheKey();
            const value = JSON.stringify(translations);
            await this.options.redisClient.set(key, value);
            await this.options.redisClient.expire(key, THREE_DAYS);
            this.logTrace(`TranslationsCache: key ${key} set in cache`);
            return true;
        } catch (err) {
            this.logException(err);
            return false;
        }
    }

    private buildCacheKey(): string {
        return `translation-languages:${CACHE_VERSION}:${this.options.keySuffix}`;
    }

    private logTrace(msg: string) {
        this.options.logger.trace(msg, LOG_CATEGORY);
    }

    private logException(err) {
        this.options.logger.logException(err, LOG_CATEGORY);
    }

    async shutdown(): Promise<void> {
        await this.options.redisClient.quit();
    }
}