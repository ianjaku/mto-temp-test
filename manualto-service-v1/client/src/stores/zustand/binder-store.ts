import * as Immutable from "immutable";
import { Ancestor, getContentMapStoreActions } from "./content-map-store";
import {
    Binder,
    BindersChunkedImageModule,
    BindersChunkedTextModule,
    CollectionTitle,
    DocumentAncestors,
    DocumentCollection,
    IAzureTranslation,
    IBinderStory,
    IBinderVisual,
    IThumbnail,
    Publication,
    PublicationFindResult,
    Story
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    CollectionSearchHitClient,
    ICollectionStory,
    IStoryWithTitle,
    ItemStory,
    PublicationSearchHitClient,
    isBinderStory
} from "../../binders/contract";
import { createStore, useStore } from "zustand";
import { getBinderId, toStoryWithTitle } from "../helpers/binder-helpers";
import { intersection, uniq, without } from "ramda";
import { AccountStoreGetters } from "./account-store";
import {
    FEATURE_LEGACY_READER_LANDING_PAGE
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { PermissionMap } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { UNDEFINED_LANG } from "@binders/client/lib/util/languages";
import { composeParentPath } from "../../utils/ParentPathHelper";
import { loadParentCollectionFromParentPath } from "../../binders/binder-loader";
import tokenStore from "@binders/client/lib/clients/tokenstore";

export type ActiveDocument = Binder | Publication;
export type ActiveDocumentWithModules = (Binder | Publication) & {
    documentType: "binder" | "publication";
    languageCodeForPreview: string;
    textModule: string[][];
    imageModule: IBinderVisual[][];
}

export type NormalizedReaderSearchResult = {
    totalHitCount: number;
    hits: (PublicationSearchHitClient | CollectionSearchHitClient)[];
    query?: string;
    isTruncated?: boolean;
    isTruncatedInScope?: boolean;
    isTruncatedOutsideScope?: boolean;
};

type IncomingActiveCollectionInfo = {
    id: string;
    activeCollection: DocumentCollection;
    items: Array<Story>;
    languagesUsed: string[];
    preferredLanguages: string[];
}
type IncomingActiveDocumentInfo = {
    documentType: string;
    languageCodeForPreview: string;
    document: ActiveDocument;
}

type IncomingParentCollectionInfo = {
    id: string;
    items: Array<Story>;
    preferredLanguages: string[];
}

type IncomingReaderItems = {
    publications: Array<IBinderStory>;
    collections: Array<ICollectionStory>;
    preferredLanguages: string[];
    languagesUsed: string[];
    ancestorObject: Record<string, string[]>;
}

type IncomingParentPathContext = {
    readableItems: string[];
    readableItemsPermissions: PermissionMap[];
    parentPathFromUri?: string[];
    itemId: string;
    ancestors: DocumentAncestors;
    parentTitle: string;
    triggerParentCollectionActivate: boolean;
    ratingEnabled: boolean;
    commentsEnabled: boolean;
    readConfirmationEnabled: boolean;
}

export type ActiveCollectionInfo = {
    id: string;
    thumbnail: IThumbnail;
    titles: Array<CollectionTitle>;
    items: Immutable.OrderedMap<string, IStoryWithTitle>;
}

export type ActiveParentCollection = {
    id: string,
    items: Immutable.OrderedMap<string, IStoryWithTitle>,
}

export type BinderStoreActions = {
    setActiveCollection: (activeCollectionInfo: IncomingActiveCollectionInfo) => void;
    setActiveDocument: (activeDocument: IncomingActiveDocumentInfo) => void;
    setParentCollection: (parentCollectionInfo: IncomingParentCollectionInfo) => void;
    setReaderItems: (readerItems: IncomingReaderItems) => void;
    unsetActiveCollection: () => void;
    unsetActiveDocument: () => void;
    setLoadingItemId: (itemId: string) => void;
    setNewerPublication: (newerPublication: PublicationFindResult) => void;
    setSearchResults: (searchResults: NormalizedReaderSearchResult) => void;
    setLastBrowsedParentId: (parentId: string) => void;
    setSelectedLanguage: (language: string) => void;
    setParentPathContext: (parentPathContext: IncomingParentPathContext) => void;
    setEntryPointItemId: (itemId: string) => void;
    setAvailableTranslations: (availableTranslations: IAzureTranslation[]) => void;
    setCollectionAncestors: (collectionAncestors: Ancestor[]) => void;
};

export type BinderStoreState = {
    activeCollectionInfo?: ActiveCollectionInfo;
    activeDocument?: ActiveDocument;
    activeDocumentLanguageCodeForPreview: string;
    activeDocumentType: "binder" | "publication";
    activeParentCollection: ActiveParentCollection;
    languagesUsed: string[];
    loadingItemIds: string[];
    summariesLoaded: boolean;
    collectionsLoaded: boolean;
    items?: Immutable.Map<string, IStoryWithTitle>;
    newerPublication?: PublicationFindResult;
    searchResults?: NormalizedReaderSearchResult;
    lastBrowsedParentId?: string;
    selectedLanguage?: string;
    readableItems?: string[];
    readableItemsPermissions?: PermissionMap[];
    parentPath: string[];
    parentTitle?: string;
    entryPointItemId?: string,
    availableTranslations?: IAzureTranslation[];
    collectionAncestors?: Ancestor[];
    ratingEnabled?: boolean;
    commentsEnabled?: boolean;
    readConfirmationEnabled?: boolean;
    ancestorsOfViewable?: DocumentAncestors,
};

const DEFAULT_MODULES = {
    i: "i1",
    t: "t1"
};

/**
 * @deprecated use hook functions instead <br/>
 * <b>WARNING: these methods does not subscribe to store changes</b>
 */
export const BinderStoreGetters = {
    getActiveCollectionInfo() {
        return getBinderStoreState().activeCollectionInfo;
    },
    getSelectedLanguage(): string | undefined {
        return getBinderStoreState().selectedLanguage;
    },
    getEntryPointItemId(): string | undefined {
        return getBinderStoreState().entryPointItemId;
    },
    getCollectionAncestors() {
        return getBinderStoreState().collectionAncestors;
    },
    getActiveViewable(): ActiveDocumentWithModules | undefined {
        const viewable = getBinderStoreState().activeDocument;
        const documentType = getBinderStoreState().activeDocumentType;
        const langCode = getBinderStoreState().activeDocumentLanguageCodeForPreview;
        return toActiveViewable(viewable, documentType, langCode);
    },
    getItem(itemId: string): IStoryWithTitle | undefined {
        const items: Immutable.Map<string, IStoryWithTitle> = getBinderStoreState().items;
        return items !== undefined ? items.get(itemId) : undefined;
    }
}

export type BinderStore = BinderStoreState & {
    actions: BinderStoreActions;
};

const binderStore = createStore<BinderStore>(set => ({
    activeCollectionInfo: undefined,
    activeDocument: undefined,
    activeDocumentLanguageCodeForPreview: undefined,
    activeDocumentType: undefined,
    activeParentCollection: undefined,
    collectionsLoaded: false,
    summariesLoaded: false,
    items: undefined,
    newerPublication: undefined,
    searchResults: undefined,
    languagesUsed: [],
    lastBrowsedParentId: undefined,
    selectedLanguage: undefined,
    readableItems: undefined,
    readableItemsPermissions: undefined,
    parentPath: [],
    loadingItemIds: [],
    parentTitle: undefined,
    actions: {
        setActiveCollection(activeCollectionInfo) {
            const { languagesUsed, items, preferredLanguages, id, activeCollection } = activeCollectionInfo;
            const storiesWithTitles = items.map(item => toStoryWithTitle(item as ItemStory, preferredLanguages));
            const itemMap = storiesWithTitles.reduce((reduced, item) => {
                if (!reduced.get(item.key)) {
                    return reduced.set(item.key, item);
                } else if (isBinderStory(item.original) && item.original.isMaster) {
                    return reduced.set(item.key, item);
                }
                return reduced;
            }, Immutable.OrderedMap<string, IStoryWithTitle>());
            getContentMapStoreActions().setActiveCollectionId(id);
            set(prev => ({
                ...prev,
                activeCollectionInfo: {
                    id,
                    thumbnail: activeCollection.thumbnail,
                    titles: activeCollection.titles,
                    items: itemMap,
                },
                languagesUsed: languagesUsed.filter(l => l.toLowerCase() !== UNDEFINED_LANG),
                loadingItemIds: without([id], getBinderStoreState().loadingItemIds),
            }));
        },
        unsetActiveCollection() {
            set(prev => ({
                ...prev,
                activeCollectionInfo: undefined,
                languagesUsed: [],
            }));
        },
        setActiveDocument(activeDocument: IncomingActiveDocumentInfo) {
            const { documentType, languageCodeForPreview, document } = activeDocument;
            set(prev => ({
                ...prev,
                activeDocumentType: documentType as "binder" | "publication",
                activeDocumentLanguageCodeForPreview: languageCodeForPreview,
                activeDocument: document,
                loadingItemIds: without([getBinderId(document)], getBinderStoreState().loadingItemIds),
            }));
        },
        unsetActiveDocument() {
            set(prev => ({
                ...prev,
                activeDocument: undefined,
                activeDocumentType: undefined,
                activeDocumentLanguageCodeForPreview: undefined,
            }));
        },
        setParentCollection(parentCollectionInfo: IncomingParentCollectionInfo) {
            const { id, items, preferredLanguages } = parentCollectionInfo;
            const parentColStoriesWithTitle = items.map(item => {
                return toStoryWithTitle(item as ItemStory, preferredLanguages);
            });
            const itemMap = parentColStoriesWithTitle.reduce((reduced, item) => {
                if (!reduced.get(item.key)) {
                    return reduced.set(item.key, item);
                } else if (isBinderStory(item.original) && item.original.isMaster) {
                    return reduced.set(item.key, item);
                }
                return reduced;
            }, Immutable.OrderedMap<string, IStoryWithTitle>());

            set(prev => ({
                ...prev,
                activeParentCollection: {
                    id,
                    items: itemMap,
                },
            }));
        },
        setReaderItems(incomingReaderItems: IncomingReaderItems) {
            const {
                publications: incomingPublications,
                collections: incomingCollections,
                preferredLanguages,
                languagesUsed,
                ancestorObject,
            } = incomingReaderItems;
            const publicationWithTitlesMap = incomingPublications.reduce((reduced, publication) => {
                const pubWithTitle = toStoryWithTitle(publication as ItemStory, preferredLanguages);
                return reduced.set(pubWithTitle.key, pubWithTitle);
            }, Immutable.Map<string, IStoryWithTitle>());
            const collectionsWithTitlesMap = incomingCollections.reduce((reduced, collection) => {
                if (collection.elements.length > 0) {
                    const colWithTitle = toStoryWithTitle(collection as ItemStory, preferredLanguages);
                    return reduced.set(colWithTitle.key, colWithTitle);
                }
                return reduced;
            }, Immutable.Map<string, IStoryWithTitle>());
            const newPublications = Immutable.Map<string, IStoryWithTitle>()
                .concat(publicationWithTitlesMap)
                .sortBy((item: IStoryWithTitle) => item.title, (l, r) => l.localeCompare(r))
                .sortBy((item: IStoryWithTitle) => item.kind !== "collection");

            const itemIds = Object.keys(ancestorObject);
            let readerItems: Immutable.Map<string, IStoryWithTitle>;

            if (
                !tokenStore.isPublic() || // if authenticated,
                AccountStoreGetters.features(FEATURE_LEGACY_READER_LANDING_PAGE) // or the legacy reader landing page is enabled,
            ) {
                // then show nested items in a nested way (on account of the filter with intersection below)
                readerItems = newPublications
                    .filter(item => item.kind !== "collection")
                    .concat(collectionsWithTitlesMap)
                    .sortBy(item => item.title, (l, r) => l.localeCompare(r))
                    .filter((item) => intersection(ancestorObject[item.original.id], itemIds).length === 0)
                    .sortBy(item => item.kind !== "collection")
                    .toOrderedMap();
            } else {
                // else, just show all items on which there's an acl in a flat way. This will bring up the public+advertised to the root of the landing page
                readerItems =
                    newPublications
                        .filter(item => item.kind !== "collection")
                        .concat(collectionsWithTitlesMap)
                        .sortBy(item => item.title, (l, r) => l.localeCompare(r))
                        .sortBy(item => item.kind !== "collection")
                        .toOrderedMap();
            }
            getContentMapStoreActions().loadLandingPageCollectionIds(
                incomingCollections.map(({ id }) => id),
            );
            getContentMapStoreActions().loadLandingPageBinderIds(
                incomingPublications.map(({ id }) => id),
            );
            set(prev => ({
                ...prev,
                items: readerItems,
                languagesUsed: languagesUsed.filter(l => l.toLowerCase() !== UNDEFINED_LANG),
                summariesLoaded: true,
                collectionsLoaded: true,
            }));
        },
        setLoadingItemId(itemId: string) {
            set(prev => ({
                ...prev,
                loadingItemIds: uniq([...getBinderStoreState().loadingItemIds, itemId]),
            }));
        },
        setNewerPublication(newerPublication: PublicationFindResult) {
            set(prev => ({
                ...prev,
                newerPublication,
            }));
        },
        setSearchResults(searchResults: NormalizedReaderSearchResult) {
            set(prev => ({
                ...prev,
                searchResults,
            }));
        },
        setLastBrowsedParentId: (lastBrowsedParentId: string) => {
            set(prev => ({
                ...prev,
                lastBrowsedParentId,
            }));
        },
        setSelectedLanguage: (language: string) => {
            set(prev => ({
                ...prev,
                selectedLanguage: language,
            }));
        },
        setParentPathContext: (parentPathContext: IncomingParentPathContext) => {
            const {
                readableItems,
                readableItemsPermissions,
                parentPathFromUri,
                itemId,
                ancestors,
                parentTitle,
                triggerParentCollectionActivate,
                ratingEnabled,
                commentsEnabled,
                readConfirmationEnabled,
            } = parentPathContext;

            const loadingItemIds = getBinderStoreState().loadingItemIds;
            if (loadingItemIds.length && !loadingItemIds.includes(itemId)) {
                // eslint-disable-next-line no-console
                console.warn(`dropping parent path context for item ${itemId} update because it doesn't relate to the currently loading items (${loadingItemIds.join()})`);
                return;
            }
            const itemsArr = getBinderStoreState().items?.toArray();
            const lastBrowsedParentId = getBinderStoreState().lastBrowsedParentId;
            const parentPath = composeParentPath(itemId, ancestors, parentPathFromUri, readableItems, itemsArr, lastBrowsedParentId);
            if (triggerParentCollectionActivate) {
                loadParentCollectionFromParentPath(parentPath);
            }
            set(prev => ({
                ...prev,
                parentPath,
                parentTitle,
                lastBrowsedParentId: undefined,
                readableItemsPermissions,
                readableItems,
                ratingEnabled,
                commentsEnabled,
                readConfirmationEnabled,
                ancestorsOfViewable: ancestors,
            }));
        },
        setEntryPointItemId: (entryPointItemId: string) => {
            set(prev => ({
                ...prev,
                entryPointItemId,
            }));
        },
        setAvailableTranslations: (availableTranslations: IAzureTranslation[]) => {
            set(prev => ({
                ...prev,
                availableTranslations,
            }));
        },
        setCollectionAncestors: (collectionAncestors: Ancestor[]) => {
            getContentMapStoreActions().loadCollectionAncestors(collectionAncestors);
            set(prev => ({
                ...prev,
                collectionAncestors,
            }));
        },
    },
}));

export const useBinderStoreLoaded = () => {
    const { summariesLoaded, collectionsLoaded } = useBinderStoreState(state => ({
        summariesLoaded: state.summariesLoaded,
        collectionsLoaded: state.collectionsLoaded,
    }));
    return summariesLoaded && collectionsLoaded;
};

export const useActiveViewable = (): ActiveDocumentWithModules | null => {
    const viewable = useBinderStoreState(state => state.activeDocument);
    const documentType = useBinderStoreState(state => state.activeDocumentType);
    const langCode = useBinderStoreState(state => state.activeDocumentLanguageCodeForPreview);
    return toActiveViewable(viewable, documentType, langCode);
}

export const useActiveCollectionItems = (): IStoryWithTitle[] | undefined => {
    const activeCollectionInfo = useBinderStoreState(store => store.activeCollectionInfo);
    return activeCollectionInfo ? activeCollectionInfo.items.toArray() : undefined;
}

/**
 * @deprecated use hook functions instead
 */
export function getBinderStoreActions(): BinderStoreActions {
    return binderStore.getState().actions;
}

function getBinderStoreState(): BinderStoreState {
    return binderStore.getState();
}

/** @deprecated Use {@link useBinderStoreState} with a selector to **prevent unnecessary rerenders** and **don't select multiple props** */
export function useBinderStoreState(): BinderStoreState;
export function useBinderStoreState<T>(selector: (state: BinderStore) => T): T;
export function useBinderStoreState<T>(selector?: (state: BinderStore) => T) {
    return useStore(binderStore, selector);
}

export function useBinderStoreActions(): BinderStoreActions {
    return useBinderStoreState(state => state.actions);
}

const toActiveViewable = (
    viewable: ActiveDocument,
    documentType: "binder" | "publication",
    langCode: string
): ActiveDocumentWithModules | null => {
    if (!viewable) {
        return null;
    }
    let activeTextModuleKey: string;
    if (documentType === "publication") {
        const publication = viewable as Publication;
        activeTextModuleKey = publication.language.modules[0];
    } else if (documentType === "binder") {
        const binder = viewable as Binder;
        const activeLanguage = binder.languages.filter(l => l.iso639_1 === langCode)[0];
        activeTextModuleKey = activeLanguage ? activeLanguage.modules[0] : DEFAULT_MODULES.t;
    }
    let textModules: BindersChunkedTextModule[];
    let imageModules: BindersChunkedImageModule[];
    if (["binder", "publication"].includes(documentType)) {
        const binderOrPublication = viewable as (Binder | Publication)
        textModules = binderOrPublication.modules.text.chunked;
        imageModules = binderOrPublication.modules.images.chunked;
    }
    return {
        ...viewable,
        documentType,
        languageCodeForPreview: langCode,
        textModule: textModules.filter(m => m.key === activeTextModuleKey)[0].chunks,
        imageModule: imageModules.filter(m => m.key === "i1")[0].chunks,
    }
}
