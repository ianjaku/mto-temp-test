import {
    BackendAccountServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import ItemLockHandler from "../../notificationservice/itemLockHandler";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { RedisClientBuilder } from "@binders/binders-service-common/lib/redis/client";
import { main } from "@binders/binders-service-common/lib/util/process";

const SCRIPT = "createItemlockAccountSets";

main( async () => {
    const config = BindersConfig.get();
    const accountClient = await BackendAccountServiceClient.fromConfig(config, SCRIPT);
    const accounts = await accountClient.listAccounts();
    const redisClient = await RedisClientBuilder.fromConfig(config, "pubsub");
    const logger = LoggerBuilder.fromConfig(config);
    const lockHandler = new ItemLockHandler(redisClient);
    for (const account of accounts) {
        await lockHandler.ensureAccountHasSet(account.id, logger);
    }
})