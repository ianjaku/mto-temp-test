/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const memoizingHandler = <T> (toProxy: T) => {
    const cachedValues = {};
    return {
        get: (object, prop) => {
            const proxiedPropOrMethod = object[prop];
            if (typeof proxiedPropOrMethod !== "function") {
                return proxiedPropOrMethod;
            }
            return function(...args) {
                const key = JSON.stringify([prop, ...args]);
                if (key in cachedValues) {
                    return cachedValues[key];
                }
                const result = proxiedPropOrMethod.apply(object, args);
                cachedValues[key] = result;
                return result;
            };
        }
    };
};

export const getMemoizingProxy = <T> (toProxy: T) => new Proxy(toProxy, memoizingHandler(toProxy));

export const memoize = f => {
    const cachedValues = {};
    return function (...args) {
        const key = JSON.stringify(args);
        if (key in cachedValues) {
            return cachedValues[key];
        }
        const result = f(...args);
        cachedValues[key] = result;
        return result;
    };
};