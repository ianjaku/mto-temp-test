/* eslint-disable no-console */
import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import {
    BackendAccountServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";

const SCRIPT_NAME = "expireAccounts.js";
const config = BindersConfig.get();

const getClients = async () => {
    const [ accountClient ] = await Promise.all([
        BackendAccountServiceClient.fromConfig(config, SCRIPT_NAME),
    ]);
    return {
        accountClient,
    }
};

const EXCEPTIONS = new Set([
    "aid-1ce54600-a143-4500-a3f4-1326d5b3ad1d", // Demo
    "aid-caa8c8f3-0300-490e-ae0d-520befb5aca8", // Internal
    "aid-d38e6061-4539-488d-8bf3-204c3968f4ff", // help.manual.to
    "aid-0335fe08-7f58-4f61-97c6-02dd6586da18", // test.manual.to
]);
const EXPIRATION_DATE = new Date(2000, 1, 1).toJSON();

const expireAccount = async (account: Account, accountClient: AccountServiceClient): Promise<void> => {
    await accountClient.update(
        account.id,
        account.name,
        account.subscriptionType,
        EXPIRATION_DATE,
        EXPIRATION_DATE,
        account.maxNumberOfLicenses,
        account.maxPublicCount);
}

const doIt = async () => {
    const { accountClient } = await getClients();
    const accounts = await accountClient.listAccounts();
    for (const account of accounts) {
        if (EXCEPTIONS.has(account.id)) {
            continue;
        }
        if (!account.accountIsNotExpired) {
            continue;
        }
        if (account.members.length === 0) {
            console.log(`Expiring account ${account.id} - Reason: empty`)
            await expireAccount(account, accountClient);
        }
    }
};

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
