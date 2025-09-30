import { AncestorItem, AncestorTree } from "../../../ancestors";
import { IBoundary, IPartialBoundary } from "../../../highlight/highlight";
import {
    IVisualFormatSpec,
    VisualKind
} from "../../imageservice/v1/contract";
import { IPDFExportOptions } from "../../exportservice/v1/contract";
import { ISemanticLink } from "../../routingservice/v1/contract";
import { PermissionName } from "../../authorizationservice/v1/contract";
import { Response } from "express";
import { TrackingServiceContract } from "../../trackingservice/v1/contract";
import { User } from "../../userservice/v1/contract";

export enum ItemKind {
    Binder = "binder",
    Collection = "collection",
    Publication = "publication",
}

export enum BinderApprovalStatus {
    EMPTY = "EMPTY", // There are no approvals for this document
    REJECTED = "REJECTED", // When one or more chunks have been rejected
    APPROVED = "APPROVED", // When all chunks have been approved
    INCOMPLETE = "INCOMPLETE", // When some chunks have been approved, but not all
}

export const FIND_BINDERS_STATUSES_MAX_ALLOWED_RESULTS = 5000;

export interface FindBindersStatusesQueryParams extends Record<string, string | number> {
    maxResults?: string | number; // Whole number string
    minCreationDate?: string | number; // Date string
    format?: string; // parsed in handleAccessControl (common service)
}

export interface BinderStatus {
    id: string;
    title: string; // In master language
    chunkCount: number;
    lastModificationDate: Date;
    lastPublicationDate: Date;
    isPublic: boolean;
    created: Date;
    hasDraft: boolean;
    approvalStatus: BinderApprovalStatus;
    openThreadCount: number;
    editorLink: string;
    publishedLanguages: string[];
    draftLanguages: string[];
    binderCreationDate?: Date;
}

export type BinderStatusForAccount = BinderStatus & {
    accountId: string;
}

export interface BinderStatusFilter {
    accountId?: string;
    updatedAfter?: Date;
}

// Used in the summarizePublicationsForAccount endpoint
export interface PublicationsSummaryItem {
    DocumentId: string;
    Title: string;
    Language: string;
    PublicationDate: string;
    EditorLink: string;
    // Also has ancestors, in format [ancestorId1, ancestorId2]
    ParentId1?: string;
    ParentId2?: string;
    ParentId3?: string;
    ParentId4?: string;
    ParentId5?: string;
    ParentId6?: string;
    ParentId7?: string;
    ParentId8?: string;
    // More than 8 parents can be present, but typing that in TS is too unreadable
    // feel free to add parentId9, 10, ... as necessary
}

export interface DraftSummaryItem {
    DocumentId: string;
    Title: string;
    Language: string;
    EditorLink: string;
    ParentId1?: string;
    ParentId2?: string;
    ParentId3?: string;
    ParentId4?: string;
    ParentId5?: string;
    ParentId6?: string;
    ParentId7?: string;
    ParentId8?: string;
}


export interface ITTSTrack {
    identifier: string;
    language: string;
    html: string;
    audioFileUrl: string;
    boundaries: IBoundary[];
}

export interface SoftDeletedItemsSearchResult {
    items: Array<Binder | DocumentCollection>;
    parents: { [keys: string]: AncestorItem[] };
    users: Array<User>;
}

export interface ITTSVoiceOptions {
    language: string;
    name?: string;
    gender?: "male" | "female";
}

export interface ITTSGenerateResponse {
    audioFileUrl: string;
    boundaries: IPartialBoundary[];
}

export interface IThumbnail {
    medium: string;
    thumbnail?: string;
    fitBehaviour: string;
    bgColor: string;
    rotation?: string;
    urlToken?: string;
    ancestorCollectionId?: string;
    id?: string;
}

export interface Author {
    title: string;
    name: string;
}

export interface Language {
    iso639_1: string;
    modules: Array<string>;
    storyTitle: string;
    storyTitleRaw: string;
    priority?: number;
    isDeleted?: boolean;
}

export interface BinderLinks {
    indexPairs: Array<Array<string>>;
}

export interface BindersModuleMeta {
    key: string;
    type: string;
    format: "chunked";
    iso639_1?: string;
    markup: "none" | "richtext" | "url" | "object";
    caption: string;
    lastModifiedDate?: Date | string;
    lastModifiedBy?: string;
    lastModifiedByName?: string;
    isDeleted?: boolean;
    pdfExportOptions?: IPDFExportOptions;
}

export interface CollectionElementMap {
    [collectionId: string]: CollectionElement[];
}

export interface IDescendantsMap {
    [level: number]: CollectionElement[]
}

export interface BindersChunkedTextModule {
    key: string;
    iso639_1: string;
    chunks: Array<Array<string>>;
    json?: Array<string>;
    editorStates: Array<string>;
}

export interface BindersTextModule {
    chunked: Array<BindersChunkedTextModule>;
}

export type IBinderVisual = Partial<VisualSettings> & {
    id: string;
    url?: string;
    // MT-3388 is optional in some cases
    // binders-repository-service-v3/app/src/repositoryservice/service.ts L1227
    formatUrls?: IVisualFormatSpec[];
    manifestUrls?: string[];
    status: string;
    kind?: VisualKind;
    contentKeyId?: string;

    token?: string;

    // Used as an access token for the visual's Azure Storage container
    sasToken?: string;

    startTimeMs?: number;
    endTimeMs?: number;
};

export interface BindersChunkedImageModule {
    key: string;
    chunks: Array<Array<IBinderVisual>>;
}

export interface BindersImageModule {
    chunked: Array<BindersChunkedImageModule>;
}

export type BinderContentModuleName = "text" | "images";

export interface BinderModules {
    meta?: Array<BindersModuleMeta>;
    text?: BindersTextModule;
    images?: BindersImageModule;
}

export interface IChunkCurrentPositionLog {
    createdAt: number;
    position: number;
    updatedAt: number;
    uuid: string;
    targetId: string[];
}

export interface IBinderLog {
    current: IChunkCurrentPositionLog[];

    /**
     * If this property exists, the binder log was restored from the source
     */
    restoredFrom?: "binder" | "publication";

    /**
     * Describes the age difference before restore
     */
    restoreAgeInfo?:
        // source was older than the target (i.e. if restored from binder, binder was older than the publication)
        "sourceOlder" |
        // target was older than the source (i.e. if restored from binder, publication was older than the binder)
        "targetOlder" |
        // target was published within 30s of the source
        "similarAge" |
        // publication dates were equal
        "sameAge";

    /**
     * Describes the chunk count difference before restore
     */
    restoreChunksCountInfo?:
        // source had more chunks than the target (i.e. if restored from binder, binder had more chunks than the publication)
        "sourceMore" |
        // target had more chunks than the source (i.e. if restored from binder, publication had more chunks than the binder)
        "targetMore" |
        // number of chunks was equal
        "sameChunks";
}

export type InheritedOwnership = {
    type: "inherited";
};
export type OverriddenOwnership = {
    type: "overridden";
    ids: string[];
};
/**
 * Defines the ownership model for a document or collection
 */
export type Ownership = InheritedOwnership | OverriddenOwnership;
export const DEFAULT_OWNERSHIP: Ownership = {
    type: "inherited",
};

export const isOverriddenOwnership = (ownership: Ownership): ownership is OverriddenOwnership =>
    ownership.type === "overridden";

export const isUserOwner = (owner: Owner): owner is UserOwner => "login" in owner;

export type UserOwner = {
    id: string;
    name: string;
    login: string;
};
export type GroupOwner = {
    id: string;
    name: string;
};
export type Owner = UserOwner | GroupOwner;
export type ItemOwnershipType = Ownership["type"];
export type DetailedItemOwnership = {
    itemId: string,
    type: ItemOwnershipType,
    owners: Owner[];
    ancestorsWithOwnership?: InheritedOwnershipSettingsItem[];
};
export type ItemOwnership = Ownership;

export type Binder = {
    accountId?: string;
    /**
    * An unordered list of parent ids from root to direct parent, available only for binders that have parents
    * The order of the ancestor Ids is random because of how elastic handles an array of terms
    */
    ancestorIds?: string[];
    authorIds: Array<string>;
    authors: Array<Author>;
    binderLog?: IBinderLog;
    bindersVersion: string;
    created?: Date;
    deletedById?: string;
    deletedGroupCollectionId?: string;
    deletionTime?: Date;
    hasPublications?: boolean;
    id?: string;
    isInstance?: boolean;
    languages: Array<Language>;
    /**
    * @deprecated, use lastModifiedDate of the meta modules (getBinderLastModifiedDate helper to get the latest)
    */
    lastModified?: Date;
    lastModifiedBy?: string;
    lastModifiedByName?: string;
    links: BinderLinks;
    modules: BinderModules;
    ownership?: Ownership;
    showInOverview?: boolean;
    storedVersion?: string;
    thumbnail: IThumbnail;
};

export type ShowDeletedOptions = "show-all" | "show-deleted" | "show-non-deleted"

export interface DeleteFilter {
    show?: ShowDeletedOptions
    deletedById?: string;
    dateRange?: {
        from?: Date | string;
        until?: Date | string;
    },
    // From the items that were recursively deleted, only return the topmost collection
    hideRecursiveDeleteDescendants?: boolean;
}

export interface BinderFilter extends ItemFilter {
    summary?: boolean;
    preferredLanguages?: Array<string>;
    softDelete?: DeleteFilter;
    deletedGroupCollectionId?: string;
    minCreatedDate?: Date; // Only return binders created after this date

    /**
     * For an item to be included, they need to, for every filter:
     *   - have their "_id" in this list OR have a parent with it's id in that list
     *
     * Example 1:
     *  Imagine the structure "A -> B -> C"
     *  When passing [[A]], then ALL three elements will match because (A is included, B is a child of A which is included, C is a child of B which is included)
     *  When passing [[A], [C]], then only C will match, because even though all items match for "[A]", only C will pass the second filter "[C]"
     *
     * Example 2:
     *  To fetch all items that are in collection with id "XXX", you pass:
     *    [["XXX"]]
     *
     *  To fetch all items that are in a collection, that user X has read access to:
     *    [["XXX"], idsWithReadAcls]
     */
    hierarchicalIncludeFilters?: HierarchicalFilter[];

    // The same as "hierarchicalIncludeFilter" but all matches will be excluded
    hierarchicalExcludeFilters?: HierarchicalFilter[];

}

export interface ReaderItemsFilter {
    summary?: boolean;
    preferredLanguages?: Array<string>;
    domain?: string;
}

export interface PublicationFilter extends ItemFilter {
    summary?: boolean;
    preferredLanguages?: Array<string>;
    domain?: string;
    isActive?: number;
    isActiveOrHasViews?: boolean;

    /**
     * For an item to be included, they need to, for every filter:
     *   - have their "_id" or "binderId" in this list OR have a parent with it's id in that list
     *
     *  !! The publication filter also matches "binderId" on top of "_id" and ancestorIds
     *
     * Example 1:
     *  Imagine the structure "A -> B -> C"
     *  When passing [[A]], then ALL three elements will match because (A is included, B is a child of A which is included, C is a child of B which is included)
     *  When passing [[A], [C]], then only C will match, because even though all items match for "[A]", only C will pass the second filter "[C]"
     *
     * Example 2:
     *  To fetch all items that are in collection with id "XXX", you pass:
     *    [["XXX"]]
     *
     *  To fetch all items that are in a collection, that user X has read access to:
     *    [["XXX"], idsWithReadAcls]
     */
    hierarchicalIncludeFilters?: HierarchicalFilter[];

    // The same as "hierarchicalIncludeFilter" but all matches will be excluded
    hierarchicalExcludeFilters?: HierarchicalFilter[];
}

// A list of item ids in the document tree structure
// Every item id represents itself, and all it's children
export type HierarchicalFilter = string[];

export interface ItemFilter {
    // Match only the items with these ids
    ids?: string[];

    binderId?: string;
    binderIds?: string[];

    accountId?: string;
    accountIds?: string[];

    domain?: string;
    domainCollection?: string;

    languageCodes?: Array<string>;

    showInOverview?: boolean;

    /**
     * For an item to be included, they need to, for every filter:
     *   - have their "_id" in this list OR have a parent with it's id in that list
     *   - If it's a publication, have the "binderId" value or any of the above in the list
     *
     * Example 1:
     *  Given the document structure "A -> B -> C"
     *  When passing [[A]], then ALL three elements will match because (A is included, B is a child of A which is included, C is a child of B which is included)
     *  When passing [[A], [C]], then only C will match, because even though all items match for "[A]", only C will pass the second filter "[C]"
     *
     * Example 2:
     *  To fetch all items that are in collection with id "XXX", you pass:
     *    [["XXX"]]
     *
     *  To fetch all items that are in a collection, that user X has read access to:
     *    [["XXX"], idsWithReadAcls]
     */
    hierarchicalIncludeFilters?: HierarchicalFilter[];

    // The same as "hierarchicalIncludeFilter" but all matches will be excluded
    hierarchicalExcludeFilters?: HierarchicalFilter[];
}

export interface CollectionFilter extends ItemFilter {
    pruneEmpty?: boolean;
    rootCollections?: Array<string>;
    itemIds?: Array<string>;
    softDelete?: DeleteFilter;


    /**
     * For an item to be included, they need to, for every filter:
     *   - have their "_id" in this list OR have a parent with it's id in that list
     *
     * Example 1:
     *  Imagine the structure "A -> B -> C"
     *  When passing [[A]], then ALL three elements will match because (A is included, B is a child of A which is included, C is a child of B which is included)
     *  When passing [[A], [C]], then only C will match, because even though all items match for "[A]", only C will pass the second filter "[C]"
     *
     * Example 2:
     *  To fetch all items that are in collection with id "XXX", you pass:
     *    [["XXX"]]
     *
     *  To fetch all items that are in a collection, that user X has read access to:
     *    [["XXX"], idsWithReadAcls]
     */
    hierarchicalIncludeFilters?: HierarchicalFilter[];

    // The same as "hierarchicalIncludeFilter" but all matches will be excluded
    hierarchicalExcludeFilters?: HierarchicalFilter[];
}

export interface PublicationAndCollectionFilter {
    ids?: Array<string>;
    binderIds?: Array<string>;
    summary?: boolean;
    preferredLanguages?: Array<string>;
    domain?: string;
}

export interface BinderSummary {
    id: string;
    accountId: string;
    bindersVersion: string;
    thumbnail: IThumbnail;
    languages: Array<Language>;
    kind?: string;
    isInstance?: boolean;
    hasPublications?: boolean;
    modules: BinderModules;
    showInOverview?: boolean;
    deletionTime?: Date;
    ancestorIds?: string[];
}

export interface PublicationSummary {
    id: string;
    binderId: string;
    accountId?: string;
    thumbnail: IThumbnail;
    language: Language;
    isPublished: boolean;
    publicationDate: Date;
    isHidden?: boolean;
    isActive?: boolean;
    chunkCount?: number;
    viewsSummary?: IViewsSummary;
    publishedBy?: string;
    unpublishDate?: Date;
    isMaster?: boolean;
    showInOverview?: boolean;
    ancestorIds?: string[];
}

export interface IViewsSummary {
    [userId: string]: number;
}

export type BinderFindResult = Binder | BinderSummary;

export type PublicationFindResult = Publication | PublicationSummary;

export interface BinderSearchResultOptions {
    maxResults: number;
    orderBy?: string;
    ascending?: boolean;
    permissionName?: PermissionName;
    preferredLanguages?: Array<string>;
    strictLanguages?: Array<string>; // Only search in sections of this language
    showIsHidden?: boolean;
    omitContentModules?: boolean;
    includeViews?: boolean;
    includeChunkCount?: boolean;
    summary?: boolean;
    pagingOffset?: number;
    scopeCollectionId?: string;
}

export interface IMultiSearchOptions {
    isReadOnlyMode?: boolean;
    prioritizedScopeCollectionId?: string;
}

export interface IItemSearchOptions {
    binderSearchResultOptions?: BinderSearchResultOptions,
    cdnnify?: boolean;
    isReadOnlyMode?: boolean;
    skipPopulateVisuals?: boolean;
    skipInstanceDetermination?: boolean;
    ancestorThumbnailsOptions?: IAncestorThumbnailsOptions;
    includeTotalPublicDocumentsCount?: boolean;
    includeVisualsStatus?: boolean;
    readerScope?: string;
    resolvePublishedBy?: boolean;
    skipCache?: boolean;
}

export interface IGetCollectionQueryOptions {
    inheritAncestorThumbnails?: boolean;
    cdnifyThumbnails?: boolean;
    accountId?: string;
}

export interface IAncestorThumbnailsOptions {
    inheritAncestorThumbnails?: boolean;
    directParentCollectionId?: string;
}

export interface SearchResult<I extends (BinderSearchHit | CollectionSearchHit | PublicationSearchHit)> {
    totalHitCount: number;
    hits: I[];
    isTruncated?: boolean;
    isTruncatedInScope?: boolean;
    isTruncatedOutsideScope?: boolean;
}
export type BinderSearchResult = SearchResult<BinderSearchHit>;
export type CollectionSearchResult = SearchResult<CollectionSearchHit>;
export type PublicationSearchResult = SearchResult<PublicationSearchHit>;

export type EditorSearchHit = BinderSearchHit | CollectionSearchHit;
export type ReaderSearchHit = PublicationSearchHit | CollectionSearchHit;

export type ReaderItemSearchResult = SearchResult<ReaderSearchHit>;
export type EditorItemSearchResult = SearchResult<EditorSearchHit>;

export type ItemSearchHit = PublicationSearchHit | CollectionSearchHit | BinderSearchHit;
export type ItemSearchResult = SearchResult<ItemSearchHit>;

export interface CollectionSearchHit {
    score: number;
    collection: DocumentCollection;
    fieldHits: FieldSearchHits[];
    languageCode?: string;
}

export interface FieldSearchHits {
    field: string;
    contexts: string[];
}

export interface PublicationSearchHit {
    score: number;
    publicationSummary: PublicationSummary;
    fieldHits: FieldSearchHits[];
}

export interface BinderSearchHit {
    score: number;
    binderSummary: BinderSummary;
    fieldHits: FieldSearchHits[];
}

export type HitType = (BinderSearchHit | CollectionSearchHit | PublicationSearchHit);

export const isCollectionHitType = (hit: HitType): hit is CollectionSearchHit => "collection" in hit;
export const isBinderHitType = (hit: HitType): hit is BinderSearchHit => "binderSummary" in hit;
export const isPublicationHitType = (hit: HitType): hit is PublicationSearchHit => "publicationSummary" in hit;

export interface Translation {
    languageCode: string;
    publicationId: string;
}

export interface Publication {
    id?: string;
    binderId: string;
    accountId: string;
    // A list of all parent collection ids, only present on active publications (when isActive is 1)
    ancestorIds?: string[];
    bindersVersion: string;
    binderLog?: IBinderLog;
    thumbnail: IThumbnail;
    language: Language;
    translations?: Translation[];
    links: BinderLinks;
    modules: BinderModules;
    lastModified?: Date;
    publicationDate: Date;
    publishedBy?: string;
    unpublishDate?: Date;
    isActive: boolean;
    isMaster?: boolean;
    showInOverview?: boolean;
    domainCollectionId?: string;
    isHidden?: boolean;
    viewsSummary?: IViewsSummary;
    authorIds: string[];
}

export interface CollectionElement {
    kind: string;
    key: string;
    isInstance?: boolean;
    isPublished?: boolean;
}

export interface CollectionTitle {
    languageCode: string;
    title: string;
}

export type DocumentCollection = {
    accountId: string;
    ancestorIds?: string[]; // A list of parent ids, ordered from root to direct parent. Only available on collections that have parents
    created?: Date;
    deletedById?: string;
    deletedElements?: Array<CollectionElement>;
    deletedGroupCollectionId?: string;
    deletedGroupCount?: number;
    deletionTime?: Date;
    domainCollectionId?: string;
    elements: Array<CollectionElement>;
    hasPublications?: boolean;
    id?: string;
    isHidden?: boolean;
    isInstance?: boolean;
    isRootCollection: boolean;
    kind?: "collection";
    lastModified: Date;
    ownership?: Ownership;
    readonly?: boolean;
    showInOverview?: boolean;
    thumbnail: IThumbnail;
    titles: Array<CollectionTitle>;
    totalPublicDocuments?: number;
};

export type DocumentAncestors = { [keys: string]: string[] };

export interface DocumentResourceDetails {
    id: string;
    accountId: string;
    ancestorDocuments: DocumentAncestors;
}

export interface AccountTotals {
    documentCount: number;
    collectionCount: number;
}

export interface IBinderFeedback {
    id: string;
    binderId: string;
    publicationId: string;
    userId: string;
    userLogin?: string;
    userName?: string;
    message?: string;
    rating?: number;
    isAnonymous?: boolean;
    accountId: string;
    created: Date;
    updated: Date;
}

export interface ExportedBinderFeedback {
    Id: string;
    BinderId: string;
    PublicationId: string;
    UserLogin: string;
    UserName: string;
    Message: string | null;
    Rating: number | null;
    CreatedDate: string;
    UpdatedDate: string;
}

export type FeedbackParams = {
    isAnonymous: boolean;
    rating?: number;
    message?: string;
}

export enum ContentChunkKind {
    Html,
    Feedback,
    Checklist,
    MadeByManualTo,
    TitleChunk,
    Hidden,
    ReadConfirmation,
}


export interface ICollectionInfo {
    collection?: DocumentCollection;
    childCollectionSummaries: { [collectionId: string]: ICollectionSummary },
}

export interface ICollectionSummary {
    collectionId: string;
    collections: number;
    publishedDocuments: number;
    unpublishedDocuments: number;
}

export interface ICollectionElementsWithInfo {
    items: Array<Story>;
    languagesUsed: string[];
    accountHasPublications?: boolean;
}

export interface CollectionElementsWithInfoOptions {
    cdnnify?: boolean;
    preferredLanguageCodes?: string[];
}

export interface IPublicationsWithInfo {
    publications: Array<Publication | PublicationSummary>;
    languagesUsed: string[];
}

export interface IAzureTranslation {
    name: string;
    nativeName: string;
    dir: "ltr" | "rtl";
    code: string;
}

export enum ExportContentMode {
    pdf,
    xml
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IExportContentOptions {
    mode: ExportContentMode
}

export interface IChecklist {
    id?: string
    binderId: string;
    chunkId: string;
    performed: boolean;
    performedHistory: IChecklistPerformedHistory[];
}

export interface IChecklistAction {
    checklistId: string;
    binderId: string;
    chunkId: string;
    performed: boolean;
    performedDate: string | Date;
    performedByUserId: string;
    step?: number;
    publicationId?: string;
}

export interface IChecklistProgress {
    binderId: string,
    performed: number;
    total: number;
    lastUpdated?: Date;
}

export interface IChecklistConfig {
    id?: string
    binderId: string;
    chunkId: string;
    isActive: boolean;
}

export interface IChecklistPerformedHistory {
    lastPerformedByUserId: string;
    lastPerformedDate: Date;
    performed: boolean;
    lastPerformedByUserName?: string;

    /**
     * "step": At time of action, first checkbox (the one with the lowest chunk position) in a binder is 0, second is 1, .
     *         Optional, because some older actions might lack the data necessary to calculate steps
     */
    step?: number;

    /**
     * The publication on which the checklist action was performed.
     */
    publicationId?: string;
}

export type Item = Binder | BinderSummary | Publication | PublicationSummary | DocumentCollection;
export type ItemWithImagesModule = Binder | BinderSummary | Publication;

export function hasAncestorIdsProp(item: Item): item is Item & { ancestorIds: string[] } {
    return "ancestorIds" in item;
}

// Used by the reader, as a raw result from the API call
export type Story = (Publication | DocumentCollection) & {
    kind: string;
};

// Used by the reader, as a publication-specific format that has some more info
export interface IBinderStory {
    id: string;
    thumbnail: IThumbnail;
    languages: Array<Language>;
    publicationIds: string[];
    isMaster: boolean;
}

export type EditorItem = (Binder | DocumentCollection) & {
    kind?: string;
    isHidden?: boolean;
}

export type InheritedSettingsItem = {
    id: string;
    title: string | null;
    isCollection: boolean;
    access?: ItemConfigAccessType;
}

export type InheritedOwnershipSettingsItem = InheritedSettingsItem & {
    owners?: Owner[];
}

export enum ApprovedStatus {
    APPROVED = "approved",
    REJECTED = "rejected",
    UNKNOWN = "unknown",
}

export interface IChunkApproval {
    uuid: string;
    binderId: string;
    chunkId: string;
    chunkLastUpdate: number;
    chunkLanguageCode: string;
    approved: ApprovedStatus;
    approvedByUser: string;
    approvedAt: number;
}

export interface IDuplicationResult<I extends Item> {
    duplicatedItem: I;
    duplicatedItemsIdPairs?: string[][];
}

export type BatchItemFilterFunction<T> = { batchProcessing: true, process: ItemBatchFilterProcess<T> };
export type NonBatchItemFilterFunction<T> = { batchProcessing?: false, process: ItemFilterProcess<T> };
export type ItemFilterFunction<T> =
    BatchItemFilterFunction<T> |
    NonBatchItemFilterFunction<T>;

export type ItemFilterProcess<T> = (item: T) => Promise<boolean>;
export type ItemBatchFilterProcess<T> = (items: Array<T>) => Promise<Array<T>>;

export const isBatchItemFilterFunction = <T>(f: ItemFilterFunction<T>): f is BatchItemFilterFunction<T> => {
    return f.batchProcessing;
};


export enum RecursiveErrors {
    MISSING_LANGUAGE = "missing_language",
    INVALID_PUBLICATION = "invalid_publication",
    EXCEEDED_MAX_NUMBER = "exceeded_max_number_items",
    GIVEN_ID_IS_ROOT_COLLECTION = "given_id_is_root_collection",
    INSTANCES_EXIST = "instances_exist",
    ACTIVE_PUBLICATIONS_EXISTS = "active_publication_exists",
    UNKNOWN_ERROR = "unknown_error",
    BINDER_HAS_PUBLICATIONS = "binder_has_publications",
    COLLECTION_NOT_EMPTY = "collection_not_empty",
    UNSUPORTED_LANGUAGE = "unsuported_language",
    COGNITIVE_API_TIMEOUT = "cognitive_api_timeout",
    MISSING_TITLE = "missing_title",
    NOTHING_TO_PUBLISH = "nothing_to_publish",
    NOTHING_TO_UNPUBLISH = "nothing_to_unpublish",
    MISSING_APPROVALS = "missing_approvals",
    MASTER_LANGUAGE_NOT_SET = "master_language_not_set"
}

export const MAXIMUM_NUMBER_OF_ITEMS = 250;


export interface RecursiveUnpublishSummaryResult {
    binderId: string,
    languageCode: string,
}


export interface RecursiveDeleteSummaryResult {
    binderId: string,
}

export interface RecursiveOperationError {
    error: RecursiveErrors,
    itemId?: string,
    languageCode?: string,
    isBinder?: boolean,
    itemTitle?: string
}

export interface RecursiveOpeartionResult<T> {
    results: T[]
    errors: RecursiveOperationError[],
    totalItemsInSubtree?: number;
    totaldocumentsInSubtree?: number,
}

export enum RecursiveAction {
    DELETE = "Delete",
    PUBLISH = "Publish",
    UNPUBLISH = "Unpublish",
    TRANSLATE = "Translate"
}

export interface IRecursiveAction {
    id: "delete" | "publish" | "unpublish" | "translate",
    type: RecursiveAction,
    i18nKeys: {
        action: string,
        confirmation: string
    },
    requiresExplicitConfirmation?: boolean,
    icon: string,
    availableLanguagesFilter?: (languageCode: string) => boolean;
}

export interface ValidationResult {
    valid: boolean;
    errors: RecursiveOperationError[];
    affectedItemsCount?: number;
    warnings?: RecursiveOperationError[];
}


export interface LanguageSummary {
    languageCode: string,
    atLeastOneCanPublish?: boolean;
    atLeastOneCanUnpublish?: boolean;
}

export enum MTEngineType {
    Azure,
    Google,
    Deepl
}

export interface SoftDeletedItemsFilter {
    scopeCollectionId?: string;
    deletedById?: string;
    dateRange?: {
        from?: Date | string;
        until?: Date | string;
    }
}

export interface RelabelResult {
    publications: Publication[];
    semanticLinks: ISemanticLink[];
}
interface ChunkApprovalFilterBase {
    approvalStatus?: ApprovedStatus,
    chunkLanguageCodes?: string[];
}
export interface ChunkApprovalFilterIds extends ChunkApprovalFilterBase {
    chunkIds: string[],
}
export interface ChunkApprovalFilter extends ChunkApprovalFilterBase {
    chunkIndices: number[],
}
export type BinderOrDocumentCollection = Binder | DocumentCollection;

export interface ReaderFeedbackConfig {
    itemId?: string;
    readerCommentsEnabled?: boolean,
    readerRatingEnabled?: boolean,
    readConfirmationEnabled?: boolean,
}

export interface FeedbackFilter {
    createdAfter?: Date;
    createdBefore?: Date;
    accountId?: string;
}

export type AuditLogFn = (trackingClient: TrackingServiceContract) => Promise<void>;

export type AuditLogExportPublicationFn = (
    binderId: string,
    accountId: string,
    publicationId: string,
    translationLanguage?: string,
) => void;

export type AuditLogUpdateApprovalFn = (
    binderId: string,
    accountId: string,
    chunkId: string,
    chunkLastUpdate: number,
    languageCode: string,
    approval: ApprovedStatus,
) => void;

export type PublicationSummaryFormat = "csv" | "json";

export interface ReaderItemContext {
    ancestors: DocumentAncestors;
    feedbackConfig?: ReaderFeedbackConfig;
}

export interface GetReaderItemContextOptions {
    skipReaderFeedbackConfig?: boolean;
}

export type UserActivity = {
    commentsAuthors: Pick<User,
        | "id"
        | "displayName"
        | "firstName"
        | "lastName"
    >[];
    commentsCount: number;
    documentId: string;
    documentTitle: string;
    latestCommentDate: Date;
};
export type UserActivities = UserActivity[];

/**
 * Represents the user's access to configure the specific item's setting. <br/>
 * Note that it is different from the permissions from the auth service.
 * An {@link EDITABLE} access can mean a different set of permissions for ownership as opposed to reader config.
 */
export enum ItemConfigAccessType {
    /** The user does not have access to this item, not even its name */
    FORBIDDEN = "FORBIDDEN",
    /** The user can see this item (including its name) but cannot configure it */
    READABLE = "READABLE",
    /** The user can configure the settings on this item */
    EDITABLE = "EDITABLE",
}

export type VisualSettings = {
    fitBehaviour: "fit" | "crop";
    bgColor: string;
    languageCodes: string[];
    rotation: number;
    audioEnabled: boolean;
    autoPlay: boolean;
};

type ItemReaderFeedbackConfig = {
    id: string;
    title: string | null;
    isCollection: boolean;
    access: ItemConfigAccessType;
    config: {
        readerCommentsEnabled?: boolean,
        readerRatingEnabled?: boolean,
        readConfirmationEnabled?: boolean
    }
}
export type ReaderFeedbackConfigs = Record<string, ItemReaderFeedbackConfig>;

export interface BindersRepositoryServiceContract {
    createBinderInCollection(toCreate: Binder, collectionId: string, accountId?: string): Promise<Binder>;
    createBinderBackend(toCreate: Binder): Promise<Binder>;
    deleteAllForAccount(accountId: string): Promise<void>;
    duplicateBinder(
        toUpdate: Binder,
        collectionId: string,
        fromAccountId: string,
        toAccountId: string
    ): Promise<Binder>;
    duplicateCollection(
        collectionId: string,
        targetCollectionId: string,
        targetDomainCollectionId: string,
        fromAccountId: string,
        toAccountId: string
    ): Promise<DocumentCollection>;
    updateBinder(toUpdate: Binder, userId?: string): Promise<Binder>;
    searchBindersAndCollections(query: string, options: IItemSearchOptions, accountId: string, multiSearchOptions?: IMultiSearchOptions, userId?: string): Promise<EditorItemSearchResult>;
    searchPublicationsAndCollections(query: string, options: IItemSearchOptions, domain: string, multiSearchOptions?: IMultiSearchOptions, userId?: string): Promise<ReaderItemSearchResult>;
    getBinder(binderId: string, options?: IItemSearchOptions): Promise<Binder>;
    extendChunks(binderOrPublication: Binder | Publication, additionalChunks: ContentChunkKind[], translated: string): Promise<BinderModules>;
    deleteBinder(
        binderId: string,
        accountId: string,
        permanent?: boolean
    ): Promise<Binder>;
    findBindersBackend(filter: BinderFilter, options: BinderSearchResultOptions): Promise<Array<BinderFindResult>>;
    findBinderIdsByAccount(accountId: string): Promise<string[]>
    findItems(filter: BinderFilter, options: BinderSearchResultOptions): Promise<BinderOrDocumentCollection[]>;
    findItemsForReader(filter: BinderFilter, findItemsOptions: IItemSearchOptions, accountId: string): Promise<BinderOrDocumentCollection[]>;
    findItemsForEditor(filter: BinderFilter, findItemsOptions: IItemSearchOptions, accountId: string): Promise<BinderOrDocumentCollection[]>;
    getSoftDeletedItems(
        accountId: string,
        options: IItemSearchOptions,
        filter?: SoftDeletedItemsFilter,
        userId?: string
    ): Promise<SoftDeletedItemsSearchResult>;
    findPublicationsAndCollections(
        filter: PublicationAndCollectionFilter,
        options: BinderSearchResultOptions,
        accountId: string,
    ): Promise<Array<Publication | DocumentCollection>>;
    getCollectionElementsWithInfo(
        collectionId: string,
        domain: string,
        options?: CollectionElementsWithInfoOptions,
    ): Promise<ICollectionElementsWithInfo>;
    createOrUpdateFeedback(accountId: string, publicationId: string, feedbackParams: FeedbackParams): Promise<IBinderFeedback>;
    getMostRecentPublicationUserFeedback(publicationId: string, userId?: string): Promise<IBinderFeedback | null>;
    getBinderFeedbacks(binderId: string, publicationId?: string): Promise<IBinderFeedback[]>;
    exportBinderFeedbacks(binderId: string): Promise<string | ExportedBinderFeedback[]>;
    publish(
        binderId: string,
        languages: string[],
        sendNotification?: boolean,
        userId?: string
    ): Promise<Array<PublicationSummary>>;
    findPublications(binderId: string, filter: PublicationFilter, options: IItemSearchOptions): Promise<Array<PublicationFindResult>>;
    findPublicationsBackend(filter: PublicationFilter, options: BinderSearchResultOptions): Promise<Array<PublicationFindResult>>;
    unpublish(binderId: string, languageCodes: string[]): Promise<Array<PublicationSummary>>;
    setPublicationsShowInOverview(binderId: string, showInOverview: boolean, userId?: string): Promise<Array<PublicationSummary>>;
    updatePublicationsLanguages(binderId: string, languageCode: string, order: string[]): Promise<Array<PublicationSummary>>;
    /** @deprecated, remove when rel-read-reports is live */
    getPublication(publicationId: string, options?: IItemSearchOptions): Promise<Publication>;

    getCollectionInfo(collectionId: string): Promise<ICollectionInfo>;
    getChildCollectionSummaries(collectionIds: string[], accountId: string): Promise<ICollectionSummary[]>;

    getCollectionsElements(colIds: string[], recursive?: boolean): Promise<CollectionElement[]>;

    createCollectionInCollection(
        accountId: string,
        collectionId: string,
        title: string,
        languageCode: string,
        thumbnail: IThumbnail
    ): Promise<DocumentCollection>;
    createCollectionBackend(
        accountId: string,
        title: string,
        languageCode: string,
        thumbnail: IThumbnail,
        domainCollectionId: string,
    ): Promise<DocumentCollection>;
    createRootCollection(accountId: string, accountName: string): Promise<DocumentCollection>;
    updateCollectionIsHidden(collectionId: string, isHidden: boolean): Promise<DocumentCollection>;
    updateCollectionThumbnail(collectionId: string, thumbnail: IThumbnail): Promise<DocumentCollection>;
    removeCollectionThumbnail(collectionId: string, options: IGetCollectionQueryOptions): Promise<DocumentCollection>;
    updateCollectionShowInOverview(collectionId: string, showInOverview: boolean): Promise<DocumentCollection>;
    saveCollectionTitle(collectionId: string, title: string, languageCode: string): Promise<DocumentCollection>;
    updateLanguageOfCollectionTitle(collectionId: string, currentLanguageCode: string, languageCode: string): Promise<DocumentCollection>;
    removeCollectionTitle(domain: string, collectionId: string, languageCode: string): Promise<DocumentCollection>;
    addElementToCollection(collectionId: string, kind: string, key: string, accountId: string): Promise<DocumentCollection>;
    removeElementFromCollection(collectionId: string, kind: string, key: string, accountId: string, permanent?: boolean): Promise<DocumentCollection>;
    changeElementPosition(
        collectionId: string,
        kind: string,
        key: string,
        newPosition: number
    ): Promise<DocumentCollection>;
    findCollections(filter: CollectionFilter, options: BinderSearchResultOptions): Promise<Array<DocumentCollection>>;
    findCollectionsFromClient(filter: CollectionFilter, options: BinderSearchResultOptions): Promise<Array<DocumentCollection>>;
    getCollection(collectionId: string, options?: IGetCollectionQueryOptions): Promise<DocumentCollection>;
    /* @deprecated, remove when rel-read-reports is live */
    deleteCollection(
        collectionId: string,
        accountId: string
    ): Promise<DocumentCollection>;

    getDocumentResourceDetails(documentId: string): Promise<DocumentResourceDetails>;
    getDocumentResourceDetailsArray(documentIds: string[]): Promise<DocumentResourceDetails[]>;
    findReaderItemsWithInfo(filter: ReaderItemsFilter, options: IItemSearchOptions): Promise<ICollectionElementsWithInfo>;
    getRootCollections(accountIds: string[]): Promise<Array<DocumentCollection>>;
    countAllPublicDocuments(accountId: string): Promise<number>;
    getAncestors(itemId: string): Promise<DocumentAncestors>;
    getItemsAncestors(itemIds: string[]): Promise<DocumentAncestors>;
    getDescendantsMap(collectionid: string): Promise<IDescendantsMap>;

    translate(accountId: string, html: string, sourceLanguageCode: string, targetLanguageCode: string, isHtml?: boolean): Promise<string>;
    getTranslationsAvailable(skipCache?: boolean): Promise<IAzureTranslation[]>;
    getSupportedLanguagesByEngine(skipCache?: boolean): Promise<{ [engineType: string]: string[] }>;
    detectLanguage(html: string): Promise<string>;
    getAccountTotals(accountId: string): Promise<AccountTotals>;

    getMostUsedLanguages(accountIds: string[]): Promise<string[]>;

    approveChunk(
        binderId: string,
        chunkId: string,
        chunkLastUpdate: number,
        languageCode: string,
        approval: ApprovedStatus,
    ): Promise<IChunkApproval[]>;
    updateChunkApprovals(binderId: string, filter: ChunkApprovalFilter, approvalStatus: ApprovedStatus): Promise<IChunkApproval[]>;
    fetchApprovalsForBinder(binderId: string): Promise<IChunkApproval[]>;
    saveChecklistActivation(binderId: string, chunkId: string, isActive: boolean): Promise<IChecklistConfig>;
    getChecklistConfigs(binderId: string): Promise<IChecklistConfig[]>;
    getMultiChecklistConfigs(binderIds: string[]): Promise<IChecklistConfig[]>;
    getChecklists(binderOrCollectionId: string): Promise<IChecklist[]>;
    togglePerformed(
        id: string,
        performed: boolean,
        binderId: string,
        publicationId: string
    ): Promise<IChecklist>;
    getChecklistsProgress(binderIds: string[]): Promise<IChecklistProgress[]>;
    getChecklistsActions(binderOrCollectionIds: string[]): Promise<IChecklistAction[]>;
    invalidatePublicItemsForAccount(accountId: string): Promise<void>;

    getAccountAncestorTree(accountId: string): Promise<AncestorTree>;

    getLanguageCodesUsedInCollection(collectionId: string, shouldAddPublicationPossibilities?: boolean): Promise<LanguageSummary[]>;
    recursivePublish(collectionId: string, languages: string[], accountId: string, userId?: string): Promise<RecursiveOpeartionResult<PublicationSummary>>;
    recursiveUnpublish(collectionId: string, languageCodes: string[], accountId: string, userId?: string): Promise<RecursiveOpeartionResult<RecursiveUnpublishSummaryResult>>
    recursiveDelete(collectionId: string, accountId: string, parentCollectionId?: string, userId?: string): Promise<RecursiveOpeartionResult<RecursiveDeleteSummaryResult>>
    recursiveTranslate(collectionId: string, targetLanguageCode: string, accountId: string, userId?: string): Promise<RecursiveOpeartionResult<Binder>>
    validateRecursiveAction(collection: string, operation: RecursiveAction): Promise<ValidationResult>;
    getCustomerMetricsCsv(): Promise<string>;
    getSingleCustomerMetricsCsv(accountId: string): Promise<string>;
    generateTextToSpeech(
        paragraphs: string[],
        voiceOptions: ITTSVoiceOptions
    ): Promise<ITTSGenerateResponse>;
    fetchTextToSpeechFile(
        identifier: string,
        respones: Response
    ): Promise<void>;
    listAvailableTTSLanguages(): Promise<string[]>;
    recoverDeletedItem(
        itemId: string,
        accountId: string,
        newParentCollectionId: string
    ): Promise<void>;
    purgeRecycleBins(): Promise<void>;
    relabelBinderLanguage(
        accountId: string,
        binderId: string,
        fromLanguageCode: string,
        toLanguageCode: string,
        userId?: string,
    ): Promise<RelabelResult>;
    /**
     * @returns A list of the targets to whom the request was sent.
     */
    requestReview(
        accountId: string,
        binderId: string
    ): Promise<void>;
    findBindersStatuses(
        accountId: string,
        options?: FindBindersStatusesQueryParams
    ): Promise<BinderStatus[]>;
    calculateBindersStatuses(accountId: string): Promise<BinderStatus[]>;
    summarizePublicationsForAccount(accountId: string): Promise<string | PublicationsSummaryItem[]>;
    summarizeDraftsForAccount(accountId: string): Promise<string | DraftSummaryItem[]>;
    getItemAndAncestorsReaderFeedbackConfigs(itemId: string): Promise<ReaderFeedbackConfigs>;
    getReaderFeedbackConfigForItems(itemIds: string[]): Promise<Record<string, ReaderFeedbackConfig>>;
    updateReaderFeedbackConfig(itemId: string, config: ReaderFeedbackConfig): Promise<ReaderFeedbackConfig>;
    getOwnershipForItems(itemIds: string[], accountId: string, expandGroups?: boolean): Promise<DetailedItemOwnership[]>;
    setOwnershipForItem(itemId: string, ownership: ItemOwnership, accountId: string): Promise<void>;
    removeOwnerIdFromItemOwnershipForAccount(ownerId: string, accountId: string): Promise<void>;
    getFeedbacks(feedbackFilter: FeedbackFilter): Promise<IBinderFeedback[]>;
    getReaderItemContext(itemId: string, accountId?: string, options?: GetReaderItemContextOptions): Promise<ReaderItemContext>;
    clearLastModifiedInfo(accountId: string, binderIds: string[]): Promise<void>;
    updateChunkVisualSettings(binderId: string, chunkIdx: number, visualIdx: number, visualSettings: Partial<VisualSettings>): Promise<void>;

    getUserActivities(accountId: string): Promise<UserActivities>;
    restoreElasticDoc(indexName: string, documentId: string, document: unknown): Promise<void>;
}
