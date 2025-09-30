import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LD_FLAGS_KEY } from "@binders/binders-service-common/lib/launchdarkly/server";
import LaunchDarklyService from "@binders/binders-service-common/lib/launchdarkly/server";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { RedisClientBuilder } from "@binders/binders-service-common/lib/redis/client";
import { main } from "@binders/binders-service-common/lib/util/process";


const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config);
const CATEGORY = "save-flags-in-redis"

main(async () => {
    const ldService = await LaunchDarklyService.create(config, LoggerBuilder.fromConfig(config))
    const flags = await ldService.getAllFlags()
    const redisClient = RedisClientBuilder.fromConfig(config, "sessions")
    await redisClient.set(LD_FLAGS_KEY, JSON.stringify(flags))
    logger.info("Flags saved in redis", CATEGORY)
    const str = await redisClient.get(LD_FLAGS_KEY)
    logger.info(str, CATEGORY)
})