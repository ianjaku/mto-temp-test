import {
    APIGetAncestors,
    APIGetChecklistsProgress,
    APIGetChildCollectionSummaries,
    APIGetCollectionInfo,
    APISetCollectionShowInOverview,
    APISetPublicationsShowInOverview
} from "./api";
import {
    APILoadCollection,
    APILoadItems,
    APILoadPublications,
    ActivePublicationsOption
} from "../documents/api";
import {
    AssigneeType,
    PermissionMap,
    PermissionName,
    ResourceType
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import {
    DocumentAncestors,
    DocumentCollection
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { WebData, WebDataState } from "@binders/client/lib/webdata";
import { APIDocumentAcls } from "../authorization/api";
import { APIFindSemanticLinks } from "../accounts/api";
import AccountStore from "../accounts/store";
import { BrowseInfo } from "./MyLibrary/routes";
import { List } from "immutable";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { buildResourcePermissionMap } from "./util";
import { getItemIdsFromPermissionMap } from "../authorization/helper";
import { getLastEditInfo } from "@binders/client/lib/binders/create";
import i18next from "@binders/client/lib/react/i18n";
import { useBrowseStore } from "../stores/browse-store";

export function trimPathToAllowedWithInfo(idPath: string[], permissions: PermissionMap[], isReadOnlyReaderOn: boolean): DocumentCollection[] {
    const colsWithEditPermissions = getItemIdsFromPermissionMap(permissions, [PermissionName.ADMIN, PermissionName.EDIT]);
    const colsWithReadPermissions = getItemIdsFromPermissionMap(permissions, [PermissionName.VIEW]);
    const { path } = idPath.reduce((reduced, id) => {
        const { path, readOnlyMode, editMode } = reduced;
        if (editMode || (isReadOnlyReaderOn ? colsWithReadPermissions : colsWithEditPermissions).indexOf(id) > -1) {
            path.push({
                id
            });
            return { path, readOnlyMode, editMode: true };
        }
        if (readOnlyMode || colsWithReadPermissions.indexOf(id) > -1) {
            path.push({
                id,
                readonly: true,
            });
            return { path, readOnlyMode: true, editMode };
        }
        return {
            path,
            readOnlyMode,
            editMode
        };
    }, { path: [], readOnlyMode: false, editMode: false });
    return path;
}

export async function loadBrowseContext(
    browseInfo: BrowseInfo,
    shouldFeedWithRealData = false,
    permissions?: PermissionMap[],
    isReadOnlyReaderOn = false,
): Promise<void> {
    const { parentCollections, currentCollection, currentDocument } = browseInfo;
    const { setActiveBrowsePath, setBrowsePaths } = useBrowseStore.getState();
    const currentActiveBrowsePath = useBrowseStore.getState().activeBrowsePath;
    const currentBrowsePaths = useBrowseStore.getState().browsePaths;

    if (!currentCollection && !currentDocument) {
        setActiveBrowsePath(new WebData(
            WebDataState.SUCCESS,
            [],
            currentActiveBrowsePath.uid,
        ));
        setBrowsePaths(new WebData(
            WebDataState.SUCCESS,
            [[]],
            currentBrowsePaths.uid,
        ));
        return;
    }
    if (!shouldFeedWithRealData) {
        loadBrowsePaths([[]], []);
        return
    }
    const activeItemId = currentDocument || currentCollection;
    const idPaths = await composePaths(activeItemId);
    const allowedIdPathsWithInfo = permissions ? idPaths.map(idPath => trimPathToAllowedWithInfo(idPath, permissions, isReadOnlyReaderOn)) : [];
    const usedItemIds = allowedIdPathsWithInfo.reduce((reduced, idPathWithInfo) => {
        idPathWithInfo.forEach(idWithInfo => {
            const { id } = idWithInfo;
            if (reduced.indexOf(id) === -1) {
                reduced.push(id);
            }
        });
        return reduced;
    }, [...(currentDocument ? [currentDocument] : [])]);

    const activeBrowseIdPath = [
        ...(parentCollections || []),
        ...(currentCollection ? [currentCollection] : []),
        ...(currentDocument ? [currentDocument] : []),
    ];
    const allowedActiveBrowseIdPath = trimPathToAllowedWithInfo(activeBrowseIdPath, permissions, isReadOnlyReaderOn);
    const accountId = AccountStore.getActiveAccountId();
    const usedItems = await APILoadItems(usedItemIds, accountId, undefined, { softDelete: { show: "show-all" } });
    const browsePaths = allowedIdPathsWithInfo.map(idPathWithInfo => idPathToItemPath(idPathWithInfo, usedItems));
    const activeBrowsePath = idPathToItemPath(allowedActiveBrowseIdPath, usedItems);
    loadBrowsePaths(browsePaths, activeBrowsePath);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function hasPublicAncestors(items, parentAcls?: any, accountId?: any) {
    if (!items || !items.length) {
        return false;
    }

    const parents = [...items].reverse();
    const parentIds = parents.map(p => p.id);
    const acls = parentAcls || await APIDocumentAcls(parentIds, accountId || items[0].accountId);
    for (let i = 0; i < parents.length; i++) {
        const permissionMap = buildResourcePermissionMap(ResourceType.DOCUMENT, parents[i].id, List(acls[parents[i].id]));
        const isPublic = permissionMap.permissions
            .filter(perm => !perm.ancestorResourceId || perm.ancestorResourceId === parents[i].id)
            .findIndex(perm => perm.assigneeType === AssigneeType.PUBLIC) > -1;
        if (isPublic) {
            return true;
        }
    }
    return false;
}

export const loadBindersAdditionalInfo = async (binders, parentItemsMap, accountId) => {
    const additionalInfo = binders.map(binder => ({ ...getLastEditInfo(binder), _id: binder.id }));
    getIsPublicInfo(parentItemsMap, accountId);

    const { setBindersAdditionalInfo } = useBrowseStore.getState();
    setBindersAdditionalInfo(additionalInfo);
}

export const patchBreadCrumbsBinder = (item) => {
    const { patchBinder } = useBrowseStore.getState();
    patchBinder(item);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function idPathToItemPath(idPathWithInfo: DocumentCollection[], usedItems: any): DocumentCollection[] {
    return idPathWithInfo.reduce((reduced, { id, readonly }) => {
        const item = usedItems.find(i => i.id === id) || id;
        if (item) {
            if (item.id !== undefined) {
                item.readonly = readonly;
            }
            reduced.push(item);
        }
        return reduced;
    }, []);
}

const composePaths = async (itemId) => {
    const ancestors = await APIGetAncestors(itemId);
    const composedPaths = populatePaths(
        [
            {
                pathArray: [itemId],
                finished: false
            }
        ],
        ancestors);
    return composedPaths.map(path => path.pathArray.reverse());
}

function populatePaths(paths: { pathArray: string[], finished: boolean }[], ancestors: DocumentAncestors) {
    const unfinishedPaths = paths.filter(p => !p.finished);
    if (unfinishedPaths.length === 0) {
        return paths;
    }
    unfinishedPaths.forEach(path => {
        const itemId = path.pathArray[path.pathArray.length - 1];
        const parents = ancestors[itemId];
        switch (parents.length) {
            case 0:
                path.finished = true;
                break;
            case 1:
                path.pathArray.push(parents[0]);
                break;
            default:
                paths = paths.filter(p => p.pathArray !== path.pathArray);
                parents.forEach(parent => {
                    paths.push({
                        pathArray: path.pathArray.concat(parent),
                        finished: false
                    })
                });
        }
    });
    return populatePaths(paths, ancestors);
}

export function loadBrowsePaths(browsePaths: DocumentCollection[][], activeBrowsePath: DocumentCollection[]) {
    const { setBrowsePaths, setActiveBrowsePath, updateWebDataState } = useBrowseStore.getState();
    const currentBrowsePaths = useBrowseStore.getState().browsePaths;
    const currentActiveBrowsePath = useBrowseStore.getState().activeBrowsePath;

    if (!activeBrowsePath || activeBrowsePath.length === 0) {
        activeBrowsePath = browsePaths[0] || [];
    }

    // Simulate wrapAction behavior - set to pending then success/failure
    updateWebDataState("browsePaths", (webData) =>
        webData.pending(webData.uid)
    );
    updateWebDataState("activeBrowsePath", (webData) =>
        webData.pending(webData.uid)
    );

    try {
        setBrowsePaths(new WebData(
            WebDataState.SUCCESS,
            browsePaths,
            currentBrowsePaths.uid
        ));
        setActiveBrowsePath(new WebData(
            WebDataState.SUCCESS,
            activeBrowsePath,
            currentActiveBrowsePath.uid
        ));
    } catch (error) {
        setBrowsePaths(
            currentBrowsePaths.fail(
                new Error(i18next.t(TK.DocManagement_CantLoadBrowsePathsError)),
                currentBrowsePaths.uid
            )
        );
        setActiveBrowsePath(
            currentActiveBrowsePath.fail(
                new Error(i18next.t(TK.DocManagement_CantLoadActiveBrowsePathError)),
                currentActiveBrowsePath.uid
            )
        )
    }
}

export const loadCollection = collectionId => {
    return APILoadCollection(collectionId);
};

export const findSemanticLinks = async id => {
    return APIFindSemanticLinks(id);
};

export const patchBreadCrumbs = (id, languageCode, newValue) => {
    const { patchTitle } = useBrowseStore.getState();
    patchTitle(id, languageCode, newValue);
}


export const setTestMode = () => {
    const { setTestMode: setTest } = useBrowseStore.getState();
    setTest();
}

export const loadPublications = (binderId, onlyActive = true) => {
    const activePublicationsOption = onlyActive ?
        ActivePublicationsOption.OnlyActive :
        ActivePublicationsOption.All;
    return APILoadPublications(binderId, activePublicationsOption);
};

export async function loadDocumentAcls(documentId, accountId) {
    const acls = await APIDocumentAcls([documentId], accountId);
    return buildResourcePermissionMap(ResourceType.DOCUMENT, documentId, List(acls[documentId]));
}

export const setBinderShowInOverview = async (binder, showInOverview) => {
    await APISetPublicationsShowInOverview(binder.id, showInOverview);
};

export async function setCollectionShowInOverview(collectionId, showInOverview) {
    return await APISetCollectionShowInOverview(collectionId, showInOverview);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setIsPublicForId(id, isPublicValue, hasPublicAncestors?: any, parentId?: any) {
    const { updateIsPublicInfo } = useBrowseStore.getState();
    updateIsPublicInfo(id, isPublicValue, hasPublicAncestors, parentId);
}

function buildIsPublicMap(map, permissions, itemId, hasPublicAncestors, parentId) {
    const isPublic = permissions[itemId].permissions
        .filter(perm => !perm.ancestorResourceId || perm.ancestorResourceId === itemId)
        .findIndex(perm => perm.assigneeType === AssigneeType.PUBLIC) > -1;

    return {
        ...map,
        [itemId]: {
            isPublic,
            hasPublicAncestors: isPublic ? false : hasPublicAncestors,
            parentId,
        }
    }
}

export function setIsPublic(permissionMap, hasPublicAncestors, parentId) {
    const isPublicMap = Object.keys(permissionMap).reduce((result, id) => {
        return buildIsPublicMap(result, permissionMap, id, hasPublicAncestors, parentId);
    }, {});

    const { setDocumentsIsPublicInfo } = useBrowseStore.getState();
    setDocumentsIsPublicInfo(isPublicMap);
}

export function getParentId(parentItems) {
    const parents = [...parentItems].reverse();
    return parents.length > 0 ? parents[0].id : undefined;
}


// Calculate public info for search results using only one call to the server.
//
// item: { id: string; parentItemsIds: string[] }
// items: item[]
export async function getIsPublicInfo(items, accountId) {
    if (!items || items.length === 0) {
        return;
    }

    const allItemIds = new Set<string>();
    for (const item of items) {
        allItemIds.add(item.id);
        const itemParentIds = [...item.parentItemsIds].reverse();
        for (const parentId of itemParentIds) {
            allItemIds.add(parentId);
        }
    }

    const allAcls = await APIDocumentAcls(Array.from(allItemIds), accountId);
    const itemIds = items.map(item => item.id);
    const permissions = itemIds.reduce((result, id) => ({
        ...result,
        [id]: buildResourcePermissionMap(ResourceType.DOCUMENT, id, List(allAcls[id])),
    }), {});

    let isPublicMap = {};
    for (const itemId of itemIds) {
        const parentItems = items.find(item => item.id === itemId).parentItemsIds;
        const parentAcls = [...parentItems].reverse().reduce((result, parentItem) => ({
            ...result,
            [parentItem]: allAcls[parentItem],
        }), {});

        const parentItemsIds = parentItems.map(id => ({ id }));
        const publicAncestorsFound = await hasPublicAncestors(parentItemsIds, parentAcls, accountId);
        const parentId = getParentId(parentItemsIds);

        isPublicMap = buildIsPublicMap(isPublicMap, permissions, itemId, publicAncestorsFound, parentId);
    }

    const { setDocumentsIsPublicInfo } = useBrowseStore.getState();
    setDocumentsIsPublicInfo(isPublicMap);
}

// item: { id: string; parentItemsIds: string[] }
// itemsParentsMap: item[]
export async function loadCollectionInfo(collectionId, itemsParentsMap) {
    const collectionInfo = await APIGetCollectionInfo(collectionId);
    const accountId = AccountStore.getActiveAccountId();

    getIsPublicInfo(itemsParentsMap, accountId);

    const { setCollectionInfo } = useBrowseStore.getState();
    setCollectionInfo(collectionInfo);
}

export async function loadAdditionalInfoForCollections(collectionIds, parentItemsMap, accountId) {
    getIsPublicInfo(parentItemsMap, accountId);
    const childCollectionSummariesAPI = await APIGetChildCollectionSummaries(collectionIds, accountId);
    const childCollectionSummaries = {};
    for (const childCollectionSummaryAPI of childCollectionSummariesAPI) {
        childCollectionSummaries[childCollectionSummaryAPI.collectionId] = childCollectionSummaryAPI;
    }
    const collectionInfo = {
        childCollectionSummaries,
    }
    const { setCollectionInfo } = useBrowseStore.getState();
    setCollectionInfo(collectionInfo);
}

export async function loadChecklistProgresses(binderIds) {
    const progresses = await APIGetChecklistsProgress(binderIds);
    const { setChecklistProgresses } = useBrowseStore.getState();
    setChecklistProgresses(progresses);
}
