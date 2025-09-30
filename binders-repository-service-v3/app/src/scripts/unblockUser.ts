import { BLOCK_USER_REPO_OPTIONS, getRedisClient } from "@binders/binders-service-common/lib/middleware/block_requests/request_blocker"
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders"
import { CachedRedisSet } from "@binders/binders-service-common/lib/redis/cached_set"

/* eslint-disable no-console */
const getOptions = () => {
    if (process.argv.length !== 3) {
        console.error(`Usage: node ${__filename} <USER_ID>`);
        process.exit(1);
    }
    return {
        userId: process.argv[2]
    };
};


const doIt = async () => {
    const { userId } = getOptions();
    const config = BindersConfig.get();
    const client = getRedisClient(config);
    const blockedUserRepo = new CachedRedisSet(client, BLOCK_USER_REPO_OPTIONS);
    await blockedUserRepo.removeValueFromSet(userId);
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