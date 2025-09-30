/* eslint-disable no-console */
import {
    BackendAccountServiceClient,
    BackendTrackingServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { differenceInSeconds } from "date-fns";

/*
    Usage of the apps generates a number of UserEvents, which are dumped in mongo collections.
    Some of these add up quickly, so to make tracking user activity more manageable,
    we periodically aggregate them into UserActions with this script (launched via cronjob).
*/

const config = BindersConfig.get();

const getTrackingServiceClient = () => BackendTrackingServiceClient.fromConfig(config, "aggregate-user-events");
const getAccountServiceClient = () => BackendAccountServiceClient.fromConfig(config, "aggregate-user-events");

const getOptions = () => {
    const { argv } = process;

    const hasOptions = argv.length > 2;
    const fullRunOptionIndex = hasOptions ? argv.indexOf("full") : -1;
    const aggregatorTypesOptionIndex = hasOptions ? argv.indexOf("--aggregatorTypes") : -1;
    const accountsOptionIndex = hasOptions ? argv.indexOf("--accounts") : -1;

    return {
        doFullRun: hasOptions && fullRunOptionIndex > -1,
        aggregatorTypes: aggregatorTypesOptionIndex > -1 && argv
            .slice(aggregatorTypesOptionIndex + 1, argv.length)
            .reduce((out, input) => {
                const aggregatorType = parseInt(input, 10);
                return (!Number.isNaN(aggregatorType)) ? [...out, aggregatorType] : out;
            }, []),
        accounts: accountsOptionIndex > -1 && argv
            .slice(accountsOptionIndex + 1,
                Math.min(
                    fullRunOptionIndex > accountsOptionIndex ? fullRunOptionIndex : 1000,
                    aggregatorTypesOptionIndex > accountsOptionIndex ? aggregatorTypesOptionIndex : 1000,
                    argv.length
                )
            )
    };
};

const doAggregate = async () => {
    const { doFullRun, aggregatorTypes, accounts: accountsOptions } = getOptions();
    if (!doFullRun) {
        console.log("Info: To do a full non-incremental run, run: node aggregateUserEvents.js full");
    }
    const [
        accountClient,
        trackingClient,
    ] = await Promise.all([
        getAccountServiceClient(),
        getTrackingServiceClient(),
    ]);

    let accounts: Account[];
    if (accountsOptions) {
        accounts = await accountClient.findAccountsForIds(accountsOptions);
    } else {
        accounts = await accountClient.listAccounts();
    }

    const scriptStart = Date.now();

    console.log(`started a ${doFullRun ? "full" : "incremental"} user aggregation run for ${accounts.length} accounts`);

    let exitCode = 0;

    for (const account of accounts) {
        if (account.id === "aid-1d9267a5-37bd-4f3e-a076-7bd21838d5df") {
            console.log("Shortcutting idbvdt for now.");
            continue;
        }
        console.log(`aggregating user events for ${account.name}`);
        const accountStart = Date.now();
        const rangeOverride = doFullRun ?
            { rangeStart: new Date("2017-01-01") } :
            undefined;
        if (aggregatorTypes) {
            console.log("Aggregating events for aggregator ids", aggregatorTypes.join());
        }
        const report = await trackingClient.aggregateUserEvents([account.id], { rangeOverride, aggregatorTypes });

        if (Object.values(report).some(accountAggregationReport => accountAggregationReport.exception)) {
            exitCode = 1;
        }

        console.log(`done, took ${differenceInSeconds(Date.now(), accountStart)} seconds, report: ${JSON.stringify(report, undefined, 2)}`);
    }
    console.log(`Events have been aggregated for all accounts. Took ${differenceInSeconds(Date.now(), scriptStart)} seconds in total`);
    process.exit(exitCode);
}

doAggregate()
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
