/* eslint-disable no-console */
import {
    Account,
    FEATURE_MANUALTO_USER_MANAGEMENT_VIA_ENTRA_ID_GROUP
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    BackendAccountServiceClient,
    BackendUserServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Command } from "commander";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";

const SCRIPT_NAME = "sync-entra-group-members-job";

const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config, "sync-entra-group-members");

type ScriptOptions = {
    debug?: boolean;
    dryRun?: boolean;
};

const program = new Command();

program
    .name("syncEntraGroupMembersJob")
    .description("For each account configured with a source-of-truth Entra ID group, run a synchronization with the users of that account")
    .option("-d, --debug", "Debug mode")
    .option("-r --dry-run [dryRun]", "Dry run mode (will not make any changes)")

program.parse(process.argv);
const options = program.opts() as ScriptOptions;

type Deps = {
    accountServiceClient: AccountServiceClient;
    userServiceClient: UserServiceClient;
}

async function getDeps(): Promise<Deps> {
    const accountServiceClient = await BackendAccountServiceClient.fromConfig(config, SCRIPT_NAME);
    const userServiceClient = await BackendUserServiceClient.fromConfig(config, SCRIPT_NAME);
    return {
        accountServiceClient,
        userServiceClient,
    }
}

async function fetchAccountsWithFeature(deps: Deps): Promise<Account[]> {
    return await deps.accountServiceClient.getAccountsByFeatures([FEATURE_MANUALTO_USER_MANAGEMENT_VIA_ENTRA_ID_GROUP]);
}

async function main() {
    const deps = await getDeps();
    const accounts = await fetchAccountsWithFeature(deps);
    console.log(`Found ${accounts.length} accounts with feature`);
    let failed = false;
    for (const account of accounts) {
        logger.info(`Starting sync for account ${account.name} (id ${account.id})`, "script");
        try {
            await deps.userServiceClient.syncEntraGroupMembers(account.id, { dryRun: options.dryRun });
            logger.info(`Sync finished for account ${account.name} (id ${account.id})`, "script");
        } catch (err) {
            failed = true;
            logger.error(`Failed to sync account ${account.name} (id ${account.id})`, "script", err.stack);
        }
    }
    return failed;
}

main()
    .then((failed: boolean) => {
        logger.info("Done", "script");
        process.exit(failed ? 1 : 0);
    })
    .catch((err) => {
        logger.error(err.message, "", err.stack);
        process.exit(1);
    });
