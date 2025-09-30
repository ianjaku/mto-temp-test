import {
    Binder,
    DocumentCollection,
    EditorItem,
    IChecklistProgress,
    ICollectionInfo
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { WebData, WebDataState } from "@binders/client/lib/webdata";
import { LastEditInfo } from "@binders/client/lib/binders/create";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { UNDEFINED_LANG } from "@binders/client/lib/util/languages";
import { create } from "zustand";
import i18next from "@binders/client/lib/react/i18n";

export interface BinderAdditionalInfo extends LastEditInfo {
    _id: string;
}

export interface DocumentIsPublicInfo {
    isPublic: boolean;
    hasPublicAncestors: boolean;
    parentId?: string;
}


export interface BrowseStoreState {
    browsePaths: WebData<EditorItem[][]>;
    activeBrowsePath: WebData<EditorItem[]>;

    // Simple states
    activeCollection: string | null;
    activeParentCollections: unknown;
    activeDocument: string | null;
    bindersAdditionalInfo: Record<string, BinderAdditionalInfo>;
    documentsIsPublicInfo: Record<string, DocumentIsPublicInfo>;
    collectionInfo: ICollectionInfo | Record<string, never>;
    isTest: boolean;
    isReadonly: boolean;
    checklistProgresses: Record<string, IChecklistProgress>;
}

export interface BrowseStoreActions {
    // Path actions
    setBrowsePaths: (paths: WebData<EditorItem[][]>) => void;
    setActiveBrowsePath: (path: WebData<EditorItem[]>) => void;

    // Document/Collection actions
    setActiveCollection: (id: string | null) => void;
    setActiveParentCollections: (collections: unknown) => void;
    setActiveDocument: (id: string | null) => void;

    // Patch actions
    patchTitle: (id: string, languageCode: string, newTitle: string) => void;
    patchBinder: (item: EditorItem) => void;
    patchIsHidden: (collectionId: string) => void;

    // Info actions
    setBindersAdditionalInfo: (info: BinderAdditionalInfo[]) => void;
    setDocumentsIsPublicInfo: (info: Record<string, DocumentIsPublicInfo>) => void;
    updateIsPublicInfo: (id: string, isPublic: boolean, hasPublicAncestors?: boolean, parentId?: string) => void;
    setCollectionInfo: (info: ICollectionInfo) => void;
    setChecklistProgresses: (progresses: IChecklistProgress[]) => void;

    // Mode actions
    setTestMode: () => void;
    setReadonly: (readonly: boolean) => void;

    // WebData update helper
    updateWebDataState: <K extends keyof Pick<BrowseStoreState, "browsePaths" | "activeBrowsePath">>(
        key: K,
        updateFn: (webData: BrowseStoreState[K]) => BrowseStoreState[K]
    ) => void;

    // Reset action
    reset: () => void;
}

export type BrowseStore = BrowseStoreState & BrowseStoreActions;

// Helper functions for patching browse paths

const patchDocumentTitle = (item: Binder, languageCode: string, newTitle: string): Binder => {
    const updatedItem = { ...item };
    const languageIndex = updatedItem.languages.findIndex((lang) => {
        return lang.iso639_1 === languageCode;
    });
    if (languageIndex < 0) {
        throw new Error(i18next.t(TK.Edit_CantUpdateTitle));
    }
    updatedItem.languages[languageIndex].storyTitle = newTitle;
    return updatedItem;
};

const patchCollectionTitle = (item: DocumentCollection, languageCode: string, newTitle: string): DocumentCollection => {
    const updatedItem = { ...item };
    if (!updatedItem.titles) {
        return updatedItem;
    }
    const languageIndex = updatedItem.titles.findIndex((lang) => {
        return (lang.languageCode === languageCode) || (lang.languageCode === UNDEFINED_LANG);
    });
    if (languageIndex >= 0) {
        const foundItem = updatedItem.titles[languageIndex];
        foundItem.title = newTitle;

        if (foundItem.languageCode === UNDEFINED_LANG) {
            foundItem.languageCode = languageCode;
        }
    }
    return updatedItem;
};


const patchTitle = (browsePaths: EditorItem[][], id: string, languageCode: string, newTitle: string): EditorItem[][] => {
    return browsePaths.map(browsePath => {
        return browsePath.map(item => {
            if (item.id !== id) {
                return item;
            }
            const binderItem = item;
            const isDocument = binderItem.kind !== "collection";
            const patch: (i: EditorItem, l: string, n: string) => EditorItem = isDocument ? patchDocumentTitle : patchCollectionTitle;
            return patch(binderItem, languageCode, newTitle);
        });
    });
};

const patchIsHidden = (browsePaths: EditorItem[][], id: string): EditorItem[][] => {
    return browsePaths.map(browsePath => {
        return browsePath.map(item => {
            if (item.id !== id) {
                return item;
            }
            const binderItem = item;
            return { ...binderItem, isHidden: !binderItem.isHidden };
        });
    });
};

const initialState: BrowseStoreState = {
    browsePaths: new WebData(WebDataState.NOT_ASKED, null, ""),
    activeBrowsePath: new WebData(WebDataState.NOT_ASKED, null, ""),
    activeCollection: null,
    activeParentCollections: null,
    activeDocument: null,
    bindersAdditionalInfo: {},
    documentsIsPublicInfo: {},
    collectionInfo: {},
    isTest: false,
    isReadonly: false,
    checklistProgresses: {},
};

// Create the store
export const useBrowseStore = create<BrowseStore>()((set, get) => ({
    ...initialState,

    // Path actions
    setBrowsePaths: (paths) => set({ browsePaths: paths }),
    setActiveBrowsePath: (path) => set({ activeBrowsePath: path }),

    // Document/Collection actions
    setActiveCollection: (id) => set({ activeCollection: id }),
    setActiveParentCollections: (collections) => set({ activeParentCollections: collections }),
    setActiveDocument: (id) => set({ activeDocument: id }),

    // Patch actions

    patchTitle: (id, languageCode, newTitle) => {
        const { browsePaths } = get();
        const updatedPaths = browsePaths.lift(paths => patchTitle(paths, id, languageCode, newTitle));
        set({ browsePaths: updatedPaths });
    },

    patchBinder: (item) => {
        const { browsePaths } = get();
        const updatedPaths = browsePaths.lift(paths =>
            paths.map(browsePath =>
                browsePath.map(bpItem => {
                    return (item.id === bpItem.id) ?
                        { ...item, kind: bpItem.kind } as EditorItem :
                        bpItem;
                })
            )
        );
        set({ browsePaths: updatedPaths });
    },

    patchIsHidden: (collectionId) => {
        const { browsePaths } = get();
        const updatedPaths = browsePaths.lift(paths => patchIsHidden(paths, collectionId));
        set({ browsePaths: updatedPaths });
    },

    // Info actions
    setBindersAdditionalInfo: (info) => {
        const additionalInfo = (info || []).reduce((out: Record<string, BinderAdditionalInfo>, item: BinderAdditionalInfo) => {
            out[item._id] = item;
            return out;
        }, {});
        set({ bindersAdditionalInfo: additionalInfo });
    },

    setDocumentsIsPublicInfo: (info) => {
        const current = get().documentsIsPublicInfo;
        set({ documentsIsPublicInfo: { ...current, ...info } });
    },

    updateIsPublicInfo: (id, isPublic, hasPublicAncestors) => {
        const current = get().documentsIsPublicInfo;
        const newItem = { ...current[id], isPublic };
        if (hasPublicAncestors !== undefined) {
            newItem.hasPublicAncestors = hasPublicAncestors;
        }

        // Check potential children and update their hasPublicAncestors
        const children = Object.keys(current).reduce((res: Record<string, DocumentIsPublicInfo>, i) => {
            if (current[i].parentId === id) {
                res[i] = { ...current[i], hasPublicAncestors: isPublic };
            }
            return res;
        }, {});

        set({ documentsIsPublicInfo: { ...current, [id]: newItem, ...children } });
    },

    setCollectionInfo: (info) => set({ collectionInfo: info || {} }),

    setChecklistProgresses: (progresses) => {
        const checklistProgresses = (progresses || []).reduce((out: Record<string, IChecklistProgress>, info: IChecklistProgress) => {
            out[info.binderId] = info;
            return out;
        }, {});
        set({ checklistProgresses });
    },

    // Mode actions
    setTestMode: () => set({ isTest: true }),
    setReadonly: (readonly) => set({ isReadonly: readonly }),

    // WebData update helper
    updateWebDataState: (key, updateFn) => {
        set((state) => ({
            [key]: updateFn(state[key]),
        }));
    },

    // Reset action
    reset: () => set(initialState),
}));
