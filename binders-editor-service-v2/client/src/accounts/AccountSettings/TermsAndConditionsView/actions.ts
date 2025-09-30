import { ITermsInfo } from "@binders/client/lib/clients/userservice/v1/contract";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config";

const client = UserServiceClient.fromConfig(config, "v1", browserRequestHandler);

export async function getTermsInfo(accountId: string): Promise<ITermsInfo> {
    return client.getTermsInfo(accountId);
}