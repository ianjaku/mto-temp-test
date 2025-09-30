import {
    APICreateCollectionInCollection,
    APILoadItems,
    APILoadItemsAncestors,
} from  "./api";
import {
    DocumentAncestors,
    DocumentCollection,
    EditorItem
} from  "@binders/client/lib/clients/repositoryservice/v3/contract";
import { EditorEvent, captureFrontendEvent } from "@binders/client/lib/thirdparty/tracking/capture";
import AccountStore from "../accounts/store";
import { DEFAULT_COVER_IMAGE } from "@binders/client/lib/binders/defaults";
import { KEY_FOUND_ITEMS_ANCESTORS } from "./store";
import Thumbnail from "@binders/client/lib/clients/repositoryservice/v3/Thumbnail";
import { buildParentPath } from "./actions";
import { dispatch } from "@binders/client/lib/react/flux/dispatcher";


export interface AncestorsInfo {
    ancestors: DocumentAncestors,
    items: EditorItem[],
}

export interface AncestorWithParentPath {
    parentPaths: EditorItem[],
    item: EditorItem;
}

export async function buildAncestorsPromise(docIds: string[]): Promise<AncestorsInfo> {
    const loadItemAncestorsPromise = APILoadItemsAncestors(docIds);
    const ancestors = await loadItemAncestorsPromise;
    const itemsToLoad = Object.keys(ancestors)
    const accountId = AccountStore.getActiveAccountId();
    const loadItemsPromise = APILoadItems(itemsToLoad, accountId);
    const ancestorsItems = await loadItemsPromise;
    dispatch({
        type: KEY_FOUND_ITEMS_ANCESTORS,
        body: {
            ancestors,
            ancestorsItems,
        }
    });
    return Promise.all([loadItemAncestorsPromise, loadItemsPromise])
        .then(([ancestors, items]) => ({ ancestors, items }));
}

export function getDirectParentsWithPaths(
    itemId: string,
    ancestors: DocumentAncestors,
    items: EditorItem[],
    accountId: string,
): AncestorWithParentPath[] {
    const directParents = ancestors[itemId]

    const isRootCollection = !directParents || directParents.length === 0;
    if (isRootCollection) {
        const item = items.find(i => i.id === itemId);
        return [{ parentPaths: [item], item }];
    }

    const directParentItems = items.filter(item => directParents.indexOf(item.id) !== -1);
    const ancestorsWithParentPaths = directParentItems.map(collection => {
        return {
            parentPaths: buildParentPath(collection.id, ancestors, items),
            item: collection
        };
    });

    return accountId ?
        ancestorsWithParentPaths.filter(a => a.item.accountId === accountId) :
        ancestorsWithParentPaths;
}


export function getDirectParentWithPaths(
    itemId: string,
    ancestors: DocumentAncestors,
    items: EditorItem[],
    accountId: string,
): AncestorWithParentPath {
    return getDirectParentsWithPaths(itemId, ancestors, items, accountId).at(0)
}


export async function buildParentItems(
    itemId: string,
    ancestorsPromise: Promise<AncestorsInfo>,
): Promise<EditorItem[]> {
    if (ancestorsPromise == null) {
        return;
    }
    const accountId = AccountStore.getActiveAccountId();
    const { ancestors, items } = await ancestorsPromise;
    const { parentPaths } = getDirectParentWithPaths(itemId, ancestors, items, accountId) || {};
    return parentPaths;
}

export const createCollection = async (
    accountId: string,
    name: string,
    language: string,
    parentCollectionId: string,
): Promise<DocumentCollection> => {
    const thumbnail = { medium: DEFAULT_COVER_IMAGE, fitBehaviour: "fit", bgColor: "transparent" };
    const collection = await APICreateCollectionInCollection(
        accountId,
        parentCollectionId,
        name,
        language,
        thumbnail as Thumbnail,
    );
    captureFrontendEvent(EditorEvent.CollectionCreated);
    return collection;
};
