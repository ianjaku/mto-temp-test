/* eslint-disable no-console */
import { BackendTrackingServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";

const config = BindersConfig.get();

const getTrackingServiceClient = () => BackendTrackingServiceClient.fromConfig(config, "aggregate-user-events");

const getOptions = () => {
    if (process.argv.length !== 4 || !(["true", "false"].includes(process.argv[3]))) {
        console.log(`Usage: node ${__filename} <ACCOUNT_ID> <EXCLUDE_AUTHORS(true|false)>`);
        process.exit(1);
    }
    const accountId = process.argv[2];
    const excludeAuthors = process.argv[3] === "true";
    console.log(`Running for ${accountId} ${excludeAuthors ? "excluding" : "including"} authors`);
    return {
        accountId,
        excludeAuthors,
    };
};

const doIt = async () => {
    const { accountId, excludeAuthors } = getOptions();
    const trackingClient = await getTrackingServiceClient();
    const rs = await trackingClient.accountViewsStatistics(accountId, excludeAuthors);
    console.log(rs)
}

doIt()
    .then(
        () => {
            console.log("All done!");
            process.exit(0);
        },
        err => {
            console.error(err);
            process.exit(1);
        }
    );
