import { BindersConfig } from "../../../src/bindersconfig/binders";
import { RedisClientBuilder } from "../../../src/redis/client";
import UUID from "@binders/client/lib/util/uuid";

const config = BindersConfig.get();
const prefix = UUID.random().toString() + "-";

const redisClient = RedisClientBuilder.fromConfig(config, "test");


describe("redis client mget", () => {
    it("should get multiple keys", () => {
        const data = {
            key1: `${prefix}value1`,
            key2: `${prefix}value2`
        };
        let inputPromise = Promise.resolve(undefined);
        for (const key in data) {
            inputPromise = inputPromise.then(() => redisClient.set(key, data[key]));
        }
        const mgetKeys = Object.keys(data);
        const mgetValues = mgetKeys.map(key => data[key]);
        return inputPromise.then( () => {
            return redisClient.mget(...mgetKeys);
        })
            .then(values => expect(values).toEqual(mgetValues));
    });
    it("should return null when keys are missing", () => {
        const data = {
            key1: `${prefix}value1`,
            key2: `${prefix}value2`
        };
        let inputPromise = Promise.resolve(undefined);
        for (const key in data) {
            inputPromise = inputPromise.then(() => redisClient.set(key, data[key]));
        }
        const mgetKeys = Object.keys(data);
        const mgetValues = mgetKeys.map(key => data[key]);
        mgetKeys.push("fakeKey");
        // tslint:disable-next-line
        mgetValues.push(null);
        return inputPromise.then( () => {
            return redisClient.mget(...mgetKeys);
        })
            .then(values => expect(values).toEqual(mgetValues));
    });
});


afterEach(() => {
    return redisClient.keys(`${prefix}*`)
        .then(keys => {
            if (keys && keys.length) {
                return redisClient.del(...keys);
            }
            return Promise.resolve(undefined);
        });
});

afterAll( () => redisClient.quit());