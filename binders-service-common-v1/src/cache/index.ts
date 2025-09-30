
export { InvalidatorManager } from "./invalidating/invalidators";
export {
    AnyInvalidateEvent,
    AclInvalidateEvent
} from "./invalidating/invalidateevents";

export interface ICacheOptions {
    keyPrefix: string;
    cacheVersion: number;
    ttl: number;
    getSet?: IGetSet;
}
export interface ICache {
    get(k: string): Promise<string | undefined>;
    set(k: string, v: string): Promise<void>;
    flush(k: string);
}

export interface IGetSet {
    get(k: string): Promise<string | undefined>;
    set(k: string, v: string): Promise<void>;
    ttl(k: string, ttl: number): Promise<void>;
    flush(k: string): Promise<void>;
}

export class BaseCache implements ICache {

    public cacheHits: number;
    public cacheMisses: number;

    constructor(private options: ICacheOptions) {
        this.cacheHits = 0;
        this.cacheMisses = 0;

        if (!options.getSet) {
            throw new Error("Need get-set backend.");
        }
    }

    async get(key: string): Promise<string> {
        const actualKey = this.buildKey(key);
        const value = await this.options.getSet.get(actualKey);
        if (value !== undefined) {
            this.cacheHits++;
        } else {
            this.cacheMisses++;
        }
        return value;
    }

    async set(key: string, value: string): Promise<void> {
        const actualKey = this.buildKey(key);
        const { getSet, ttl } = this.options;
        await getSet.set(actualKey, value);
        if (ttl !== 0) {
            await getSet.ttl(actualKey, ttl);
        }
    }

    async flush(key: string): Promise<void> {
        const actualKey = this.buildKey(key);
        await this.options.getSet.flush(actualKey);
    }

    private buildKey (k: string): string {
        const { keyPrefix, cacheVersion } = this.options;
        return buildCacheKey(keyPrefix, cacheVersion, k);
    }
}

export function buildCacheKey(prefix: string, version: number, key: string): string {
    return `${prefix}-${version}-${key}`;
}

export interface MemoryGetSetValue {
    value: string;
    expiration: number;
}

export class MemoryGetSet implements IGetSet {

    private entries: {[key: string]: MemoryGetSetValue};

    constructor() {
        this.entries = {};
    }

    async get(k: string): Promise<string | undefined> {
        const entry = this.entries[k];
        if (entry === undefined) {
            return undefined;
        }
        const { expiration, value } = entry;
        const now = new Date().getTime();
        if (expiration === 0 || expiration > now) {
            return value;
        }
        return undefined;
    }

    async set(k: string, v: string): Promise<void> {
        this.entries[k] = {
            value: v,
            expiration: 0
        };
    }

    async ttl(k: string, ttl: number): Promise<void> {
        const expires = ttl === 0 ? 0 : (new Date().getTime()) + ttl;
        if (k in this.entries) {
            this.entries[k].expiration = expires;
        }
    }

    async flush(k: string): Promise<void> {
        delete this.entries[k];
    }
}

const completeMemCacheOptions = (options: ICacheOptions) => {
    if (! options.getSet) {
        return {
            ...options,
            getSet: new MemoryGetSet()
        }
    }
    return options;
}

export class MemoryCache extends BaseCache {
    constructor(options: ICacheOptions) {
        super(completeMemCacheOptions(options));
    }
}

