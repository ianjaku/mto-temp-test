import { AccountStoreGetters } from "../stores/zustand/account-store";
import {
    BinderRepositoryServiceClient
} from "@binders/client/lib/clients/repositoryservice/v3/client";
import { DetailedItemOwnership } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config";

const client = BinderRepositoryServiceClient.fromConfig(
    config,
    "v3",
    browserRequestHandler,
    AccountStoreGetters.getActiveAccountId,
);

export async function APIGetOwnershipForItem(itemId: string, accountId: string, expandGroups?: boolean): Promise<DetailedItemOwnership | null> {
    const result = await client.getOwnershipForItems([itemId], accountId, expandGroups);
    return result?.[0] ?? null;
}
