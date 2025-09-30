import * as t from "tcomb";
import { IValidationEnv, strict, typeHost, typeStrictStruct } from "../types";
import { REDIS_DATABASES, REDIS_DEV_DATABASES } from "../../bindersconfig";

const sentinel = t.struct({
    host: typeHost,
    port: t.Number,
}, strict);

const sentinels = t.list(sentinel);

const sentinelRedisEntry = t.struct({
    useSentinel: t.Boolean,
    host: typeHost,
    port: t.Number,
    sentinels: sentinels
}, { strict: true });

const redisEntry = t.struct({
    useSentinel: t.Boolean,
    host: typeHost,
    port: t.Number,
}, { strict: true });

/* eslint-disable-next-line */
export default function (env: IValidationEnv) {
    const extraEntries = env === "local" ?
        REDIS_DEV_DATABASES :
        [];
    const allEntries = [
        ...REDIS_DATABASES,
        ...extraEntries
    ]
    const redisStruct = env === "production" ? sentinelRedisEntry : redisEntry
    return typeStrictStruct(allEntries, redisStruct);
}
