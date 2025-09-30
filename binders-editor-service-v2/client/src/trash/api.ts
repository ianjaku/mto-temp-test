import { Binder, DocumentCollection, SoftDeletedItemsFilter } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import AccountStore from "../accounts/store";
import { AncestorItem } from "@binders/client/lib/ancestors";
import { BinderRepositoryServiceClient } from "@binders/client/lib/clients/repositoryservice/v3/client";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config";

export interface IDeletedItems {
    items: Array<Binder | DocumentCollection>,
    parentMap: { [keys: string]: AncestorItem[] }
    users: Array<User>
}

const client = BinderRepositoryServiceClient.fromConfig(
    config,
    "v3",
    browserRequestHandler,
    AccountStore.getActiveAccountId.bind(AccountStore),
);

export const APILoadDeletedItems = async (
    accountId: string,
    filter: SoftDeletedItemsFilter,
    cdnify: boolean,
    maxResults = 250
): Promise<IDeletedItems> => {
    const options= {
        binderSearchResultOptions: {
            scopeCollectionId: filter.scopeCollectionId,
            orderBy: "deletionTime",
            ascending: false,
            maxResults,
        },
        cdnify
    }
    const results = await client.getSoftDeletedItems(accountId, options, filter);

    return {
        items: results.items,
        parentMap: results.parents,
        users: results.users,
    };
}


export const APIRestoreItem = (itemId: string, accountId: string, parentCollectionId: string) : Promise<void>  => {
    return client.recoverDeletedItem(itemId, accountId, parentCollectionId);
}