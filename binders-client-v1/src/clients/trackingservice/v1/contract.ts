import { ApprovedStatus, IViewsSummary, ItemOwnership } from "../../repositoryservice/v3/contract";
import { IFeature, ManageMemberTrigger } from "../../accountservice/v1/contract";
import { Acl } from "../../authorizationservice/v1/contract";
import { Alert } from "../../notificationservice/v1/contract";
import { IUserTag } from "../../userservice/v1/contract";
import { MonthKey } from "../../model";
import { TranslationKeys } from "../../../i18n/translations";

/**
 * User events: 0-99
 * Document events: 100-199
 * Language events: 200-299
 * Other: 300+
 *
 * @export
 * @enum {number}
 */
export enum EventType {
    USER_LOGGED_IN_SUCCESS = 0,
    USER_LOGGED_IN_FAILURE = 1,
    USER_IS_ONLINE = 2,
    USER_LOGGED_OFF = 5,
    USER_ADDED_TO_ACCOUNT = 7,
    USER_DELETED_FROM_ACCOUNT = 8,
    DOCUMENT_OPENED = 100,
    DOCUMENT_CLOSED = 101,
    CHUNK_BROWSED = 110,
    READ_SESSION_BLUR = 115,
    READ_SESSION_FOCUS = 116,
    CHOOSE_LANGUAGE = 200,
    RELABEL_LANGUAGE = 205,
    SEARCHED = 300,
    BINDER_EDITED = 400,
    ITEM_CREATED = 401,
    ITEM_DELETED = 402,
    ITEM_HARD_DELETED = 403,
    COLLECTION_OPENED = 500,
    IMAGE_UPLOADED = 600,

    // 2020-09-09
    // This event type is no longer in use
    // We need it temporarily for breaking up the monolithic events collection
    EVENTS_AGGREGATED = 610
}

export function getAllDocumentEvents(): EventType[] {
    return Object.values(EventType)
        .filter((v): v is EventType => !isNaN(Number(v)))
        .filter(v => v >= 100 && v < 200);
}

// Events that aren't used by user actions
export const NonUserActionEvents = [
    EventType.USER_LOGGED_IN_SUCCESS,
    EventType.USER_LOGGED_IN_SUCCESS,
    EventType.USER_LOGGED_IN_FAILURE,
    EventType.USER_LOGGED_OFF,
    EventType.USER_ADDED_TO_ACCOUNT,
    EventType.USER_DELETED_FROM_ACCOUNT,
    EventType.SEARCHED,
    EventType.COLLECTION_OPENED,
    EventType.IMAGE_UPLOADED,
]

export enum UserActionType {
    NOT_READ = -1,
    DOCUMENT_READ = 10,
    DOCUMENT_READ_CONFIRMED = 11,
    CHOOSE_LANGUAGE = 30,
    ITEM_CREATED = 401,
    ITEM_DELETED = 402,
    ITEM_EDITED = 403,
    ITEM_HARD_DELETED = 404,
    ITEM_MOVED = 405,
    USER_ONLINE = 2,
    COLLECTION_VIEW = 500,
    LANGUAGE_ADDED = 520,
    LANGUAGE_DELETED = 521,
    CHECKLIST_COMPLETED = 601,
    URL_ACCESSED = 701,
    DOCUMENT_PUBLISHED = 801,
    DOCUMENT_UNPUBLISHED = 802,
}

export const ALL_READ_USER_ACTIONS = [
    UserActionType.DOCUMENT_READ,
    UserActionType.COLLECTION_VIEW,
    UserActionType.CHECKLIST_COMPLETED
];

export const ALL_EDIT_USER_ACTIONS = [
    UserActionType.ITEM_CREATED,
    UserActionType.ITEM_EDITED,
    UserActionType.ITEM_DELETED,
    UserActionType.ITEM_HARD_DELETED,
    UserActionType.LANGUAGE_ADDED,
    UserActionType.LANGUAGE_DELETED,
];

// Note: AggregatorTypes don't map 1:1 to UserActions,
// eg RELABELLANGUAGE aggregator: produces read actions
export enum AggregatorType {
    CHOOSELANGUAGE = 10,
    ITEMCREATIONS = 20,
    ITEMDELETIONS = 30,
    ITEMHARDDELETIONS = 31,
    ITEMEDITED = 40,
    USERONLINE = 60,
    READSESSIONS = 70,
    RELABELLANGUAGE = 80,
}

export enum UserGroupActionType {
    USER_GROUP_DELETED = -1,
    USER_GROUP_CREATED = 0,
    USER_GROUP_MEMBER_ADDED = 1,
    USER_GROUP_MEMBER_REMOVED = 2,
}

export enum FeatureActionType {
    FEATURE_REMOVED = -1,
    FEATURE_ADDED = 0,
}

export enum PublishUpdateActionType {
    UNPUBLISHED_DOCUMENT = 0,
    PUBLISHED_DOCUMENT = 1
}

export enum Application {
    EDITOR = 0,
    READER = 1,
    MANAGE = 2,
    DASHBOARD = 3,
    PARTNERS = 4,
}

export function getUserActionTranslationKey(type: UserActionType): string | undefined {
    switch (type) {
        case UserActionType.DOCUMENT_READ:
            return TranslationKeys.DocManagement_ReadDocument;
        case UserActionType.DOCUMENT_READ_CONFIRMED:
            return TranslationKeys.DocManagement_ReadDocumentConfirmed;
        case UserActionType.DOCUMENT_PUBLISHED:
            return TranslationKeys.DocManagement_PublishedDocument;
        case UserActionType.DOCUMENT_UNPUBLISHED:
            return TranslationKeys.DocManagement_UnpublishedDocument;
        case UserActionType.ITEM_CREATED:
            return TranslationKeys.DocManagement_CreatedItem;
        case UserActionType.ITEM_DELETED:
            return TranslationKeys.DocManagement_DeletedItem;
        case UserActionType.ITEM_HARD_DELETED:
            return TranslationKeys.DocManagement_HardDeletedItem;
        case UserActionType.ITEM_EDITED:
            return TranslationKeys.DocManagement_EditedItem;
        case UserActionType.ITEM_MOVED:
            return TranslationKeys.DocManagement_ItemMoved;
        case UserActionType.COLLECTION_VIEW:
            return TranslationKeys.DocManagement_CollectionView;
        case UserActionType.NOT_READ:
            return TranslationKeys.DocManagement_NotRead;
        case UserActionType.LANGUAGE_ADDED:
            return TranslationKeys.DocManagement_UserActionLanguageAdded;
        case UserActionType.LANGUAGE_DELETED:
            return TranslationKeys.DocManagement_UserActionLanguageDeleted;
        case UserActionType.CHECKLIST_COMPLETED:
            return TranslationKeys.DocManagement_ChecklistCompleted;
        default:
            return undefined;
    }
}

export const AllUserActionTypes: UserActionType[] = [
    UserActionType.NOT_READ,
    UserActionType.DOCUMENT_READ,
    UserActionType.DOCUMENT_READ_CONFIRMED,
    UserActionType.CHOOSE_LANGUAGE,
    UserActionType.ITEM_CREATED,
    UserActionType.ITEM_DELETED,
    UserActionType.ITEM_HARD_DELETED,
    UserActionType.ITEM_EDITED,
    UserActionType.ITEM_MOVED,
    UserActionType.USER_ONLINE,
    UserActionType.COLLECTION_VIEW,
    UserActionType.LANGUAGE_ADDED,
    UserActionType.LANGUAGE_DELETED,
    UserActionType.CHECKLIST_COMPLETED,
    UserActionType.DOCUMENT_PUBLISHED,
    UserActionType.DOCUMENT_UNPUBLISHED,
];

export const AllAggregatorTypes = Object.values(AggregatorType).filter(v => !isNaN(Number(v))) as AggregatorType[];
export interface IViewsStatsPerPublication {
    [publicationId: string]: IViewsSummary;
}

/** Data sent from which an {@link Event} is defined */
export interface EventPayload {
    userId?: string;
    accountId?: string;
    eventType: EventType;
    data?: Record<string, unknown>;
    /**
     * Millis difference from server time's `Date.now()` when the event happened </br>
     * Note: It's an approximation since the client and server time can be skewed
     */
    occurrenceMsDiff?: number;
    /** A token added to the auth request to authenticate the event. Created using createLogAuthToken */
    authToken?: string;
}

/** Defines a captured frontend event */
export interface Event {
    userId?: string;
    accountId?: string;
    eventType: EventType;
    timestamp: number;
    timestampLogged: number;
    data?: Record<string, unknown>;
}

export interface EventsInRangeResult {
    events: Event[];
    lastEventTimestamp: number;
}

export interface IUserAction<D extends IUserActionData = IUserActionData> {
    id?: string;
    index?: string;
    accountId: string;
    userActionType: UserActionType;
    start?: Date;
    end?: Date;
    duration?: number;
    userId?: string;
    // MT-3388 is optional in some cases
    // binders-tracking-service-v1/app/src/trackingservice/userActionsAggregators/itemCreations.ts L23
    // binders-tracking-service-v1/app/src/trackingservice/userActionsAggregators/itemDeletions.ts L24
    // binders-tracking-service-v1/app/src/trackingservice/userActionsAggregators/itemHardDeletions.ts L24
    data?: D;
}

export interface IUserActionMap<D extends IUserActionData = IUserActionData> {
    toAdd?: IUserAction<D>[],
    toComplete?: IUserAction<D>[],
    lastEventTimestamp?: number,
}

export interface AggregationResult<D extends IUserActionData = IUserActionData> extends IUserActionMap<D> {
    aggregatorType: AggregatorType;
    lastEventTimestamp?: number;
    rangeUsed?: IRange;
}

export interface IUserActionData {
    itemId?: string;
    itemKind?: string; // binder or collection
    itemTitle?: string;
    itemLanguage?: string;
}

export interface IUserAccessedUrlData extends IUserActionData {
    url: string;
    host: string;
    method: string;
    referer: string;
    domain: string;
    ips: string[];
    hash?: string;
    hostname?: string;
    href?: string;
    origin?: string;
    pathname?: string;
    port?: string;
    search?: string;
}

export interface IUserActionPublishData extends IUserActionData {
    binderId: string;
    publicationId: string;
    languageCode: string;
}

export interface IUserActionDataReadSession extends IUserActionData {
    readSessionId?: string;
    publicationId: string;
    timeInactive?: number;
    incomplete?: boolean;
    userIsAuthor?: boolean;
    path?: string;
    semanticLinkId?: string;
    chunkTimingsMap?: string;
}

export interface IUserActionDataChecklistCompleted extends IUserActionData {
    publicationId: string,
    itemId: string,
    itemKind: string,
    itemTitle: string,
}

export interface IUserOnlineData extends IUserActionData {
    numberOfUsers: number;
    key: string;
    users: string[];
}

export interface ChooseLanguageData extends IUserActionData {
    binderId: string,
    language: string,
    isMachineTranslation?: boolean;
}

export type IUserOnlineUserAction = IUserAction<IUserOnlineData>;

export interface ILanguageOperationData extends IUserActionData {
    languageCode: string;
}

export type ILanguageOperationUserAction = IUserAction<ILanguageOperationData>;

export interface ItemEditedUserActionData extends IUserActionData {
    sessionId: string;
    binderId: string;
    itemId: string;
    itemKind: string;
    userId: string;
    itemTitle: string;
    isoCode: string;
    start: number;
    end: number;

}

export interface ItemCreatedUserActionData extends IUserActionData {
    backpopulatedFromEditEvent?: boolean;
}

export interface IUserActionFilter {
    accountId: string;
    binderIds?: string[];
    end?: number;
    endRange?: IRange;
    excludeUserActionTypes?: UserActionType[];
    incomplete?: boolean;
    itemIds?: string[];
    missingField?: string,
    /** Don't take descendents into account for provided `itemIds`.<br/>
     * If falsy, `itemIds` will not be used in the elastic query but only in post-filtering<br/>
     * This causes e.g. the re-label aggregator to suck in all read session since the beginning of time
     */
    omitDescendantsInItemIds?: boolean;
    publicationIds?: string[];
    recursive?: boolean;
    skipUnpublished?: boolean;
    /**
     * ms since epoch (elasticsearch internal date format)
     */
    start?: number;
    startRange?: IRange;
    userActionTypes?: UserActionType[];
    userGroupIds?: string[];
    userIds?: string[];
    /**
     * only relevant for DOCUMENT_READ UserActions
     */
    userIsAuthor?: boolean;
}

export interface IFindUserActionsFilter extends IUserActionFilter {
    limitResults?: number;
    shouldIncludeParentPaths?: boolean;
}

export type UserReadSessionsFilter = Omit<IFindUserActionsFilter, "userActionTypes" | "excludeUserActionTypes">;

export interface FindUserActionsOptions {
    totalResultsLimit?: number;
}

export interface FindUserActionsException {
    type: "limit",
    total?: number,
    limit?: number,
}

export interface IUserActionQuery {
    accountId?: string;
    userActionType?: UserActionType;
    ids?: string[];
}

export interface ILoggedInFailureEvent extends Event {
    data: {
        login: string;
        message?: string;
        application: Application;
    };
}

export interface IUserAgentLogFormat {
    string: string;
    isMobile: boolean;
    browser: string;
    browserVersion: {
        major: string;
        minor: string;
        patch: string;
    };
    os: string;
    device: string;
    deviceVersion?: string;
}

export interface ILoggedInSuccessEvent extends Event {
    data: {
        accountIds: string[];
        userAgent: IUserAgentLogFormat;
        application: Application;
    };
}
export interface ILoggedOffEvent extends Event {
    data: {
        accountIds: string[];
        userAgent: string;
        reason?: string;
    };
}
export interface IUserIsOnlineEvent extends Event {
    data: {
        application: Application;
        domain?: string;
    };
}

export interface IItemLanguageRelabeled extends Event {
    data: {
        itemId: string;
        fromLanguageCode: string;
        toLanguageCode: string;
    }
}

export interface IAccountUpdateAuditLogData {
    userId?: string;
    manageMemberTrigger: ManageMemberTrigger;
}

export interface IUserGroupAuditLogData {
    userGroupId: string;
    userId?: string;
    userGroupAction: UserGroupActionType;
}

export interface IFeatureAuditLogData {
    featureAction: FeatureActionType;
    feature: IFeature;
}

export interface IACLAuditLogData {
    oldAcl?: Acl;
    newAcl?: Acl;
}

export interface IPublishAuditLogData {
    binderId: string;
    publicationId: string;
    publishUpdateAction: PublishUpdateActionType;
    languageCode: string;
}

export interface IPDFExportAuditLogData {
    binderId: string;
    publicationId: string;
    from: "reader" | "editor";
    translationLanguage?: string;
}

export interface IWhitelistEmailAuditLogData {
    domain: string;
    pattern: string;
    activate: boolean;
}

export interface IChunkApprovalAuditLogData {
    binderId: string;
    chunkId: string;
    chunkLastUpdate: number;
    languageCode: string;
    approval: ApprovedStatus;
}

export interface IBinderCommentAuditLogData {
    binderId: string;
    chunkId?: string;
    threadId?: string;
    commentId?: string;
    languageCode?: string;
    body?: string;
}

export interface IItemDeleteAuditLogData {
    binderId?: string;
    collectionId?: string;
}

export interface IAlertChangedAuditLogData {
    alert: Alert;
    deleted?: boolean;
}

export interface PublicApiTokenAuditLogData {
    token: string;
}

export interface IBinderCommentThreadAuditLogData {
    binderId: string;
    threadId: string;
    uuids?: string;
}

export enum PasswordChangeTrigger {
    WITH_TOKEN = 0,
    WITH_OLD_PASSWORD = 1,
    BY_GROUP_OWNER = 2,
    INITIAL_CREATION = 3,
    BY_ADMIN = 4
}

export interface PasswordChangeAuditLogData {
    trigger: PasswordChangeTrigger;
    requestedByUserId: string;
}

export interface OwnershipChangeAuditLogData {
    itemId: string;
    ownership: ItemOwnership;
}

export enum AuditLogType {
    ACCOUNT_MEMBER_ADDED = 1,
    ACCOUNT_MEMBER_REMOVED = 2,
    USER_GROUP_UPDATE = 3,
    FEATURE_UPDATE = 4,
    ACL_UPDATE = 5,
    PUBLISH_DOCUMENT = 6,
    EXPORT_PDF = 7,
    WHITELIST_EMAIL_CHANGED = 8,
    CHUNK_APPROVAL_UPDATE = 9,
    BINDERCOMMENT_ADDED = 20,
    BINDERCOMMENT_DELETED = 21,
    BINDERCOMMENTTHREAD_RESOLVED = 22,
    BINDERCOMMENTTHREADS_CHUNKMERGE = 23,
    ITEM_HARD_DELETED = 24,
    ALERT_CHANGED = 25,
    PUBLIC_API_TOKEN_GENERATED = 26,
    ITEM_OWNERSHIP_CHANGED = 27,
    PASSWORD_CHANGE = 100
}

export type AuditLogData = IAccountUpdateAuditLogData
    | IUserGroupAuditLogData
    | IFeatureAuditLogData
    | IACLAuditLogData
    | IPublishAuditLogData
    | IPDFExportAuditLogData
    | IWhitelistEmailAuditLogData
    | IChunkApprovalAuditLogData
    | IBinderCommentAuditLogData
    | IBinderCommentThreadAuditLogData
    | IItemDeleteAuditLogData
    | IAlertChangedAuditLogData
    | PublicApiTokenAuditLogData
    | PasswordChangeAuditLogData
    | OwnershipChangeAuditLogData;

export interface AuditLog {
    userId?: string;
    accountId?: string;
    logType: AuditLogType;
    timestamp: number;
    timestampLogged?: number;
    occurrenceMsDiff?: number;
    userAgent: IUserAgentLogFormat;
    requestIp?: string;
    data?: AuditLogData;
}

/**
 * The document statistics object
 *
 * @export
 * @class Event
 */
export interface IBinderStatistics {
    _id: string; // document id
    created: Date;
    createdBy: string;
    createdByUserId?: string;
    lastEdit: Date;
    lastEditBy: string;
    lastEditByUserId?: string;
    views: number;
    edits: number;
}

export interface IComposerStatistics {
    binderStatistics: IBinderStatistics[];
    mostUsedLanguages: string[];
}

export interface IDashboardDocument {
    _id: string;
    title: string;
    lastEdition: Date;
    numberOfReads: number;
    numberOfEdits: number;
}

export interface IViewsStatistics {
    [binderId: string]: IDateViewsPair[];
}

export interface IAccountViewsStatistics {
    [date: string]: IDateViewsPair;
}

export interface IDateViewsPair {
    date: Date;
    views: number;
}

export interface IDocumentCreationsStatistics {
    date: Date;
    creations: number;
}

export interface IItemEditsStatistics {
    date: Date;
    edits: number;
}

export interface IDocumentDeletionsStatistics {
    date: Date;
    deletions: number;
}

export interface ILoginStatistics {
    date: Date;
    logins: number;
}

export interface IUserCountStatistics {
    date: Date;
    count: number;
}

export interface ILanguageStatistics {
    languageCode: string;
    amount: number;
    isMachineTranslation?: boolean;
}

export interface ICollectionLanguageStatistics {
    collectionLanguageAnalytics: ILanguageStatistics[];
}

export interface IAllDocumentStatistics {
    binderStatistics?: IBinderStatistics[];
    chunkTimings: ChunkTimingsPerPublication;
    languageStatistics: ILanguageStatistics[];
    viewsAnalytics: IViewsStatistics;
    viewsPerMonthStatistics: IViewsStatistics;
}

export interface IAllViewsStatistics {
    [itemId: string]: number | {
        views: number;
    };
}

export interface IEventFilter {
    accountIds?: string[];
    eventTypes?: EventType[];
    excludeEventTypes?: EventType[];
    range?: IRangeFilter;
    idRange?: IIdRangeFilter;
    hasSessionId?: boolean;
    hasAccountId?: boolean;
    documentIds?: string[];
    aggregateBySession?: boolean;
    userId?: string;
    excludeEventsWithValidChunkTimingsMap?: boolean;
    data?: Record<string, unknown>;
}

export interface IRange {
    rangeStart?: Date;
    rangeEnd?: Date;
}

export interface IAggregationReport {
    [accountId: string]: IAccountAggregationReport;
}

export interface IAggregatorReportBody {
    toAddCount: number;
    toCompleteCount?: number;
    oldest?: Date;
    newest?: Date;
    lastEventTimestamp?: number;
    rangeUsed?: IRange;
    info?: string;
}

export interface IAccountAggregationReport {
    eventFilter: IEventFilter;
    aggregatorReports: {
        [aggregatorType: string]: IAggregatorReportBody;
    };
    exception?: string;
}

export interface IRangeFilter extends IRange {
    fieldName: string;
    fallbackFieldName?: string;
    excludeRangeStart?: boolean;
    excludeRangeEnd?: boolean;
}

export interface IIdRangeFilter {
    startIdNonInclusive?: string;
    endIdNonInclusive?: string;
}

export interface IDocumentReadSessionsResult {
    toAdd: IDocumentReadSessionsMap;
    toComplete: IDocumentReadSessionsMap;
    lastEventTimestamp?: number;
}

export interface IDocumentReadSessionsMap {
    [publicationId: string]: IDocumentReadSession[];
}

export interface IDocumentReadSession {
    documentId: string;
    binderId: string;
    language?: string;
    documentName?: string;
    start: Date;
    end: Date;
    duration?: number;
    truncated?: boolean;
    userId: string;
    userLogin?: string;
    userIsAuthor?: boolean;
    sessionId?: string;
    timeInactive?: number,
    lastActivityTimestamp?: Date,
    incomplete?: boolean;
    userActionId?: string;
    userActionIndex?: string;
    title?: string;
    path: string;
    semanticLinkId?: string;
    chunkTimingsMap: ChunkTimingsMap;
}

export interface ChunkTiming {
    wordCount: number;
    timeSpentMs: number;
}
export interface ChunkTimingsMap {
    [chunkIndex: number]: ChunkTiming;
}

export interface ChunkTimingsPerPublication {
    [publicationId: string]: ChunkTimingsMap;
}

export interface IUserActionSummary {
    userDisplayName: string;
    userEmail: string;
    userActionTranslationKey: string;
    userActionExtraInfo?: string;
    title: string;
    timestamp?: Date;
    duration: number;
    obfuscatedDuration?: "opened" | "skimmed" | "read" | "unknown";
    url: string;
    id: string;
    ancestors?: string[];
    userTags?: IUserTag[];
    userGroupNames?: string[];
}

export type ObfuscatedReadingTimeConfiguration = {
    openedSeconds: { min: number; max: number };
    skimmedSeconds: { min: number; max: number };
    readSeconds: { min: number; max?: number };
}

export interface SearchOptions {
    maxResults?: number;
    orderBy?: string;
    sortOrder?: "ascending" | "descending";
}

export interface ClientErrorContext {
    application: Application;
    url: string;
}

export interface AccountUsage {
    accountId: string;
    documentsCreated: number;
    documentEdits: number;
    documentsRead: number;
    timeSpentInReader: number;
}

export interface GlobalUsage {
    accounts: AccountUsage[];
}

export interface GlobalUsageMetrics {
    usersCreated: number;
    usersOnline: number;
    documents: number;
}

export type GlobalUsagePerMonth = Record<MonthKey, GlobalUsageMetrics>;

export interface GlobalUsagePerMonthRow extends GlobalUsageMetrics {
    monthKey: MonthKey;
}

export interface UserActionsFindResult<T = IUserAction | IUserActionSummary> {
    userActions: T[],
    exception?: string;
}
export interface AggregateOptions {
    rangeOverride?: IRange;
    aggregatorTypes?: AggregatorType[];
    limitNumberOfEvents?: number;
}

export interface DupUserActionReport {
    [accountId: string]: {
        [userActionId: string]: Array<{ hash: string, count: number }>, // hash format: see hashUserAction
    };
}

/**
 * Information about an account's last read and edit dates
 */
export interface AccountLastUsageInformation {
    readDate?: string;
    editDate?: string;
}
/**
 * Mapping between an accountId and its last usage information
 */
export type AccountsLastUsageInformation = Record<string, AccountLastUsageInformation>;

export interface CreateLogAuthTokenResponse {
    token: string;
    userId: string;
    expiresOn: Date;
}

export type DocumentEditor = {
    userId: string;
    documentCount: number;
    editCount: number;
    login: string;
    displayName: string;
};

export interface MultiInsertOptions {
    refresh: boolean | "wait_for";
}

/**
 * The available methods
 *
 * @export
 * @interface TrackingServiceContract
 */
export interface TrackingServiceContract {
    log(events: EventPayload[], userId?: string): Promise<boolean>;

    /**
     * Creates a token that can be used to send log events.
     */
    createLogAuthToken(): Promise<CreateLogAuthTokenResponse>;

    // log audit log
    logAuditLog(
        logType: AuditLogType,
        userId: string,
        accountId: string,
        userAgent: string,
        data: AuditLogData,
        ip: string | string[],
    ): Promise<boolean>;

    findAuditLogs(
        accountId: string,
        logType: AuditLogType,
        startDate?: Date,
        endDate?: Date
    ): Promise<AuditLog[]>;

    findUserActions(filter: IFindUserActionsFilter): Promise<UserActionsFindResult<IUserAction>>;

    // per binder(s)
    allBinderStatistics(binderId: string, filter: IEventFilter, accountId?: string): Promise<IAllDocumentStatistics>;
    collectionLanguageStatistics(collectionId: string, filter: IEventFilter, accountId?: string): Promise<ICollectionLanguageStatistics>;
    allViewsStatistics(itemIds: string[], accountId?: string): Promise<IAllViewsStatistics>;

    // Deprecated endpoint. Can be removed as soon as "Public API" release is live
    composerStatistics(binderids: Array<string>, accountId: string, filter: IEventFilter): Promise<IComposerStatistics>;

    mostUsedLanguages(accountId: string): Promise<string[]>;
    findEvents(accountId: string, filter: IEventFilter): Promise<Event[]>;
    // per account
    loginStatistics(accountId: string): Promise<ILoginStatistics[]>;
    accountViewsStatistics(accountId: string, excludeAuthors?: boolean): Promise<IAccountViewsStatistics>;
    documentCreationsStatistics(accountId: string): Promise<IDocumentCreationsStatistics[]>;
    itemEditsStatistics(accountId: string): Promise<IItemEditsStatistics[]>;
    userCountStatistics(accountId: string): Promise<IUserCountStatistics[]>;

    searchUserActions(filter: IFindUserActionsFilter): Promise<UserActionsFindResult<IUserActionSummary>>;
    searchUserReadSessions(filter: UserReadSessionsFilter): Promise<UserActionsFindResult<IUserActionSummary>>;

    aggregateUserEvents(accountIds?: string[], aggregateOptions?: AggregateOptions): Promise<IAggregationReport>;

    readSessionsCsv(accountId: string): Promise<string>;
    lastUserActionsAggregationTime(accountId: string): Promise<Date | null>;

    viewStatsForPublications(publicationIds: string[], userIdToExclude?: string): Promise<IViewsStatsPerPublication>;

    logSerializedClientErrors(serializedErrors: string[], context: ClientErrorContext): Promise<void>;

    globalUsage(): Promise<GlobalUsage>;
    multiInsertUserAction(userActions: IUserAction[], accountId: string, options?: MultiInsertOptions): Promise<void>;

    globalUsagePerMonth(): Promise<GlobalUsagePerMonth>;

    accountsLastUsageInformation(accountIds: string[]): Promise<AccountsLastUsageInformation>;

    recalculateAccountsLastUsageInformation(): Promise<void>;

    mostReadDocuments(accountId: string, count: number): Promise<IDashboardDocument[]>;
    mostEditedDocuments(accountId: string, count: number): Promise<IDashboardDocument[]>;
    mostActiveEditors(accountId: string, count: number): Promise<DocumentEditor[]>;
    documentDeletionsStatistics(accountId: string): Promise<IDocumentDeletionsStatistics[]>;
    cspReport(report: Record<string, string>): Promise<void>;

}
