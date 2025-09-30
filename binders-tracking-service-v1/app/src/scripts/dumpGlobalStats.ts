/* eslint-disable no-console */
import { BackendAccountServiceClient, BackendTrackingServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { AccountServiceContract } from "@binders/client/lib/clients/accountservice/v1/contract";
import { AccountUsage } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";

const accountNameCache = {};

const getAccountName = async (id: string, client: AccountServiceContract) => {
    if (! (id in accountNameCache) ) {
        const accounts = await client.listAccounts();
        for (const account of accounts) {
            accountNameCache[account.id] = account.name;
        }
    }
    return accountNameCache[id];
}

const printHeader = () => {
    console.log("account,docs created,doc edits, docs read,time in reader");
}

const printRow = (name: string, accountStats: AccountUsage) => {
    console.log(`${name},${accountStats.documentsCreated},${accountStats.documentEdits},${accountStats.documentsRead},${accountStats.timeSpentInReader}`);
}

const doIt = async () => {
    const config = BindersConfig.get();
    const trackingService = await BackendTrackingServiceClient.fromConfig(config, "dump-global-stats");
    const globalStats = await trackingService.globalUsage();
    const accountService = await BackendAccountServiceClient.fromConfig(config, "dump-global-stats");
    printHeader();
    for (const accountStats of globalStats.accounts) {
        const accountName = await getAccountName(accountStats.accountId, accountService);
        printRow(accountName, accountStats);
    }
}

doIt().then(
    () => {
        console.log("All done!");
        process.exit(0);
    },
    err => {
        console.error(err);
        process.exit(1);
    }
)