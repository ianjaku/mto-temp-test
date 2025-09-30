import { BaseStyleProps } from "./base";
import { CssTemplateBuilder } from "./cssTemplateBuilder";
import { Maybe } from "@binders/client/lib/monad";
import { RedisClient } from "../redis/client";

export abstract class CssRepository<T extends BaseStyleProps> {

    protected constructor(protected cssTemplateBuilder: CssTemplateBuilder<T>) { }

    abstract load(key: string): Promise<Maybe<string>>;
    abstract store(key: string, css: string): Promise<void>;

    async flushCache(_id: string): Promise<void> {
    }

    build(key: string): Promise<string> {
        return this.cssTemplateBuilder.build(key);
    }

    async get(key: string, rebuild = false): Promise<string> {
        const storedCssOption = rebuild ? Maybe.nothing<string>() : await this.load(key);
        if (storedCssOption.isJust()) {
            return storedCssOption.get();
        }
        const css = await this.build(key);
        await this.store(key, css);
        return css;
    }
}

export class RedisCssRepository<T extends BaseStyleProps> extends CssRepository<T> {

    static readonly TTL = 300;

    buildRedisKey(tail: string): string {
        return `${this.keyPrefix}-${tail}`;
    }

    constructor(
        private readonly client: RedisClient,
        private readonly keyPrefix: string,
        builder: CssTemplateBuilder<T>
    ) {
        super(builder);
    }

    static build(
        client: RedisClient,
        keyPrefix: string,
        builder: CssTemplateBuilder<BaseStyleProps>
    ): RedisCssRepository<BaseStyleProps> {
        return new RedisCssRepository(client, keyPrefix, builder);
    }

    async load(key: string): Promise<Maybe<string>> {
        const value = await this.client.get(this.buildRedisKey(key));
        return Maybe.fromUndefinedOrNull(value);
    }

    async flushCache(id: string): Promise<void> {
        const key = this.buildRedisKey(id);
        await this.client.del(key);
    }

    async store(key: string, css: string): Promise<void> {
        const redisKey = this.buildRedisKey(key);
        await this.client.set(redisKey, css);
        await this.client.expire(redisKey, RedisCssRepository.TTL);
    }
}