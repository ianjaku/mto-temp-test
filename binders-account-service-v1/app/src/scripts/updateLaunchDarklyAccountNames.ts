/* eslint-disable no-console */
/**
* Sends all account ids and names to LaunchDarkly to target individual accounts
*   by name inside the LaunchDarkly UI instead of having to use an account id
* 
* It might take a few minutes for the changes to be reflected in the LaunchDarkly UI
*/
import {
    BackendAccountServiceClient
} from  "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import LaunchDarklyService from "@binders/binders-service-common/lib/launchdarkly/server";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";


const doIt = async () => {
    const config = BindersConfig.get();
    const logger = LoggerBuilder.fromConfig(config);
    const ld = await LaunchDarklyService.create(config, logger)

    const accountClient = await BackendAccountServiceClient.fromConfig(config, "update-launch-darkly-account-names");
    const accounts = await accountClient.listAccounts();

    for (const account of accounts) {
        ld.updateContext({
            kind: "account",
            key: account.id,
            name: account.name,
        });
    }

    console.log("Flushing events to LaunchDarkly...")
    await ld.flushEvents();
}

doIt().then(() => console.log("All done!"))
