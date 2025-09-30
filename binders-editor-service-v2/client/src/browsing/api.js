import AccountStore from "../accounts/store";
import { BinderRepositoryServiceClient } from "@binders/client/lib/clients/repositoryservice/v3/client";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config";

const repositoryClient = BinderRepositoryServiceClient.fromConfig(
    config,
    "v3", 
    browserRequestHandler,
    AccountStore.getActiveAccountId.bind(AccountStore),
);


export const APISetPublicationsShowInOverview = (binderId, showInOverview) => {
    return repositoryClient.setPublicationsShowInOverview(
        binderId,
        showInOverview,
    );
}

export const APISetCollectionIsHidden = (collectionId, isHidden) => {
    return repositoryClient.updateCollectionIsHidden(
        collectionId,
        isHidden,
    );
}

export const APISetCollectionShowInOverview = (collectionId, showInOverview) => {
    return repositoryClient.updateCollectionShowInOverview(
        collectionId,
        showInOverview,
    );
}

export const APIGetAncestors = (itemId) => repositoryClient.getAncestors(itemId);

export const APIGetCollectionInfo = async collectionId => {
    return repositoryClient.getCollectionInfo(collectionId)
};

export const APIGetChildCollectionSummaries = async (collectionIds, accountId) => {
    return repositoryClient.getChildCollectionSummaries(collectionIds, accountId);
};

export function APIGetChecklistsProgress(binderIds) {
    return repositoryClient.getChecklistsProgress(binderIds);
}