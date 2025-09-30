import {
    IncludePublicPolicy,
    PermissionMap,
    PermissionName,
    ResourceType
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { AccountStoreGetters } from "../stores/zustand/account-store";
import {
    AuthorizationServiceClient
} from "@binders/client/lib/clients/authorizationservice/v1/client";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config";

const client = AuthorizationServiceClient.fromConfig(
    config,
    "v1",
    browserRequestHandler,
    AccountStoreGetters.getActiveAccountId,
);

export const getAllReadableItems = async (
    accountIds: string[],
    excludePublicNonAdvertized = false
): Promise<string[]> => {
    if (!accountIds || accountIds.length === 0) {
        return [];
    }
    const allResourceGroups = await getAllReadableItemsPermissions(accountIds, excludePublicNonAdvertized)
    return extractItemsFromResourceGroups(allResourceGroups);
};

export const getAllReadableItemsPermissions = async (
    accountIds: string[],
    excludePublicNonAdvertized = false,
): Promise<PermissionMap[]> => {
    if (!accountIds || accountIds.length === 0) {
        return [];
    }
    const includePublic = excludePublicNonAdvertized ?
        IncludePublicPolicy.INCLUDE_EXCEPT_ADVERTIZED :
        IncludePublicPolicy.INCLUDE;
    const allResourceGroups = await client.findMyResourceGroups(accountIds, ResourceType.DOCUMENT, [PermissionName.VIEW], { includePublic });
    return allResourceGroups;
};

export const getDocumentsICanEdit = async (accountIds: string[]): Promise<string[]> => {
    if (!accountIds || accountIds.length === 0) {
        return [];
    }
    const allResourceGroups = await client.findMyResourceGroups(accountIds, ResourceType.DOCUMENT, [PermissionName.EDIT], {});
    return extractItemsFromResourceGroups(allResourceGroups);
};

export const extractItemsFromResourceGroups = (resourceGroups: PermissionMap[]): string[] => (
    resourceGroups.reduce((items, resourceGroup) => {
        items.push(...resourceGroup.resources.reduce((resourceItems, resource) => resourceItems.concat(resource.ids), []));
        return items;
    }, [])
);

export function APIHasAvailableEditorAccount(accountIds: string[], userId: string): Promise<boolean> {
    return client.hasAvailableEditorAccount(accountIds, userId);
}

export async function APIContainsPublicAcl(documentIds: string[], accountId: string): Promise<boolean> {
    return client.containsPublicAcl(accountId, documentIds);
}
