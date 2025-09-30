import { createStore, useStore } from "zustand";
import { Item } from "@binders/client/lib/clients/repositoryservice/v3/contract";

export type Ancestor = {
    item: Item;
    parentPaths: string[];
}

type ContentMapStoreActions = {
    loadCollectionAncestors: (ancestors: Ancestor[]) => void;
    loadLandingPageCollectionIds: (landingPageCollectionIds: ContentMapStoreState["landingPageCollectionIds"]) => void;
    loadLandingPageBinderIds: (landingPageCollectionIds: ContentMapStoreState["landingPageBinderIds"]) => void;
    setActiveCollectionId: (collectionId: string) => void;
};

type ContentMapStoreState = {
    actions: ContentMapStoreActions;
    activeCollectionId?: string;
    collectionAncestorIds: string[];
    landingPageCollectionIds: string[];
    landingPageBinderIds: string[];
};

type ContentMapStore = ContentMapStoreState & { actions: ContentMapStoreActions; }

const contentMapStore = createStore<ContentMapStoreState>(set => ({
    docsToEdit: [],
    landingPageCollectionIds: [],
    landingPageBinderIds: [],
    collectionAncestorIds: [],
    activeCollectionId: undefined,
    actions: {
        loadCollectionAncestors(collectionAncestors) {
            const ancestorIdsSet = collectionAncestors.reduce((reduced, ancestor) => {
                reduced.add(ancestor.item.id);
                ancestor.parentPaths.forEach(p => { reduced.add(p); });
                return reduced;
            }, new Set<string>());
            const collectionAncestorIds = Array.from<string>(ancestorIdsSet);
            set(prev => ({ ...prev, collectionAncestorIds }));
        },
        loadLandingPageCollectionIds(landingPageCollectionIds) {
            set(prev => ({ ...prev, landingPageCollectionIds }));
        },
        loadLandingPageBinderIds(landingPageBinderIds) {
            set(prev => ({ ...prev, landingPageBinderIds }));
        },
        setActiveCollectionId(activeCollectionId) {
            set(prev => ({ ...prev, activeCollectionId }));
        }
    },
}));

export function getContentMapStoreActions(): ContentMapStoreActions {
    return contentMapStore.getState().actions;
}

/** @deprecated Use useContentMapStoreState with a selector to **prevent unnecessary rerenders** and **don't select multiple props** */
export function useContentMapStoreState(): ContentMapStoreState;
export function useContentMapStoreState<T>(selector: (state: ContentMapStore) => T): T;
export function useContentMapStoreState<T>(selector?: (state: ContentMapStore) => T) {
    return useStore(contentMapStore, selector);
}
