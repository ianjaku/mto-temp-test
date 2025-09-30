/* eslint-disable no-console */
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { RedisPermissionsRepository } from "../authorization/repositories/redisPermissionsRepository";

const config = BindersConfig.get();

function getOptions() {
    if (process.argv.length !== 3) {
        console.error(`Usage: node ${__filename} <USER_ID>`);
        process.exit(1);
    }
    return {
        userId: process.argv[2],
    };
}

async function doIt() {
    const { userId } = getOptions();
    const redisPermissionsRepository = await RedisPermissionsRepository.fromConfig(config);
    await redisPermissionsRepository.invalidatePermissionsForUser(userId);
}

doIt().then(() => {
    console.log("All done!");
    process.exit();
}).catch(error => {
    console.log("Error!", error);
    process.exit(1);
});
