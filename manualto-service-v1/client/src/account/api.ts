import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config";

const accountClient = AccountServiceClient.fromConfig(config, "v1", browserRequestHandler);

export const fetchLaunchDarklyFlags = (accountId: string) => {
    return accountClient.getLaunchDarklyFlagsForFrontend(accountId);
}
