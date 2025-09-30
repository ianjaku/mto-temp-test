import { BLOCK_IP_REPO_OPTIONS, getRedisClient } from "@binders/binders-service-common/lib/middleware/block_requests/request_blocker"
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders"
import { CachedRedisSet } from "@binders/binders-service-common/lib/redis/cached_set"

/* eslint-disable no-console */
const getOptions = () => {
    if (process.argv.length !== 3) {
        console.error(`Usage: node ${__filename} <IP>`);
        process.exit(1);
    }
    return {
        ip: process.argv[2]
    };
};

const doIt = async () => {
    const { ip } = getOptions();
    const config = BindersConfig.get();
    const client = getRedisClient(config);
    const blockedIpRepo = new CachedRedisSet(client, BLOCK_IP_REPO_OPTIONS);
    await blockedIpRepo.removeValueFromSet(ip);
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