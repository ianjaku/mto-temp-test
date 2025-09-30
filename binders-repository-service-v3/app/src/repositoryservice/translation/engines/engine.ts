import { Logger, LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { Config } from "@binders/client/lib/config/config";
import { IEngineLanguage } from "./types";
import { MTEngineType } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { RedisClientBuilder } from "@binders/binders-service-common/lib/redis/client";
import { TranslationLanguagesCache } from "./cache";


export interface ITranslationParams {
    content: string;
    sourceLanguageCode: string;
    targetLanguageCode: string;
    isHTML: boolean;
}

export function standardizeLanguageCode(languageCode: string): string {
    const normalized = {
        ["lzh"]: "zh",
        ["zh-Hans"]: "zh-cn",
        ["zh-Hant"]: "zh-tw",
    }[languageCode];
    return normalized || languageCode;
}

const MT_LANGUAGES_REDIS_DB = "mtlanguages";

/**
 * Machine Translation Engine
 */
export abstract class MTEngine {


    abstract type: MTEngineType;

    abstract getCharLimit(): number;
    abstract translate(params: ITranslationParams): Promise<string>;
    protected abstract fetchSupportedLanguages(): Promise<IEngineLanguage[]>;
    abstract detectLanguage(content: string): Promise<string>;
    private languagesCache: TranslationLanguagesCache;
    protected logger: Logger;

    constructor(mtType: MTEngineType, config: Config) {
        this.logger = LoggerBuilder.fromConfig(config);
        if (RedisClientBuilder.canBuild(config, MT_LANGUAGES_REDIS_DB)) {
            const redisClient = RedisClientBuilder.fromConfig(config, MT_LANGUAGES_REDIS_DB);
            const cacheOptions = {
                keySuffix: MTEngineType[mtType],
                logger: this.logger,
                redisClient,
            }
            this.languagesCache = new TranslationLanguagesCache(cacheOptions);
        }
    }
    async getSupportedLanguages(skipCache = false): Promise<IEngineLanguage[]> {
        if (!skipCache && this.languagesCache) {
            const cachedLanguages = await this.loadLanguagesFromCache();
            if (cachedLanguages) {
                return cachedLanguages;
            }
        }
        if (skipCache || !this.languagesCache) {
            return this.fetchSupportedLanguages();
        }
        return this.fetchAndUpdateCachedLanguages();
    }

    async loadLanguagesFromCache(): Promise<IEngineLanguage[]> {
        return this.languagesCache.getTranslations();
    }

    async updateCachedLanguages(languages: IEngineLanguage[]): Promise<boolean> {
        if (!this.languagesCache) {
            throw new Error("Cannot update cached languages without a cache");
        }
        return await this.languagesCache.setTranslations(languages);
    }

    async fetchAndUpdateCachedLanguages(): Promise<IEngineLanguage[]> {
        const languages = await this.fetchSupportedLanguages();
        if (languages.length == 0) {
            this.logger.error(`Failed to fetch supported languages for ${MTEngineType[this.type]}`, "fetchSupportedLanguages");
            return [];
        }
        await this.updateCachedLanguages(languages);
        return languages;
    }

    // If strict is false, base language is also considered
    // ex: "en-GB", also looks for "en"
    async hasSupportFor(languageCode: string, strict: boolean): Promise<string | false> {
        const supportedLanguages = await this.getSupportedLanguages();
        if (supportedLanguages.some(sl => sl.code === languageCode)) {
            return languageCode;
        }
        if (strict) return false;
        const defaultVersion = languageCode.split("-")[0];
        if (supportedLanguages.some(sl => sl.code === defaultVersion)) {
            return defaultVersion;
        }
        return false;
    }

    async shutdown(): Promise<void> {
        if (this.languagesCache) {
            await this.languagesCache.shutdown();
        }
    }
}
