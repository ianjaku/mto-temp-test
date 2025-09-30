import {
    ACTION_DELETE_ITEM,
    ACTION_PATCH_CHECKLIST_CONFIGS,
    ACTION_SET_BINDER_AUTHORS,
    ACTION_UPDATE_COLLECTION,
    ACTION_UPDATE_COLLECTION_IS_HIDDEN,
    ACTION_UPDATE_COLLECTION_TITLE,
    ACTION_UPDATE_EDITABLE_ITEM,
    ACTION_UPDATE_PARENT_COLLECTION_THUMBNAIL,
    ACTION_UPDATE_STATISTICS,
    KEY_CHECKLIST_CONFIGS,
    KEY_CHUNK_APPROVALS,
    KEY_COLLECTION_MOVE_ITEM,
    KEY_COLLECTION_REMOVE_ITEM,
    KEY_EDITABLE_DOCUMENTS,
    KEY_EDITABLE_DOCUMENTS_PREVIEWS,
    KEY_FOUND_DOCUMENTS,
    KEY_FOUND_ITEMS_ANCESTORS,
    KEY_FULL_ACTIVE_COLLECTION_ITEM,
    KEY_MOSTUSED_LANGUAGES,
    KEY_PATCH_PUBLICATIONS,
    KEY_PUBLISH_DONE,
    KEY_PUBLISH_IN_PROGRESS
} from "./store";
import {
    APIAddElementToCollection,
    APIApproveChunk,
    APIDeleteBinder,
    APIDeleteCollection,
    APIGetChecklistConfigs,
    APIGetChunkApprovalsForBinder,
    APIGetViewsStatistics,
    APILoadCollection,
    APILoadItems,
    APILoadItemsAncestors,
    APIMostUsedLanguages,
    APIMoveElementInCollection,
    APIPdfExport,
    APIPdfPreview,
    APIPublishBinder,
    APIRemoveCollectionThumbnail,
    APIRemoveCollectionTitle,
    APIRemoveElementFromCollection,
    APISaveChecklistActivation,
    APISaveCollectionTitle,
    APISearchBindersAndCollections,
    APIUnpublishBinder,
    APIUpdateChunkApprovals,
    APIUpdateCollectionThumbnail,
    APIUpdateLanguageOfCollectionTitle,
    APIUpdatePublicationsLanguages
} from "./api";
import {
    ApprovedStatus,
    Binder,
    ChunkApprovalFilter,
    DocumentAncestors,
    DocumentCollection,
    EditorItem,
    IChecklistConfig,
    IChunkApproval,
    IThumbnail
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    FEATURE_APPROVAL_FLOW,
    FEATURE_COMMENTING_IN_EDITOR,
    FEATURE_NOCDN,
    FEATURE_READONLY_EDITOR
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    ISemanticLink,
    SetSemanticLinkResult
} from "@binders/client/lib/clients/routingservice/v1/contract";
import { WebData, WebDataState } from "@binders/client/lib/webdata";
import { fluxWrap, getWebDataActionType } from "@binders/client/lib/webdata/flux";
import { loadPublications, patchBreadCrumbs } from "../browsing/actions";
import { APIMultiInsertUserAction } from "../analytics/api";
import { APISetCollectionIsHidden } from "../browsing/api";
import { APISetSemanticLink } from "../accounts/api";
import AccountStore from "../accounts/store";
import BinderClass from "@binders/client/lib/binders/custom/class";
import { FlashMessages } from "../logging/FlashMessages";
import { IPDFExportOptions } from "@binders/client/lib/clients/exportservice/v1/contract";
import { NothingToUnpublish } from "@binders/client/lib/clients/repositoryservice/v3/errors";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import Thumbnail from "@binders/client/lib/clients/repositoryservice/v3/Thumbnail";
import { UserActionType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { Visual as VisualClass } from "@binders/client/lib/clients/imageservice/v1/Visual";
import { activateAccountId } from "../accounts/actions";
import { buildAncestorsObject } from "@binders/client/lib/ancestors";
import { collectionOrDocumentToTrackingItemKind } from "../tracking/actions";
import { dispatch } from "@binders/client/lib/react/flux/dispatcher";
import { getCurrentUserId } from "../stores/my-details-store";
import i18next from "@binders/client/lib/react/i18n";
import { intersection } from "ramda";
import { invalidateBinderPublicationSummaries } from "./Composer/components/HistoryPane/hooks";
import { invalidateCommentThreads } from "./hooks";
import { isThisItemHidden } from "../shared/helper";
import { refreshSemanticLinks } from "./actions/loading";
import { useBrowseStore } from "../stores/browse-store";
import { visualToThumbnail } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { waitForPendingSave } from "./actions/publishing";
import { wrapAction } from "../shared/fluxwebdata";

export const searchForItems = async (query: string, accountId: string, scopeCollectionId: string): Promise<void> => {
    const toWrap = async () => {

        const accountFeaturesWD = AccountStore.getAccountFeatures();
        const cdnnify = !(accountFeaturesWD.result.includes(FEATURE_NOCDN));
        const isReadOnlyMode = accountFeaturesWD.result.includes(FEATURE_READONLY_EDITOR);

        const searchResult = await APISearchBindersAndCollections(query, accountId, cdnnify, isReadOnlyMode, { prioritizedScopeCollectionId: scopeCollectionId });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const itemIds = searchResult.hits.map((hit: any) => hit.binderSummary ? hit.binderSummary.id : hit.collection.id);
        let stats;
        try {
            stats = isReadOnlyMode ? [] : await APIGetViewsStatistics(itemIds, accountId);
        } catch (error) {
            stats = [];
        }
        return {
            totalHitCount: searchResult.totalHitCount,
            isTruncatedInScope: searchResult.isTruncatedInScope,
            isTruncatedOutsideScope: searchResult.isTruncatedOutsideScope,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            hits: searchResult.hits.map((hit: any) => {
                return {
                    ...hit,
                    ...(hit.binderSummary ? { ...hit.binderSummary, views: stats[hit.binderSummary.id] } : {}),
                    ...(hit.collection ? { ...hit.collection, views: stats[hit.collection.id] } : {}),
                }
            }),
        };
    };
    try {
        await fluxWrap(
            toWrap,
            KEY_FOUND_DOCUMENTS
        )
    } catch (error) {
        if (error.errorDetails?.name === "UnsupportedLanguageError") {
            if (
                error.errorDetails.languageCodes != null &&
                error.errorDetails.languageCodes.length > 0
            ) {
                FlashMessages.error(
                    i18next.t(
                        TK.Edit_TranslateFailUnsupportedLanguage,
                        { unsupportedLanguage: error.errorDetails.languageCodes[0], count: 1 }
                    )
                );
                return;
            }
            FlashMessages.error(i18next.t(TK.Tts_LanguageNotSupported));
            return;
        }
        FlashMessages.error(i18next.t(TK.DocManagement_ItemLoadFail));
    }
};

export const cleanFoundItems = (): Promise<unknown> => {
    return wrapAction(
        () => ({ hits: undefined, totalHitCount: undefined }),
        KEY_FOUND_DOCUMENTS,
        i18next.t(TK.DocManagement_ItemLoadFail),
    );
}


export const cleanFoundAncestors = (): void => {
    dispatch({
        type: KEY_FOUND_ITEMS_ANCESTORS,
        body: undefined,
    });
}

export const getPathFromParentItems = (itemId: string, parentItems: EditorItem[]): string => {
    if (parentItems === undefined || parentItems.length === 0) {
        return itemId;
    }
    const parentIds = parentItems
        .map(item => item.id);
    if (itemId) {
        parentIds.push(itemId);
    }
    return parentIds.join("/");
}

export function getDocumentPath(breadCrumbsPaths: DocumentCollection[][]): string {
    const parents = [...breadCrumbsPaths[0]];
    parents.pop();
    return getPathFromParentItems(undefined, parents);
}

export const getEditableItems = (itemIds: string[]): Promise<(DocumentCollection | Binder)[]> => {
    const accountId: string = AccountStore.getActiveAccountId();
    const toWrap = async () => {
        const items = await APILoadItems(itemIds, accountId, { ancestorThumbnailsOptions: { inheritAncestorThumbnails: true } });
        const ancestors = await APILoadItemsAncestors(itemIds);
        const ancestorObject = buildAncestorsObject(itemIds, ancestors);
        return itemIds.reduce((reduced, itemId) => {
            const item = items.find(item => item && item.id === itemId);
            if (!item) {
                return reduced;
            }
            const ancestorFoundInItems = intersection(ancestorObject[item.id], Object.keys(ancestorObject)).length > 0;
            return ancestorFoundInItems ?
                reduced :
                [...reduced, item];
        }, [] as (DocumentCollection | Binder)[]);
    }
    return wrapAction(
        toWrap,
        KEY_EDITABLE_DOCUMENTS,
        i18next.t(TK.DocManagement_ItemLoadFailEditable)
    );
};

const sortCollection = (originalSortedIds: string[], fetchedItems: (DocumentCollection | Binder)[]): (DocumentCollection | Binder)[] => {
    return originalSortedIds
        .map(id => fetchedItems.find(item => item.id === id))
        .filter(item => !!item);
}

export const loadItemsInCollection = (collectionId: string): Promise<(DocumentCollection | Binder)[]> => {
    const toWrap = async () => {
        const collection = await APILoadCollection(collectionId);
        dispatch({
            type: KEY_EDITABLE_DOCUMENTS_PREVIEWS,
            body: collection.elements
        });
        dispatch({
            type: KEY_FULL_ACTIVE_COLLECTION_ITEM,
            body: collection
        })
        activateAccountId(collection.accountId);
        const itemIds = collection.elements.map(({ key }) => key);
        const accountFeaturesWD = AccountStore.getAccountFeatures();
        const activeAccount = AccountStore.getActiveAccount();
        const shouldFetchStatistics = !isThisItemHidden(accountFeaturesWD.result, activeAccount.canIEdit);
        const unsorted = await APILoadItems(itemIds, collection.accountId, {
            ancestorThumbnailsOptions: {
                inheritAncestorThumbnails: true,
                directParentCollectionId: collectionId,
            },
            skipInstanceDetermination: true
        });
        if (shouldFetchStatistics) {
            loadStatisticsForIds(itemIds, collection.accountId);
        }

        const itemsWithInfo = unsorted.map(item => {
            const colElement = collection.elements.find(el => el.key === item.id);
            item.isInstance = colElement && colElement.isInstance;
            return item;
        });
        return sortCollection(itemIds, itemsWithInfo);
    }
    return wrapAction(
        toWrap,
        KEY_EDITABLE_DOCUMENTS,
        i18next.t(TK.DocManagement_ColLoadFailInfo),
    );
};

const loadStatisticsForIds = async (ids: string[], accountId: string): Promise<void> => {
    if (!ids) {
        return;
    }
    let stats;
    try {
        stats = await APIGetViewsStatistics(ids, accountId);
    } catch (error) {
        stats = [];
    }
    dispatch({
        type: ACTION_UPDATE_STATISTICS,
        body: stats,
    });
};


export const clearBrowseItems = (): void => {
    dispatch({
        type: getWebDataActionType(KEY_EDITABLE_DOCUMENTS, WebDataState.PENDING),
        body: WebData.create()
    });
}

export const setCollectionIsHidden = async (collectionId: string, isHidden: boolean): Promise<void> => {
    try {
        const collection = await APISetCollectionIsHidden(collectionId, isHidden);
        dispatch({
            type: ACTION_UPDATE_COLLECTION_IS_HIDDEN,
            body: {
                collection,
            },
        });
        useBrowseStore.getState().patchIsHidden(collectionId);
        dispatch({
            type: ACTION_UPDATE_COLLECTION,
            body: collection
        });
    } catch (error) {
        // eslint-disable-next-line
        console.error(error);
        FlashMessages.error(i18next.t(TK.DocManagement_ColUpdateFail));
    }
}

export const dispatchUpdatedCollection = (updatedCollection: DocumentCollection): void => {
    dispatch({
        type: ACTION_UPDATE_COLLECTION,
        body: updatedCollection
    });
}

function dispatchCollectionTitleChange(collectionId: string, languageCode: string, name: string): void {
    patchBreadCrumbs(collectionId, languageCode, name);
    dispatch({
        type: ACTION_UPDATE_COLLECTION_TITLE,
        body: {
            id: collectionId,
            languageCode,
            name
        }
    });
}

export async function saveCollectionTitle(collectionId: string, languageCode: string, name: string): Promise<DocumentCollection> {
    const collection = await APISaveCollectionTitle(collectionId, languageCode, name);
    dispatchCollectionTitleChange(collectionId, languageCode, name);
    dispatchUpdatedCollection(collection);
    refreshSemanticLinks(collectionId);
    return collection;
}

export async function updateLanguageOfCollectionTitle(collectionId: string, currentLanguageCode: string, languageCode: string, name: string): Promise<DocumentCollection> {
    const result = await APIUpdateLanguageOfCollectionTitle(collectionId, currentLanguageCode, languageCode);
    dispatchCollectionTitleChange(collectionId, languageCode, name);
    return result;
}

export const removeCollectionTitle = async (domain: string, collectionId: string, languageCode: string): Promise<DocumentCollection> => {
    const collection = await APIRemoveCollectionTitle(domain, collectionId, languageCode);
    refreshSemanticLinks(collectionId);
    dispatchUpdatedCollection(collection);
    return collection;
}

export const retrieveMostUsedLanguages = async (accountId: string): Promise<void> => {
    const mostUsedLanguages = await APIMostUsedLanguages(accountId);
    dispatch({
        type: KEY_MOSTUSED_LANGUAGES,
        body: mostUsedLanguages,
    });
};

export const deleteCollection = async (collectionId: string, accountId: string): Promise<void> => {
    await APIDeleteCollection(collectionId, accountId);
    dispatch({
        type: ACTION_DELETE_ITEM,
        body: collectionId,
    });
};

export const deleteDocument = async (documentId: string, accountId: string): Promise<void> => {
    await APIDeleteBinder(documentId, accountId);
    dispatch({
        type: ACTION_DELETE_ITEM,
        body: documentId,
    });
}

export const pdfExport = (
    publicationId: string,
    domain: string,
    exportOptions: IPDFExportOptions,
): Promise<string> => APIPdfExport(publicationId, domain, exportOptions);

export const pdfPreview = (
    publicationId: string,
    domain: string,
    exportOptions: IPDFExportOptions,
): Promise<string> => APIPdfPreview(publicationId, domain, exportOptions);

const dispatchPublishInProgress = (languageCodes: string[]): void => {
    dispatch({
        type: KEY_PUBLISH_IN_PROGRESS,
        body: languageCodes,
    })
}

const dispatchPublishDone = (languageCodes: string[]): void => {
    dispatch({
        type: KEY_PUBLISH_DONE,
        body: languageCodes
    })
}


export const publishBinder = async (binderId: string, languageCodes: string[], sendNotification = true): Promise<boolean> => {
    try {
        dispatchPublishInProgress(languageCodes);
        await waitForPendingSave();
        await APIPublishBinder(binderId, languageCodes, sendNotification);
        const publications = await loadPublications(binderId);
        dispatch({
            type: KEY_PATCH_PUBLICATIONS,
            body: publications
        });
        refreshSemanticLinks(binderId);
        dispatchPublishDone(languageCodes);
        await invalidateBinderPublicationSummaries(binderId);
        return true;
    } catch (error) {
        if (error.errorDetails?.name === "NothingToPublish") {
            dispatchPublishDone(languageCodes)
            FlashMessages.success(i18next.t(TK.Edit_NothingChanged));
            return true;
        }
        // eslint-disable-next-line
        console.error(error);
        FlashMessages.error(i18next.t(TK.Edit_PublishFail));
        dispatchPublishDone(languageCodes);
        return false;
    }
};

export const unpublishBinder = async (binderId: string, languageCodes: string[]): Promise<void> => {
    try {
        await APIUnpublishBinder(binderId, languageCodes);
        const publications = await loadPublications(binderId);
        dispatch({
            type: KEY_PATCH_PUBLICATIONS,
            body: publications
        });
        await invalidateBinderPublicationSummaries(binderId);
    } catch (error) {
        // eslint-disable-next-line
        console.error(error);
        if (error.message.includes(NothingToUnpublish.MESSAGE_START)) {
            FlashMessages.error(i18next.t(TK.Edit_UnpublishFailNoPubs));
            return;
        }
        FlashMessages.error(i18next.t(TK.Edit_UnpublishFail));
    }
};

export const updatePublicationsLanguages = async (binder: BinderClass, languageCode: string, order: string[]): Promise<void> => {
    const publications = await APIUpdatePublicationsLanguages(binder.id, languageCode, order);
    dispatch({
        type: KEY_PATCH_PUBLICATIONS,
        body: publications,
    });
};

export function setSemanticLink(semanticLink: ISemanticLink, binderId: string, overrideInTrash: boolean): Promise<SetSemanticLinkResult> {
    return APISetSemanticLink(semanticLink, binderId, overrideInTrash);
}

export function buildParentPath(itemId: string, ancestors: DocumentAncestors, items: EditorItem[], acc?: EditorItem[]): EditorItem[] {
    if (acc === undefined) {
        acc = [];
    }
    const item = items.find(i => i.id === itemId);
    if (item === undefined) {
        return acc.reverse();
    }
    acc.push(item);
    const newAncestors = ancestors[itemId];
    if (newAncestors === undefined || newAncestors.length === 0) {
        return acc.reverse();
    }
    return buildParentPath(newAncestors[0], ancestors, items, acc);
}

export const moveItemBetweenCollections = async (
    itemId: string,
    itemKind: "document" | "collection",
    sourceCollectionId: string,
    targetCollectionId: string,
    remove = true,
    accountId: string
): Promise<void> => {
    if (!sourceCollectionId) {
        // Don't allow move without a proper sourceCollectionId, or we may end up in an inconsistent state
        throw new Error("Invalid source collection id");
    }
    await APIAddElementToCollection(targetCollectionId, itemKind, itemId, accountId);
    if (remove) {
        const permanent = true;
        await APIRemoveElementFromCollection(sourceCollectionId, itemKind, itemId, accountId, permanent);
    }
    logItemMovedUserAction(itemId, itemKind, sourceCollectionId, targetCollectionId, remove, accountId)
}

const logItemMovedUserAction = (
    itemId: string,
    itemKind: "document" | "collection",
    sourceCollectionId: string,
    targetCollectionId: string,
    remove: boolean,
    accountId: string
): void => {
    const userId = getCurrentUserId();
    if (userId == null) {
        throw new Error(`User details not loaded while moving ${itemId} from ${sourceCollectionId} to ${targetCollectionId}`);
    }
    const userAction = {
        accountId,
        userId,
        userActionType: UserActionType.ITEM_MOVED,
        data: {
            itemKind: collectionOrDocumentToTrackingItemKind(itemKind),
            itemId,
            fromCollectionId: sourceCollectionId,
            toCollectionId: targetCollectionId,
            removeFromOriginalParent: remove,
        },
    };
    APIMultiInsertUserAction([userAction], accountId);
}

const dispatchThumbnailUpdate = (collection: DocumentCollection, newThumbnail: IThumbnail, isForActive: boolean): void => {
    const oldThumbnail = collection.thumbnail;
    collection.thumbnail = newThumbnail;
    dispatch({
        type: ACTION_UPDATE_EDITABLE_ITEM,
        body: collection
    });
    dispatch({
        type: ACTION_UPDATE_COLLECTION,
        body: collection
    });
    if (isForActive) {
        dispatch({
            type: ACTION_UPDATE_PARENT_COLLECTION_THUMBNAIL,
            body: {
                visual: newThumbnail,
                currentThumbnail: oldThumbnail,
            },
        });
    }
}

export const removeCollectionThumbnail = async (collection: DocumentCollection, isForActive: boolean): Promise<DocumentCollection> => {
    const accountFeaturesWD = AccountStore.getAccountFeatures();
    const useCDN = !(accountFeaturesWD.result.includes(FEATURE_NOCDN));
    const updatedCollection = await APIRemoveCollectionThumbnail(collection.id, {
        cdnifyThumbnails: useCDN,
        inheritAncestorThumbnails: true,
        accountId: collection.accountId
    });
    dispatchThumbnailUpdate(collection, updatedCollection.thumbnail, isForActive);
    return collection;
}

export const updateCollectionThumbnail = (
    collection: DocumentCollection,
    visual: VisualClass,
    isForActive: boolean
) => {
    const thumbnail = visualToThumbnail(visual);
    APIUpdateCollectionThumbnail(collection.id, thumbnail as Thumbnail);
    dispatchThumbnailUpdate(collection, thumbnail, isForActive);
}

export const moveItemInCollection = async (
    collectionId: string,
    itemId: string,
    itemKind: "document" | "collection",
    newPosition: number
): Promise<void> => {
    dispatch({
        type: KEY_COLLECTION_MOVE_ITEM,
        body: { collectionId, itemId, itemKind, newPosition }
    });
    await APIMoveElementInCollection(collectionId, itemKind, itemId, newPosition);
}

export const removeItemFromCollection = async (
    collectionId: string,
    itemKind: "document" | "collection",
    itemId: string,
    accountId: string,
    permanent = false
): Promise<void> => {
    await APIRemoveElementFromCollection(collectionId, itemKind, itemId, accountId, permanent);
    dispatch({
        type: KEY_COLLECTION_REMOVE_ITEM,
        body: { itemId }
    });
}

export const removeItemFromAllCollections = async (..._params: unknown[]): Promise<never> => {
    throw new Error("Not implemented");
}

export async function reloadAfterLanguageRelabel(binderId: string, accountFeatures: string[]): Promise<void> {
    const publications = await loadPublications(binderId);
    dispatch({
        type: KEY_PATCH_PUBLICATIONS,
        body: publications,
    });
    if (accountFeatures.includes(FEATURE_APPROVAL_FLOW)) {
        fetchChunkApprovals(binderId);
    }
    if (accountFeatures.includes(FEATURE_COMMENTING_IN_EDITOR)) {
        invalidateCommentThreads(binderId);
    }
}

export async function fetchChunkApprovals(binderId: string): Promise<IChunkApproval[]> {
    return wrapAction(
        () => APIGetChunkApprovalsForBinder(binderId),
        KEY_CHUNK_APPROVALS,
        "Fail to load chunk approvals",
    );
}

export async function fetchChecklistConfigs(binderId: string): Promise<IChecklistConfig[]> {
    return wrapAction(
        () => APIGetChecklistConfigs(binderId),
        KEY_CHECKLIST_CONFIGS,
        "Fail to load checklist configs",
    );
}

export async function updateChunkApprovals(binderId: string, chunkApprovalFilter: ChunkApprovalFilter, approvalStatus: ApprovedStatus): Promise<IChunkApproval[]> {
    return wrapAction(
        () => APIUpdateChunkApprovals(binderId, chunkApprovalFilter, approvalStatus),
        KEY_CHUNK_APPROVALS,
        "Fail to update chunk approvals",
    );
}

export async function updateChunkApproval(
    binderId: string,
    chunkId: string,
    languageCode: string,
    lastChunkUpdate: number,
    approved: ApprovedStatus,
): Promise<IChunkApproval[]> {
    return wrapAction(
        () => APIApproveChunk(binderId, chunkId, languageCode, lastChunkUpdate, approved),
        KEY_CHUNK_APPROVALS,
        "Fail to load chunk approvals",
    );
}

export async function onSaveChecklistActivation(binderId: string, chunkId: string, isActive: boolean): Promise<void> {
    const updatedChecklistConfig = await APISaveChecklistActivation(binderId, chunkId, isActive);
    dispatch({
        type: ACTION_PATCH_CHECKLIST_CONFIGS,
        body: updatedChecklistConfig,
    });
}

export function updateAuthors(arr: string[]): void {
    dispatch({
        type: ACTION_SET_BINDER_AUTHORS,
        body: arr,
    });
}
