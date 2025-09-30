import { Binder, DocumentCollection } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { APILoadItems } from "../documents/api";
import { AncestorItem } from "@binders/client/lib/ancestors";
import { IParentItemsMap } from "./store";
import { PermissionMap } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { buildAncestorsObject } from "@binders/client/lib/ancestors";
import { reverse } from "ramda";
import { trimPathToAllowedWithInfo } from "../browsing/actions";

export async function fetchAndBuildParentItemsMap(
    items: (Binder | DocumentCollection)[],
    parentMap: {[key: string]: AncestorItem[]},
    accountId: string,
    permissions: PermissionMap[],
    isReadonlyEditorOn?: boolean,
): Promise<IParentItemsMap> {
    const parentMapIds = Object.keys(parentMap)
    const parentItemsObjects = await APILoadItems(
        parentMapIds,
        accountId,
        {},
        { softDelete: { show: "show-all" } }
    );
    return buildParentItemsMap(
        items,
        parentMap,
        parentItemsObjects,
        permissions,
        isReadonlyEditorOn,
    );
}

export function buildParentItemsMap(
    // deletedItems: IDeletedItems,
    items: (Binder | DocumentCollection)[],
    parentMap: { [key: string]: AncestorItem[] },
    parentItems: (Binder | DocumentCollection)[],
    permissions: PermissionMap[],
    isReadonlyEditorOn?: boolean,
): IParentItemsMap {
    const onlyIdsForAncestors = Object.keys(parentMap).reduce((prev, i) => {
        prev[i] = parentMap[i].map(({ id }) => id);
        return prev;
    }, {})
    const ancestors = buildAncestorsObject(items.map(({ id }) => id), onlyIdsForAncestors);
    return Object.keys(ancestors).reduce((acc, k) => {
        const parentIds = ancestors[k];
        // this is case when readonly editor feature is off
        // we will receive items with read rights only - marked as readonly
        const editablePathsWithInfo = permissions ? [reverse(parentIds)].map(idPath => trimPathToAllowedWithInfo(idPath, permissions, false)) : [];
        let viewablePathsWithInfo = editablePathsWithInfo;
        if(isReadonlyEditorOn) {
            // but when readonly editor is on - we wont receive readonly marks because
            // we consider them as viewable in editor app for this account
            viewablePathsWithInfo = permissions ? [reverse(parentIds)].map(idPath => trimPathToAllowedWithInfo(idPath, permissions, true)) : [];
        }
        const readonlyParentsIdsFromEditable = editablePathsWithInfo[0].filter((itm => itm.readonly)).map(({id}) => id);
        const readonlyParentsIdsFromViewable = viewablePathsWithInfo[0].filter((itm => itm.readonly)).map(({id}) => id);

        const parentItemsWithInfo = parentItems.map(parentItem => {
            const patch  : {doNotPassToTreeNavigator?:boolean, readonly?: boolean} = {};
            if(readonlyParentsIdsFromEditable.includes(parentItem.id)) {
                // we want to mark items with only read access to
                // so we know not to pass it to tree navigator
                patch.doNotPassToTreeNavigator = true;
            }
            const array = isReadonlyEditorOn ? readonlyParentsIdsFromViewable : readonlyParentsIdsFromEditable;
            // and we also want to mark breadcrumbs as readonly
            // depending on the feature flag
            if(array.includes(parentItem.id)) {
                patch.readonly = true;
            }
            return {...parentItem, ...patch};
        } )
        const parentObjects = parentItemsWithInfo.filter(o => parentIds.includes(o.id))
        acc[k] = { ancestorsIds: parentIds, ancestorsObjects: parentObjects }
        return acc;
    }, {});
}

export function mergeListsById<T extends {id?: string}>(
    listA: T[],
    listB: T[]
): T[] {
    const result: {[id: string]: T} = {};
    listA.forEach(item => result[item.id] = item);
    listB.forEach(item => result[item.id] = item);
    return Object.values(result);
}

export function buildSingleCollectionParentItemsMap(
    collectionId: string,
    breadcrumbsData: DocumentCollection[]
): IParentItemsMap {
    const ancestorsObjects = breadcrumbsData.filter(itm => !!(itm.id) && itm.id !== collectionId).reverse();
    return {
        [collectionId]: {
            ancestorsIds: ancestorsObjects.map(obj => obj.id),
            ancestorsObjects,
        }
    }

}
