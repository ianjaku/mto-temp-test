/* eslint-disable no-console */

import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { getRedisClient } from "@binders/binders-service-common/lib/redis/client";
import { main } from "@binders/binders-service-common/lib/util/process";

// 6379
const OLD_MASTER = "redis-default-redis-ha";
const NEW_MASTER = "redis-node-0.redis-headless.production.svc.cluster.local";

const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config);

const doSave = process.argv[2] == "--save";

main(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const oldClient = getRedisClient( {host: OLD_MASTER, port: 6379, useSentinel: false}, logger);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newClient = getRedisClient( {host: NEW_MASTER, port: 6379, useSentinel: false}, logger);

    const keys = await oldClient.keys("user-sess-*");
    for (const key of keys) {
        if (await newClient.exists(key)) {
            continue;
        }
        const userSessions = await oldClient.hgetall(key);
        console.log(userSessions);
        for (const sessionId of Object.keys(userSessions)) {
            const session = userSessions[sessionId];
            console.log(key);
            console.log(sessionId);
            console.log(session);
            if (doSave) {
                await newClient.hset(key, sessionId, session);
            }
        }
    }
})