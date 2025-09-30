import { PublicApiServiceClient } from "@binders/client/lib/clients/publicapiservice/v1/client";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config";

const client = PublicApiServiceClient.fromConfig(config, "v1", browserRequestHandler);

export const ApiGeneratePublicApiToken = (accountId: string): Promise<string> => {
    return client.generateApiToken(accountId);
}

export const ApiGetPublicApiToken = (accountId: string): Promise<string> => {
    return client.getApiToken(accountId);
}
