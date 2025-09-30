import {
    BLOCK_IP_REPO_OPTIONS,
    BLOCK_USER_REPO_OPTIONS,
    getRedisClient
} from "@binders/binders-service-common/lib/middleware/block_requests/request_blocker";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders"
import { CachedRedisSet } from "@binders/binders-service-common/lib/redis/cached_set"

/* eslint-disable no-console */
const doIt = async () => {
    const config = BindersConfig.get();
    const client = getRedisClient(config);
    const blockedUserRepo = new CachedRedisSet(client, BLOCK_USER_REPO_OPTIONS);
    const blockedIpRepo = new CachedRedisSet(client, BLOCK_IP_REPO_OPTIONS);
    const blockedUsers = Array.from(await blockedUserRepo.getSet());
    const blockedIps = Array.from(await blockedIpRepo.getSet());
    console.log("BLOCKED USERS:");
    console.log("==============");
    console.log(JSON.stringify(blockedUsers, null, 4));
    console.log("BLOCKED IPs:");
    console.log("============");
    console.log(JSON.stringify(blockedIps, null, 4));
}



doIt()
    .then(() => {
        console.log("All done!");
        process.exit(0);
    },
    error => {
        console.error(error);
        process.exit(1);
    });