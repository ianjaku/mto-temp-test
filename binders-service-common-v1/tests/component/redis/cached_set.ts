import { BindersConfig } from "../../../src/bindersconfig/binders"
import { CachedRedisSet } from "../../../src/redis/cached_set"
import { RedisClientBuilder } from "../../../src/redis/client"
import sleep from "../../../src/util/sleep"
import { v4 } from "uuid"

const config = BindersConfig.get();

const redisClient = RedisClientBuilder.fromConfig(config, "test");


async function assertSet(set: Set<string>, values: string[]) {
    expect(set.size).toEqual(values.length);
    for (const value of values) {
        expect(set.has(value)).toEqual(true);
    }
}
async function addItemAndValidate(rSet: CachedRedisSet, value: string, setValues: string[]) {
    const returnAfterAdd = await rSet.addItemToSet(value);
    await assertSet(returnAfterAdd, setValues);
    const setFromGet = await rSet.getSet();
    await assertSet(setFromGet, setValues);
}

async function removeItemAndValidate(rSet: CachedRedisSet, value: string, setValues: string[]) {
    const returnAfterRemove = await rSet.removeValueFromSet(value);
    await assertSet(returnAfterRemove, setValues);
    const setFromGet = await rSet.getSet();
    await assertSet(setFromGet, setValues);
}

it("should set / get / delete", async () => {
    const cachedSet = new CachedRedisSet(redisClient, { key: `crs-${v4()}`, refreshInterval: 10 });
    const emptySet = await cachedSet.getSet();
    await assertSet(emptySet, []);
    await addItemAndValidate(cachedSet, "v1", ["v1"]);
    await addItemAndValidate(cachedSet, "v1", ["v1"]);
    await addItemAndValidate(cachedSet, "v2", ["v1", "v2"]);
    await removeItemAndValidate(cachedSet, "v2", ["v1"]);
    await removeItemAndValidate(cachedSet, "v2", ["v1"]);
    await removeItemAndValidate(cachedSet, "v1", []);
});

it("should not reload", async () => {
    const refreshInterval = 500;
    const cachedSet = new CachedRedisSet(redisClient, { key: `crs-${v4()}`, refreshInterval });
    expect(cachedSet.reloadCount).toEqual(0);
    await cachedSet.getSet();
    expect(cachedSet.reloadCount).toEqual(1);
    await cachedSet.getSet();
    expect(cachedSet.reloadCount).toEqual(1);
    await sleep(refreshInterval * 2);
    await cachedSet.getSet();
    expect(cachedSet.reloadCount).toEqual(2);
    await cachedSet.getSet();
    expect(cachedSet.reloadCount).toEqual(2);
});