import { Maybe } from "../monad";

export class ConfigError extends Error {

    static NAME = "ConfigError";

    constructor(message: string) {
        super();
        this.message = message;
        this.name = ConfigError.NAME;
    }
}

export abstract class Config {

    static KEY_SEPARATOR = ".";

    abstract getString(key: string): Maybe<string>;
    // eslint-disable-next-line @typescript-eslint/ban-types
    abstract getObject<T extends Object = Object>(key: string): Maybe<T>;
    abstract getArray<T>(key: string): Maybe<Array<T>>;
    abstract getNumber(key: string): Maybe<number>;
    abstract getBoolean(key: string): Maybe<boolean>;

    // eslint-disable-next-line @typescript-eslint/ban-types
    protected getFromObject<T>(keyParts: Array<string>, data: Object, validator: (x: unknown) => boolean): Maybe<T> {
        const currentKey = keyParts[0];
        if (!(currentKey in data)) {
            return Maybe.nothing<T>();
        }
        const nextValue = data[currentKey];
        if (keyParts.length === 1) {
            if (nextValue !== undefined && validator(nextValue)) {
                return Maybe.just(nextValue);
            }
            else {
                return Maybe.nothing<T>();
            }
        }
        if (typeof nextValue !== "object") {
            return Maybe.nothing<T>();
        }
        const newKeyparts = keyParts.slice(1);
        return this.getFromObject<T>(newKeyparts, nextValue, validator);
    }

    static getServicePrefixKey(serviceName: string): string {
        return `services.${serviceName}.prefix`;
    }

    static getServiceLocationKey(serviceName: string): string {
        return `services.${serviceName}.location`;
    }

    static getServiceExternalLocationKey(serviceName: string): string {
        return `services.${serviceName}.externalLocation`;
    }

    static getServicesPrefixKey(serviceName: string): string {
        return `services.${serviceName}.prefix`;
    }
}

export class ObjectConfig extends Config {

    // eslint-disable-next-line @typescript-eslint/ban-types
    constructor(protected data: Object) {
        super();
    }

    private get<T>(key: string, validator: (_: unknown) => boolean): Maybe<T> {
        const keyParts = key.split(Config.KEY_SEPARATOR);
        return this.getFromObject<T>(
            keyParts,
            this.data,
            validator
        );
    }

    getString(key: string): Maybe<string> {
        return this.get<string>(
            key,
            (a) => { return typeof a === "string"; }
        );
    }

    // eslint-disable-next-line @typescript-eslint/ban-types
    getObject<T extends Object = Object>(key: string): Maybe<T> {
        return this.get<T>(
            key,
            (a) => { return a instanceof Object; }
        );
    }

    getArray<T>(key: string): Maybe<T[]> {
        return this.get<Array<T>>(
            key,
            (a) => { return a instanceof Array; }
        );
    }

    getNumber(key: string): Maybe<number> {
        return this.get<number>(
            key,
            (a) => { return typeof a === "number"; }
        );
    }

    getBoolean(key: string): Maybe<boolean> {
        return this.get<boolean>(
            key,
            (a) => { return typeof a === "boolean"; }
        );
    }
}
