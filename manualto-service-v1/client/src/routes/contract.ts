import { DocumentAncestors } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { PermissionMap } from "@binders/client/lib/clients/authorizationservice/v1/contract";

export interface ParentPathContext {
    readableItems: string[];
    readableItemsPermissions: PermissionMap[];
    parentPathFromUri: boolean | string[];
    itemId: string;
    parentTitle: string;
    ancestors: DocumentAncestors;
    triggerParentCollectionActivate: boolean;
    ratingEnabled?: boolean; // rating is enabled on item-level feedback settings, anywhere within self or ancestors
    readConfirmationEnabled?: boolean; // read confirmation is enabled on item-level feedback settings, anywhere within self or ancestors
}
