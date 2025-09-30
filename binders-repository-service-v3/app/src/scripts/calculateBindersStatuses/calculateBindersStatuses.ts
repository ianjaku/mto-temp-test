/* eslint-disable no-console */
import {
    Account,
    AccountServiceContract,
    FEATURE_PUBLIC_API
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    BackendAccountServiceClient,
    BackendRepoServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import {
    BindersRepositoryServiceContract
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";

const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config);

type Resources = {
    accountServiceClient: AccountServiceContract;
    repoServiceClient: BindersRepositoryServiceContract;
}

const SCRIPT_NAME = "calculateBindersStatuses";

async function getAccountsToCalculate(repos: Resources): Promise<Account[]> {
    const featuresByAccount = await repos.accountServiceClient.getAllFeaturesByAccount();
    const accountIds = [];
    for( const { accountId, features } of featuresByAccount) {
        if (features.includes(FEATURE_PUBLIC_API)) {
            accountIds.push(accountId);
        }
    }
    const accounts = await repos.accountServiceClient.findAccountsForIds(accountIds);
    const now = Date.now();
    return accounts.filter( account => {
        const readerExpirationDate = new Date(account.readerExpirationDate);
        const editorExpirationDate = new Date(account.expirationDate);
        return readerExpirationDate.getTime() > now || editorExpirationDate.getTime() > now;
    });
}

async function getResources(): Promise<Resources> {
    const config = BindersConfig.get();
    const accountServiceClient = await BackendAccountServiceClient.fromConfig(config, SCRIPT_NAME);
    const repoServiceClient = await BackendRepoServiceClient.fromConfig(config, SCRIPT_NAME);
    return { accountServiceClient, repoServiceClient };
}

export async function calculateBindersStatuses(): Promise<void> {
    const resources = await getResources();
    const accounts = await getAccountsToCalculate(resources);
    for (const account of accounts) {
        try {
            logger.info(`calculating status for account ${account.name}...`, SCRIPT_NAME);
            const statuses = await resources.repoServiceClient.calculateBindersStatuses(account.id);
            logger.info(`${statuses.length} statuses cached`, SCRIPT_NAME);
        } catch (e) {
            logger.error(`Error calculating status for account ${account.name}: ${e}`, SCRIPT_NAME);
        }
    }
}
