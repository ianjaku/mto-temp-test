/* eslint-disable no-console */
import { BackendUserServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders"


const getOptions = () => {
    if (process.argv.length !== 3) {
        console.error(`Usage: node ${__filename} <LOGIN>`);
        process.exit(1);
    }
    return {
        login: process.argv[2]
    };
};

async function doIt() {
    const options = getOptions();
    const config = BindersConfig.get();
    const client = await BackendUserServiceClient.fromConfig(config, "testGetUserByLogin");
    const result = await client.getUserByLogin(options.login);
    console.log("Result:", result);
}

doIt()
    .then(() => console.log("All done."))
    .catch((e) => console.log("Damn, something went wrong:", e))