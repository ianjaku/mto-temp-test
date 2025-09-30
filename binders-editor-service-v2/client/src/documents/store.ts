import * as Immutable from "immutable";
import {
    Binder,
    CollectionElement,
    DocumentCollection
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { IWebData, WebData, WebDataState } from "@binders/client/lib/webdata";
import { LastEditInfo, getLastEditInfo } from "@binders/client/lib/binders/create";
import { immutableStateFromKeys, updateWebDataState } from "@binders/client/lib/webdata/flux";
import { omit, uniq } from "ramda";
import Dispatcher from "@binders/client/lib/react/flux/dispatcher";
import { ISemanticLink } from "@binders/client/lib/clients/routingservice/v1/contract";
import { ReduceStore } from "flux/utils";
import { UNDEFINED_LANG } from "@binders/client/lib/util/languages";
import { extractIdFromUrl } from "@binders/client/lib/clients/imageservice/v1/visuals";
import { patchImageSetThumbnailDetails } from "@binders/client/lib/binders/patching";
import { update as updateBinder, } from "@binders/client/lib/binders/custom/class";
import { withParsedThumbnail } from "@binders/client/lib/clients/repositoryservice/v3/Thumbnail";

export const ACTION_LIFT_ACTIVE_BINDER = "lift-active-binder";
export const KEY_ACTIVE_BINDER = "active-binder";
export const KEY_BACKEND_META_MODULE = "backend-meta-module";
export const KEY_ACTIVE_BINDER_PUBLICATIONS = "active-binder-publications";
export const KEY_DIRTY_BINDER = "dirty-binder";
export const KEY_BINDER_IS_DIRTY = "binder-is-dirty";
export const KEY_BINDER_IS_SAVING = "binder-is-saving";
export const KEY_BINDER_IS_SAVED = "binder-is-saved";
export const KEY_BINDER_SAVING_INFO = "binder-saving-info";
export const KEY_BINDER_CLEAR_SAVING_INFO = "binder-clear-last-save";
export const KEY_FOUND_DOCUMENTS = "found-documents";
export const KEY_CHUNK_APPROVALS = "chunk-approvals";
export const KEY_CHECKLIST_CONFIGS = "checklist-configs";
export const KEY_CLEAR_ACTIVE_BINDER = "clear-active-binder";
export const KEY_COLLECTION_MOVE_ITEM = "collection-move-item";
export const KEY_COLLECTION_REMOVE_ITEM = "collection-remove-item";
export const KEY_EDITABLE_DOCUMENTS = "editable-documents";
export const KEY_EDITABLE_DOCUMENTS_PREVIEWS = "editable-documents-previews";
export const KEY_FULL_ACTIVE_COLLECTION_ITEM = "full-active-collection-item";
export const KEY_LOAD_SEMANTICLINKS = "load-semanticlinks";
export const KEY_PATCH_PUBLICATIONS = "patch-active-binder-publications";
export const KEY_PATCH_PUBLICATIONS_UPDATE = "patch-active-binder-publications-update";
export const KEY_MOSTUSED_LANGUAGES = "mostused-languages";
export const ACTION_SET_THUMBNAIL = "action-set-thumbnail";
export const ACTION_UPDATE_EDITABLE_ITEM = "action-update-editable-item";
export const ACTION_UPDATE_COLLECTION = "action-update-collection";
export const ACTION_DELETE_ITEM = "action-delete-item";
export const ACTION_UPDATE_COLLECTION_IS_HIDDEN = "action-update-collection-is-hidden";
export const ACTION_UPDATE_COLLECTION_TITLE = "action-update-collection-title";
export const ACTION_UPDATE_SEMANTICLINK = "action-update-semanticlinks";
export const ACTION_UPDATE_SEMANTICLINKS = "action-update-semanticlinks-multi";
export const ACTION_DELETE_SEMANTICLINK = "action-delete-semanticlink";
export const ACTION_UPDATE_STATISTICS = "action-update-statistics";
export const KEY_FOUND_ITEMS_ANCESTORS = "get-found-items-ancestors";
export const ACTION_PATCH_CHECKLIST_CONFIGS = "patch-checklist-configs";
export const ACTION_UPDATE_PARENT_COLLECTION_THUMBNAIL = "action-update-root-collection-thumbnail";
export const KEY_PUBLISH_IN_PROGRESS = "publish-in-progress";
export const KEY_BINDER_AUTHORS = "binder-authors";
export const ACTION_SET_BINDER_AUTHORS = "set-binder-authors";
export const KEY_PUBLISH_DONE = "publish-done"
export const ACTION_ITEM_LOCK_OVERRIDDEN = "action-item-lock-overridden";


// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Action { }

export interface IBinderSavingInfo {
    isSaving: boolean;
    lastSaveMoment: Date | undefined;
}

const initialSavingInfo = { isSaving: false, lastSaveMoment: undefined };

const ALL_MANAGED_KEYS = [
    KEY_FOUND_DOCUMENTS,
    KEY_ACTIVE_BINDER,
    KEY_ACTIVE_BINDER_PUBLICATIONS,
    KEY_EDITABLE_DOCUMENTS,
    KEY_LOAD_SEMANTICLINKS,
    KEY_CHUNK_APPROVALS,
    KEY_CHECKLIST_CONFIGS,
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class DocumentStore extends ReduceStore<Immutable.Map<string, any>, Action> {

    getInitialState() {
        return (immutableStateFromKeys(ALL_MANAGED_KEYS))
            .set(KEY_BINDER_IS_DIRTY, false)
            .set(KEY_EDITABLE_DOCUMENTS_PREVIEWS, [])
            .set(KEY_MOSTUSED_LANGUAGES, [])
            .set(KEY_BINDER_SAVING_INFO, initialSavingInfo)
            .set(KEY_BINDER_AUTHORS, [])
            .set(KEY_PUBLISH_IN_PROGRESS, []);
    }

    reduce(state, action) {
        switch (action.type) {
            case KEY_BINDER_IS_DIRTY:
                return state
                    .set(KEY_BINDER_IS_DIRTY, true);
            case KEY_BACKEND_META_MODULE:
                return state
                    .set(KEY_BACKEND_META_MODULE, action.body);
            case KEY_BINDER_IS_SAVING: {
                const savingInfo = state.get(KEY_BINDER_SAVING_INFO);
                return state
                    .set(KEY_BINDER_IS_DIRTY, false)
                    .set(KEY_BINDER_SAVING_INFO, {
                        ...savingInfo,
                        isSaving: true,
                    });
            }
            case KEY_BINDER_IS_SAVED: {
                const savingInfo = state.get(KEY_BINDER_SAVING_INFO);
                return state
                    .set(KEY_BINDER_IS_DIRTY, false)
                    .set(KEY_BINDER_SAVING_INFO, {
                        ...savingInfo,
                        lastSaveMoment: new Date(),
                        isSaving: false,
                    })
            }
            case KEY_BINDER_CLEAR_SAVING_INFO:
                return state.set(KEY_BINDER_SAVING_INFO, initialSavingInfo);
            case KEY_PATCH_PUBLICATIONS: {
                const currentPublications = state.get(KEY_ACTIVE_BINDER_PUBLICATIONS);
                const updatedPublications = currentPublications.lift(() => action.body);
                return state.set(KEY_ACTIVE_BINDER_PUBLICATIONS, updatedPublications);
            }
            case KEY_PATCH_PUBLICATIONS_UPDATE: {
                const currentPublicationsWD = state.get(KEY_ACTIVE_BINDER_PUBLICATIONS);
                const currentPublications = currentPublicationsWD.data;
                const updatedPublications = currentPublicationsWD.lift(() => {
                    return currentPublications.map(currentPublication => {
                        const updatedPublication = action.body.find(p => p.id === currentPublication.id);
                        return updatedPublication || currentPublication;
                    });
                });
                return state.set(KEY_ACTIVE_BINDER_PUBLICATIONS, updatedPublications);
            }
            case KEY_EDITABLE_DOCUMENTS_PREVIEWS: {
                return state.set(KEY_EDITABLE_DOCUMENTS_PREVIEWS, action.body);
            }
            case KEY_FULL_ACTIVE_COLLECTION_ITEM: {
                return state.set(KEY_FULL_ACTIVE_COLLECTION_ITEM, action.body);
            }
            case KEY_MOSTUSED_LANGUAGES: {
                return state.set(KEY_MOSTUSED_LANGUAGES, action.body);
            }
            case ACTION_UPDATE_STATISTICS: {
                const itemsWD = state.get(KEY_EDITABLE_DOCUMENTS);
                if (itemsWD.status !== WebDataState.SUCCESS) {
                    return state;
                }
                const currentItems = itemsWD.data;
                const result = currentItems.map(item => {
                    item.views = action.body[item.id];
                    return item;
                });
                return state
                    .set(KEY_EDITABLE_DOCUMENTS, itemsWD.lift(() => result));
            }
            case KEY_COLLECTION_MOVE_ITEM: {
                const itemsWD = state.get(KEY_EDITABLE_DOCUMENTS);
                if (itemsWD.status !== WebDataState.SUCCESS) {
                    return state;
                }
                const { itemId, newPosition } = action.body;
                const currentItems = itemsWD.data;
                const itemToMove = currentItems.find(i => i.id === itemId);
                const items = currentItems
                    .filter(i => i.id !== itemId);
                const updatedItems = [];
                items.forEach((item, index) => {
                    if (index === newPosition) {
                        updatedItems.push(itemToMove);
                    }
                    updatedItems.push(item);
                });
                if (newPosition === updatedItems.length) {
                    updatedItems.push(itemToMove);
                }
                return state
                    .set(KEY_EDITABLE_DOCUMENTS, itemsWD.lift(() => updatedItems));
            }
            case KEY_COLLECTION_REMOVE_ITEM: {
                const itemsWD = state.get(KEY_EDITABLE_DOCUMENTS);
                if (itemsWD.status !== WebDataState.SUCCESS) {
                    return state;
                }
                const { itemId } = action.body;
                const currentItems = itemsWD.data;
                let found = false;
                const updatedItems = currentItems.filter(i => {
                    if (found) {
                        return true;
                    }
                    found = i.id === itemId;
                    return !found;
                });
                return state
                    .set(KEY_EDITABLE_DOCUMENTS, itemsWD.lift(() => updatedItems));
            }
            case ACTION_LIFT_ACTIVE_BINDER: {
                const binder = this.getActiveBinder();
                const updatedBinder = binder.lift(() => action.body);
                return state.set(KEY_ACTIVE_BINDER, updatedBinder);
            }
            case ACTION_SET_THUMBNAIL: {
                const binder = this.getActiveBinder();
                const updatedBinder = binder.lift(binder => {
                    return updateBinder(binder, () => [patchImageSetThumbnailDetails(action.body)], true);
                    // TODO leaving this out doesn't do much?
                });
                return state.set(KEY_ACTIVE_BINDER, updatedBinder);
            }
            case ACTION_UPDATE_EDITABLE_ITEM: {
                const currentState = this.getState();
                const currentEditableItems = this.getEditableItems();
                const updatedItem = action.body;
                const updatedItems = currentEditableItems.lift(items => {
                    const index = items.findIndex(item => item.id === updatedItem.id);
                    items[index] = updatedItem;
                    return items;
                });
                return currentState.set(KEY_EDITABLE_DOCUMENTS, updatedItems);
            }
            case ACTION_UPDATE_COLLECTION: {
                const currentState = this.getState();
                const updatedItem = action.body;
                const currentFoundItems = this.getFoundItems();
                const updatedItems = currentFoundItems.lift(items => {
                    const updatedHits = items.hits && items.hits.map((hit) => {
                        if (hit.collection && hit.collection.id === updatedItem.id) {
                            return { ...hit, collection: { ...hit.collection, ...updatedItem } };
                        }
                        return hit;
                    });
                    return { ...items, hits: updatedHits };
                });
                const updatedEditableItems = this.getEditableItems().lift(items => {
                    return items.map(i => {
                        return (i.id === updatedItem.id) ? { ...i, ...omit(["thumbnail"], updatedItem) } : i;
                    });
                });
                return currentState
                    .set(KEY_FOUND_DOCUMENTS, updatedItems)
                    .set(KEY_EDITABLE_DOCUMENTS, updatedEditableItems);
            }
            case ACTION_UPDATE_COLLECTION_IS_HIDDEN: {
                const { collection } = action.body;
                const currentState = this.getState();
                const currentEditableItems = this.getEditableItems();
                const updatedItems = currentEditableItems.lift(items => {
                    const index = items.findIndex(({ id: itemId }) => itemId === collection.id);
                    return index === -1 ?
                        items :
                        [
                            ...items.slice(0, index),
                            { ...items[index], ...collection },
                            ...items.slice(index + 1),
                        ];
                });
                return currentState.set(KEY_EDITABLE_DOCUMENTS, updatedItems);
            }
            case ACTION_UPDATE_COLLECTION_TITLE: {
                const { id, languageCode, name } = action.body;
                const currentState = this.getState();
                const currentEditableItems = this.getEditableItems();
                const updatedItems = currentEditableItems.lift(items => {
                    const index = items.findIndex(({ id: itemId }) => itemId === id);
                    if (index === -1) {
                        return items;
                    }
                    const collection = items[index];
                    const languageIndex = collection.titles.findIndex(({ languageCode: c }) => (c === languageCode || c === UNDEFINED_LANG));
                    if (languageIndex === -1) {
                        return items;
                    }
                    collection.titles[languageIndex].title = name;
                    collection.titles[languageIndex].languageCode = languageCode;
                    return items;
                });
                return currentState.set(KEY_EDITABLE_DOCUMENTS, updatedItems);
            }
            case ACTION_DELETE_ITEM: {
                let currentState = this.getState();
                const currentEditableItemsWD = this.getEditableItems();
                const itemIdToDelete = action.body;
                const updatedItemsWD = currentEditableItemsWD.lift(items => (
                    items.filter(item => item.id !== itemIdToDelete)
                ));
                const foundItemsWD = this.getFoundItems();
                if (foundItemsWD.status === WebDataState.SUCCESS && Array.isArray(foundItemsWD.data.hits)) {
                    const updatedFoundItemsWD = foundItemsWD.lift(foundItems => {
                        foundItems.hits = foundItems.hits && foundItems.hits.filter(hit => (hit.binderSummary || hit.collection).id !== itemIdToDelete);
                        foundItems.totalHitCount = foundItems.hits && foundItems.hits.length;
                        return foundItems;
                    });
                    currentState = currentState.set(KEY_FOUND_DOCUMENTS, updatedFoundItemsWD);
                }
                return currentState.set(KEY_EDITABLE_DOCUMENTS, updatedItemsWD)

            }

            case ACTION_ITEM_LOCK_OVERRIDDEN: {
                const activeBinder = this.getActiveBinderObject();
                const { body: { itemId, overriddenByThisWindow } } = action;
                if (activeBinder.id === itemId) {
                    if (!overriddenByThisWindow) {
                        return state.set(KEY_ACTIVE_BINDER, WebData.create());
                    }
                }
                return state;
            }
            case KEY_CLEAR_ACTIVE_BINDER: {
                return state.set(KEY_ACTIVE_BINDER, WebData.create());
            }
            case KEY_CHUNK_APPROVALS: {
                const approvalsWD = state.get(KEY_CHUNK_APPROVALS);
                if (approvalsWD.status !== WebDataState.SUCCESS) {
                    return state;
                }
                return state.set(KEY_CHUNK_APPROVALS, approvalsWD.lift(() => action.body));
            }
            case ACTION_UPDATE_SEMANTICLINKS: {
                return state.update(
                    KEY_LOAD_SEMANTICLINKS,
                    wd => wd.lift(() => action.body)
                );
            }
            case ACTION_UPDATE_SEMANTICLINK: {
                return state.update(
                    KEY_LOAD_SEMANTICLINKS,
                    wd => wd.lift(currentSemanticLinks => {
                        if (currentSemanticLinks.some(sl => sl.id === action.body.id)) {
                            return currentSemanticLinks.map(semanticLink => semanticLink.id === action.body.id ?
                                action.body :
                                semanticLink
                            );
                        }
                        return [...currentSemanticLinks, action.body];
                    })
                );
            }
            case ACTION_DELETE_SEMANTICLINK: {
                return state.update(
                    KEY_LOAD_SEMANTICLINKS,
                    wd => wd.lift(currentSemanticLinks => {
                        return currentSemanticLinks.filter(l => l.id !== action.body);
                    })
                );
            }
            case KEY_FOUND_ITEMS_ANCESTORS: {
                return state.set(KEY_FOUND_ITEMS_ANCESTORS, action.body);
            }
            case ACTION_PATCH_CHECKLIST_CONFIGS: {
                const currentChecklistConfigs = state.get(KEY_CHECKLIST_CONFIGS);
                if (currentChecklistConfigs.status !== WebDataState.SUCCESS) {
                    return;
                }
                const incomingConfig = action.body;
                const updatedConfigs = currentChecklistConfigs.lift(() => [
                    ...currentChecklistConfigs.data.filter(cfg => cfg.chunkId !== incomingConfig.chunkId),
                    incomingConfig,
                ]);
                return state.set(KEY_CHECKLIST_CONFIGS, updatedConfigs);
            }
            case ACTION_UPDATE_PARENT_COLLECTION_THUMBNAIL:
                return this.updateParentCollectionThumbnail(action);
            case ACTION_SET_BINDER_AUTHORS: {
                const currentAuthors = state.get(KEY_BINDER_AUTHORS);
                if (action.body?.length > 0) {
                    return state.set(KEY_BINDER_AUTHORS, uniq([...currentAuthors, ...action.body]));
                } else {
                    return state.set(KEY_BINDER_AUTHORS, [])
                }
            }
            case KEY_PUBLISH_IN_PROGRESS: {
                const publishlangCodesInProgress = state.get(KEY_PUBLISH_IN_PROGRESS)
                const updatePublishInProgressState = [
                    ...publishlangCodesInProgress,
                    ...action.body]
                return state.set(KEY_PUBLISH_IN_PROGRESS, updatePublishInProgressState)
            }
            case KEY_PUBLISH_DONE: {
                const publishlangCodesInProgress = state.get(KEY_PUBLISH_IN_PROGRESS)
                const langCodesToDelete = action.body.reduce((acc, curr) => {
                    if (curr) {
                        acc[curr] = true
                    }
                    return acc
                }, {})
                const updatedPublishInProgress = publishlangCodesInProgress.filter(langCode => !langCodesToDelete[langCode])
                return state.set(KEY_PUBLISH_IN_PROGRESS, updatedPublishInProgress)
            }
            default:
                return updateWebDataState(state, action, ALL_MANAGED_KEYS);
        }
    }

    getEditableDocumentsPreviews(): CollectionElement[] {
        return this.getState()
            .get(KEY_EDITABLE_DOCUMENTS_PREVIEWS);
    }

    getFullActiveCollection() {
        return this.getState().get(KEY_FULL_ACTIVE_COLLECTION_ITEM);
    }

    getStatisticsForActiveBinder(): LastEditInfo | undefined {
        const activeBinder = this.getActiveBinderObject();
        return activeBinder && getLastEditInfo(activeBinder);
    }

    getActiveBinder() {
        return this.getState()
            .get(KEY_ACTIVE_BINDER)
    }

    getBackendMetaModule() {
        return this.getState().get(KEY_BACKEND_META_MODULE);
    }

    getActiveBinderObject() {
        const binderWD = this.getActiveBinder();
        return binderWD.state === WebDataState.SUCCESS && binderWD.data;
    }

    getBinderSavingInfo(): IBinderSavingInfo {
        return this.getState().get(KEY_BINDER_SAVING_INFO);
    }

    isActiveBinderDirty() {
        return this.getState().get(KEY_BINDER_IS_DIRTY);
    }

    getFoundItems() {
        return this.getState().get(KEY_FOUND_DOCUMENTS);
    }

    getFoundItemsAncestors() {
        return this.getState().get(KEY_FOUND_ITEMS_ANCESTORS);
    }

    getEditableItems() {
        return this.getState().get(KEY_EDITABLE_DOCUMENTS);
    }

    getActiveBinderPublications() {
        return this.getState().get(KEY_ACTIVE_BINDER_PUBLICATIONS);
    }

    getSemanticLinks(): IWebData<ISemanticLink[]> {
        return this.getState().get(KEY_LOAD_SEMANTICLINKS);
    }

    getMostUsedLanguages() {
        return this.getState().get(KEY_MOSTUSED_LANGUAGES);
    }

    getChunkApprovals() {
        return this.getState().get(KEY_CHUNK_APPROVALS);
    }

    getChecklistConfigs() {
        return this.getState().get(KEY_CHECKLIST_CONFIGS);
    }

    getRootCollection(): DocumentCollection | Binder {
        const foundItems = this.getState().get(KEY_EDITABLE_DOCUMENTS);
        if (foundItems.status === WebDataState.SUCCESS) {
            return foundItems.data.find(item => item.isRootCollection);
        }
        return undefined;
    }
    getIsPublishInProgress() {
        return this.getState().get(KEY_PUBLISH_IN_PROGRESS);
    }

    getAuthors() {
        return this.getState().get(KEY_BINDER_AUTHORS);
    }

    updateParentCollectionThumbnail(action) {
        const { currentThumbnail, visual } = action.body;
        const currentState = this.getState();
        const currentEditableItems = this.getEditableItems();
        const parentThumbnailMedium = currentThumbnail.medium || currentThumbnail.buildRenderUrl({ requestedFormatNames: ["medium"] });
        const parentThumbnailId = extractIdFromUrl(parentThumbnailMedium);
        const updatedItems = currentEditableItems.lift(items => items.map(item => {
            const thumbnailMedium = (item.thumbnail && item.thumbnail.medium) || item.thumbnail.buildRenderUrl({ requestedFormatNames: ["medium"] });
            const thumbnailId = extractIdFromUrl(thumbnailMedium);
            const isSameUrlAsParentCollection = (thumbnailId === parentThumbnailId);
            if (isSameUrlAsParentCollection) {
                return withParsedThumbnail({
                    ...item,
                    thumbnail: visual,
                });
            }
            return item;
        }));
        return currentState.set(KEY_EDITABLE_DOCUMENTS, updatedItems);
    }
}

const store = new DocumentStore(Dispatcher);
export default store;
