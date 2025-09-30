import { AccountStoreGetters } from "../../stores/zustand/account-store";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config";

const client = UserServiceClient.fromConfig(
    config,
    "v1",
    browserRequestHandler,
    AccountStoreGetters.getActiveAccountId,
);

export async function APISaveTermsAcceptance(userId: string, accountId: string, version: string): Promise<void> {
    await client.saveTermsAcceptance(userId, accountId, version);
}
