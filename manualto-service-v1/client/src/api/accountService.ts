import { IAccountSettings, IPublicAccountSettings } from "@binders/client/lib/clients/accountservice/v1/contract";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config";

const accountClient = AccountServiceClient.fromConfig(config, "v1", browserRequestHandler);

export const APIGetAccountFeatures = (accountId: string): Promise<string[]> =>
    accountClient.getAccountFeatures(accountId);

export function APIGetAccountSettings(accountId: string): Promise<IAccountSettings> {
    return accountClient.getAccountSettings(accountId);
}

export function APIGetPublicAccountSettings(accountId: string): Promise<IPublicAccountSettings> {
    return accountClient.getPublicAccountSettings(accountId);
}
