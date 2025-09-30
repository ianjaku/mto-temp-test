import { CreateMSAccountSetupRequestParams, ResolveMSPurchaseIdTokenResponse } from "@binders/client/lib/clients/accountservice/v1/contract";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import config from "./config";

const accountClient = AccountServiceClient.fromConfig(config, "v1", browserRequestHandler);

export function APIResolveMSPurchaseIdToken(
    purchaseIdToken: string
): Promise<ResolveMSPurchaseIdTokenResponse> {
    return accountClient.resolveMSPurchaseIdToken(purchaseIdToken);
}

export function APICreateMSSetupRequest(
    createParams: CreateMSAccountSetupRequestParams
): Promise<void> {
    return accountClient.createMSTransactableSetupRequest(createParams);
}
