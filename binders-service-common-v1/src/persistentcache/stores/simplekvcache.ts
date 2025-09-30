import { RedisClient } from "../../redis/client";

export abstract class SimpleKVCache<T> {
    protected constructor(
        private readonly identifier: string,
        private readonly version: string | string[],
        private readonly client: RedisClient,
    ) {}

    protected serialize(value: T): string {
        return JSON.stringify(value);
    }

    protected deserialize(serialized: string): T {
        return JSON.parse(serialized);
    }

    protected async set(key: string, value: T): Promise<void> {
        const serialized = this.serialize(value);
        await this.client.set(this.getKey(key), serialized);
    }

    protected async setMany(items: {[key: string]: T}): Promise<void> {
        const data: string[] = [];
        for (const key in items) {
            data.push(
                this.getKey(key),
                this.serialize(items[key])
            );
        }
        await this.client.mset(...data);
    }

    protected async get(key: string): Promise<T> {
        const serialized = await this.client.get(
            this.getKey(key)
        );
        if (serialized == null) return null;
        return this.deserialize(serialized);
    }

    protected async getMany(keys: string[]): Promise<{key: string; value: null | T}[]> {
        if (keys.length === 0) return [];
        const values = await this.client.mget(
            ...keys.map(key => this.getKey(key))
        );
        return values.map((serializedValue, index) => {
            const key = keys[index];
            const value = serializedValue == null ?
                null :
                this.deserialize(serializedValue);

            return { key, value };
        });
    }

    protected async remove(keys: string[]): Promise<void> {
        if (keys.length === 0) return;
        await this.client.del(
            ...keys.map(key => this.getKey(key))
        );
    }

    protected async has(key: string): Promise<boolean> {
        const result = await this.client.exists(this.getKey(key));
        return !!result;
    }

    private getKey(id: string) {
        const versions = Array.isArray(this.version) ?
            this.version :
            [this.version];
        return [this.identifier, ...versions, id].join("/");
    }
}
