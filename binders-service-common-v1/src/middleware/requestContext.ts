import {
    AccountFeatures,
    AccountServiceContract,
    IAccountSettings
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { RequestContext, getRequestContext } from "./asyncLocalStorage";
import { RoutingServiceContract } from "@binders/client/lib/clients/routingservice/v1/contract";

async function getFromContext<T extends keyof RequestContext>(key: T, fetch: () => Promise<RequestContext[T]>) {
    const context = getRequestContext();
    if (!context) {
        return fetch();
    }
    if (!context[key]) {
        context[key] = await fetch();
    }
    return context[key];
}

export async function getAccountIdFromRequestContext(
    domain: string,
    routingServiceClient: RoutingServiceContract
): Promise<string> {
    const fetch = async () => {
        const [accountId] = await routingServiceClient.getAccountIdsForDomain(domain) || [];
        if (!accountId) {
            throw new Error(`Could not resolve domain ${domain} to an account`);
        }
        return accountId;
    }
    return getFromContext("accountId", fetch);
}

export async function getAccountFeaturesFromRequestContext(
    accountId: string,
    accountServiceClient: AccountServiceContract
): Promise<AccountFeatures> {
    return getFromContext(
        "accountFeatures",
        () => accountServiceClient.getAccountFeatures(accountId) as Promise<unknown> as Promise<AccountFeatures>,
    );
}

export async function getAccountSettingsFromRequestContext(
    accountId: string,
    accountServiceClient: AccountServiceContract
): Promise<IAccountSettings> {
    return getFromContext(
        "accountSettings",
        () => accountServiceClient.getAccountSettings(accountId)
    );
}