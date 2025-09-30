import { MemoryCache, MemoryGetSet } from "../../../src/cache";
import { getCachingProxy } from "../../../src/cache/proxy";

class A {
    async a(t: string, n: number) {
        return Number.parseInt(t, n);
    }

    async b(x: string, y: string) {
        if (x === undefined || y === undefined) {
            return undefined;
        }
        return `${x}--${y}`;
    }
}

it("memory cache should cache results", async () => {
    const options = {
        keyPrefix: "unit-test-",
        cacheVersion: 1,
        ttl: 0
    }
    const memoryCache = new MemoryCache(options);
    expect(memoryCache.cacheHits).toEqual(0);
    expect(memoryCache.cacheMisses).toEqual(0);
    const proxied = getCachingProxy(new A(), memoryCache);
    const a1 = await proxied.a("123", 10);
    expect(a1).toEqual(123);
    expect(memoryCache.cacheHits).toEqual(0);
    expect(memoryCache.cacheMisses).toEqual(1);
    const a2 = await proxied.a("123", 10);
    expect(a2).toEqual(123);
    expect(memoryCache.cacheHits).toEqual(1);
    expect(memoryCache.cacheMisses).toEqual(1);
})

it("memory cache should reuse getset", async () => {
    const options = {
        keyPrefix: "unit-test-",
        cacheVersion: 1,
        getSet: new MemoryGetSet(),
        ttl: 0
    };
    const memoryCache1 = new MemoryCache(options);
    const memoryCache2 = new MemoryCache(options);
    const proxied1 = getCachingProxy(new A(), memoryCache1);
    await proxied1.a("123", 10);
    expect(memoryCache1.cacheHits).toEqual(0);
    expect(memoryCache1.cacheMisses).toEqual(1);
    await proxied1.a("123", 10);
    expect(memoryCache1.cacheHits).toEqual(1);
    expect(memoryCache1.cacheMisses).toEqual(1);
    const proxied2 = getCachingProxy(new A(), memoryCache2);
    expect(memoryCache2.cacheHits).toEqual(0);
    expect(memoryCache2.cacheMisses).toEqual(0);
    await proxied2.a("123", 10);
    expect(memoryCache2.cacheHits).toEqual(1);
    expect(memoryCache2.cacheMisses).toEqual(0);
    await proxied2.a("123", 10);
    expect(memoryCache2.cacheHits).toEqual(2);
    expect(memoryCache2.cacheMisses).toEqual(0);
})

it("memory cache should respect keyPrefix", async () => {
    const options1 = {
        keyPrefix: "unit-test-1-",
        cacheVersion: 1,
        ttl: 0
    }
    const options2 = {
        keyPrefix: "unit-test-2-",
        cacheVersion: 1,
        ttl: 0
    }
    const getSet = new MemoryGetSet();
    const memoryCache1 = new MemoryCache({
        ...options1,
        getSet
    });
    const memoryCache2 = new MemoryCache({
        ...options2,
        getSet
    });

    const proxied1 = getCachingProxy(new A(), memoryCache1);
    await proxied1.a("123", 10);
    expect(memoryCache1.cacheHits).toEqual(0);
    expect(memoryCache1.cacheMisses).toEqual(1);
    await proxied1.a("123", 10);
    expect(memoryCache1.cacheHits).toEqual(1);
    expect(memoryCache1.cacheMisses).toEqual(1);
    const proxied2 = getCachingProxy(new A(), memoryCache2);
    expect(memoryCache2.cacheHits).toEqual(0);
    expect(memoryCache2.cacheMisses).toEqual(0);
    await proxied2.a("123", 10);
    expect(memoryCache2.cacheHits).toEqual(0);
    expect(memoryCache2.cacheMisses).toEqual(1);
    await proxied2.a("123", 10);
    expect(memoryCache2.cacheHits).toEqual(1);
    expect(memoryCache2.cacheMisses).toEqual(1);

})

it("memory cache should respect cacheVersion", async () => {
    const options1 = {
        keyPrefix: "unit-test-",
        cacheVersion: 1,
        ttl: 0
    }
    const options2 = {
        keyPrefix: "unit-test-",
        cacheVersion: 2,
        ttl: 0
    }
    const getSet = new MemoryGetSet();
    const memoryCache1 = new MemoryCache({
        ...options1,
        getSet,
    });
    const memoryCache2 = new MemoryCache({
        ...options2,
        getSet
    });

    const proxied1 = getCachingProxy(new A(), memoryCache1);
    await proxied1.a("123", 10);
    expect(memoryCache1.cacheHits).toEqual(0);
    expect(memoryCache1.cacheMisses).toEqual(1);
    await proxied1.a("123", 10);
    expect(memoryCache1.cacheHits).toEqual(1);
    expect(memoryCache1.cacheMisses).toEqual(1);
    const proxied2 = getCachingProxy(new A(), memoryCache2);
    expect(memoryCache2.cacheHits).toEqual(0);
    expect(memoryCache2.cacheMisses).toEqual(0);
    await proxied2.a("123", 10);
    expect(memoryCache2.cacheHits).toEqual(0);
    expect(memoryCache2.cacheMisses).toEqual(1);
    await proxied2.a("123", 10);
    expect(memoryCache2.cacheHits).toEqual(1);
    expect(memoryCache2.cacheMisses).toEqual(1);
})

// it("should respect the ttl", async () => {
//     const ttl = 10;
//     const options = {
//         keyPrefix: "unit-test-",
//         cacheVersion: 1,
//         ttl
//     };
//     const memoryCache = new MemoryCache(options);
//     const proxied = getCachingProxy(new A(), memoryCache);
//     await proxied.a("123", 10);
//     expect(memoryCache.cacheHits).toEqual(0);
//     expect(memoryCache.cacheMisses).toEqual(1);
//     await proxied.a("123", 10);
//     expect(memoryCache.cacheHits).toEqual(1);
//     expect(memoryCache.cacheMisses).toEqual(1);
//     await sleep(2*ttl);
//     await proxied.a("123", 10);
//     expect(memoryCache.cacheHits).toEqual(1);
//     expect(memoryCache.cacheMisses).toEqual(2);
//     await proxied.a("123", 10);
//     expect(memoryCache.cacheHits).toEqual(2);
//     expect(memoryCache.cacheMisses).toEqual(2);
// })

it("should handle undefined properly", async () => {
    const options = {
        keyPrefix: "unit-test-",
        cacheVersion: 1,
        ttl: 0
    };
    const memoryCache = new MemoryCache(options);
    const proxied = getCachingProxy(new A(), memoryCache);
    const data1 = await proxied.b(undefined, "y");
    expect(data1).toEqual(undefined);
    expect(memoryCache.cacheHits).toEqual(0);
    expect(memoryCache.cacheMisses).toEqual(1);
    const data2 = await proxied.b(undefined, "y");
    expect(data2).toEqual(undefined);
    expect(memoryCache.cacheHits).toEqual(1);
    expect(memoryCache.cacheMisses).toEqual(1);
});