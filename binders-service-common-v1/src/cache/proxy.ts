import { ICache } from ".";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function buildFunctionKey (
    functionName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args: any[]
) {
    return [functionName, ...args]
        .map(k => `${JSON.stringify(k)}`)
        .join("-");
}

function cachingHandler  (cache: ICache ) {
    return {
        get: (object, prop) => {
            const proxiedPropOrMethod = object[prop];
            if (typeof proxiedPropOrMethod !== "function") {
                return proxiedPropOrMethod;
            }
            return async function(...args) {
                const key = buildFunctionKey(prop, args);
                const cachedValue = await cache.get(key);
                if (cachedValue !== undefined) {
                    return (cachedValue === "undefined") ?
                        undefined :
                        JSON.parse(cachedValue);
                }
                const result = await proxiedPropOrMethod.apply(object, args);
                const value = (result === undefined) ?
                    "undefined" :
                    JSON.stringify(result);
                await cache.set(key, value);
                return result;
            };
        }
    };
}


function flushingHandler  (cache: ICache ) {
    return {
        get: (object, prop) => {
            const proxiedPropOrMethod = object[prop];
            if (typeof proxiedPropOrMethod !== "function") {
                return proxiedPropOrMethod;
            }
            return async function(...args) {
                const key = buildFunctionKey(prop, args);
                await cache.flush(key);
            }
        }
    }
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function getCachingProxy<
    // eslint-disable-next-line @typescript-eslint/ban-types
    ToProxy extends Object
>(
    toProxy: ToProxy,
    cache: ICache
) {
    return new Proxy<ToProxy>(toProxy, cachingHandler(cache));
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function getFlushingProxy<
    // eslint-disable-next-line @typescript-eslint/ban-types
    ToProxy extends Object
>(
    toProxy: ToProxy, cache: ICache
) {
    return new Proxy<ToProxy>(toProxy, flushingHandler(cache));
}