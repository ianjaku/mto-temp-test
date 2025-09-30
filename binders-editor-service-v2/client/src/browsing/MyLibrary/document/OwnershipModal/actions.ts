import {
    DetailedItemOwnership,
    ItemOwnership
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import AccountStore from "../../../../accounts/store";
import {
    BinderRepositoryServiceClient
} from "@binders/client/lib/clients/repositoryservice/v3/client";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config";

const client = BinderRepositoryServiceClient.fromConfig(
    config,
    "v3",
    browserRequestHandler,
    AccountStore.getActiveAccountId.bind(AccountStore),
);

export async function APIGetOwnershipForItems(itemIds: string[], accountId: string): Promise<DetailedItemOwnership[]> {
    if (itemIds.length === 0) {
        return [];
    }
    return client.getOwnershipForItems(itemIds, accountId);
}

export async function APISetOwnershipForItem(itemId: string, ownership: ItemOwnership, accountId: string): Promise<void> {
    await client.setOwnershipForItem(itemId, ownership, accountId);
}