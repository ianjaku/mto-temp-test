import {
    ALL_EDIT_USER_ACTIONS,
    ALL_READ_USER_ACTIONS,
    AccountLastUsageInformation,
    AccountUsage,
    AccountsLastUsageInformation,
    AggregateOptions,
    AggregationResult,
    AggregatorType,
    AllAggregatorTypes,
    AuditLogData,
    AuditLogType,
    ChunkTimingsPerPublication,
    ClientErrorContext,
    Event as ClientEvent,
    AuditLog as ContractAuditLog,
    CreateLogAuthTokenResponse,
    DocumentEditor,
    EventPayload,
    EventType,
    FindUserActionsException,
    FindUserActionsOptions,
    GlobalUsage,
    GlobalUsagePerMonth,
    IAccountAggregationReport,
    IAccountViewsStatistics,
    IAggregationReport,
    IAllDocumentStatistics,
    IAllViewsStatistics,
    IBinderStatistics,
    ICollectionLanguageStatistics,
    IComposerStatistics,
    IDashboardDocument,
    IDocumentCreationsStatistics,
    IDocumentDeletionsStatistics,
    IDocumentReadSession,
    IDocumentReadSessionsMap,
    IDocumentReadSessionsResult,
    IEventFilter,
    IFindUserActionsFilter,
    IItemEditsStatistics,
    ILanguageOperationData,
    ILanguageStatistics,
    ILoginStatistics,
    IRange,
    IRangeFilter,
    IUserAction,
    IUserActionDataReadSession,
    IUserActionFilter,
    IUserActionSummary,
    IUserAgentLogFormat,
    IUserCountStatistics,
    IUserOnlineUserAction,
    IViewsStatistics,
    IViewsStatsPerPublication,
    MultiInsertOptions,
    NonUserActionEvents,
    ObfuscatedReadingTimeConfiguration,
    SearchOptions,
    TrackingServiceContract,
    UserActionType,
    UserActionsFindResult,
    UserReadSessionsFilter,
    getUserActionTranslationKey
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import {
    Account,
    FEATURE_USERGROUPS_IN_USERACTION_EXPORT
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { AuditLogRepositoryFactory, IAuditLogRepository } from "./repositories/auditLogRepository";
import {
    BEGINNING_OF_2017,
    END_OF_TIME,
    fmtDate,
    fmtDateIso8601,
    sortByDate
} from "@binders/client/lib/util/date";
import {
    BackendAccountServiceClient,
    BackendRepoServiceClient,
    BackendRoutingServiceClient,
    BackendUserServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import {
    Binder,
    DocumentAncestors,
    Publication,
    PublicationSummary
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import {
    DateHistogramAggregation,
    TermsAggregation
} from "@binders/binders-service-common/lib/elasticsearch/aggregations";
import {
    ElasticUserActionsRepository,
    IUserActionsRepository,
    UserActionsFilter
} from "./repositories/userActionsRepository";
import {
    EventRepository,
    EventsByDocumentId,
    ITrackingRepositoryFactory,
    TrackingRepositoryFactory
} from "./repositories/eventRepository";
import {
    ILastAccountEventMappingRepository,
    MongoLastAccountEventMappingRepositoryFactory
} from "./repositories/accountEventMappingRepository";
import {
    ILastAccountUserActionsMappingRepository,
    MongoLastAccountUserActionsMappingRepositoryFactory
} from "./repositories/lastAccountUserActionMappingRepository";
import {
    IUserTag,
    User,
    UsergroupsPerUser
} from "@binders/client/lib/clients/userservice/v1/contract";
import LaunchDarklyService, { IFeatureFlagService } from "@binders/binders-service-common/lib/launchdarkly/server";
import { Logger, LoggerBuilder, } from "@binders/binders-service-common/lib/util/logging";
import {
    MongoAggregationsRepository,
    MongoAggregationsRepositoryFactory
} from "./repositories/aggregationsRepository";
import {
    MongoMostUsedLanguagesStatRepository,
    MongoMostUsedLanguagesStatRepositoryFactory
} from "./repositories/mostUsedLanguagesStatRepository";
import {
    MonthKey,
    Unauthorized,
    buildMonthKey,
    buildMonthKeyFromDate
} from "@binders/client/lib/clients/model";
import {
    PermissionName,
    ResourceType
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import {
    ServerEvent,
    captureServerEvent
} from "@binders/binders-service-common/lib/tracking/capture";
import { UNDEFINED_LANG, UNDEFINED_LANG_UI } from "@binders/client/lib/util/languages";
import {
    add,
    addDays,
    differenceInDays,
    differenceInSeconds,
    endOfDay,
    fromUnixTime,
    isBefore,
    isValid,
    minutesToMilliseconds,
    parse,
    parseJSON,
    startOfDay,
    startOfMonth,
    subDays,
    subYears
} from "date-fns";
import { any, omit, splitEvery, without } from "ramda";
import { buildEditorItemUrl, buildReaderItemUrl } from "@binders/client/lib/util/domains";
import {
    buildLogTokenSignConfig,
    buildLogTokenVerifyConfig,
    signJWT,
    verifyJWT
} from "@binders/binders-service-common/lib/tokens/jwt";
import { initializeChunkTimingsMap, mergeUserActionReportBodies } from "./helper";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import { Aggregation } from "./models/aggregation";
import { AncestorTree } from "@binders/client/lib/ancestors";
import { AuditLog } from "./models/auditLog";
import { AuthorizationServiceClient } from "@binders/client/lib/clients/authorizationservice/v1/client";
import {
    BackendAuthorizationServiceClient
} from "@binders/binders-service-common/lib/authorization/backendclient";
import {
    BinderRepositoryServiceClient
} from "@binders/client/lib/clients/repositoryservice/v3/client";
import ChooseLanguageAggregator from "./userActionsAggregators/chooseLanguage";
import { Config } from "@binders/client/lib/config/config";
import { Event } from "./models/event";
import ItemCreationsAggregator from "./userActionsAggregators/itemCreations";
import ItemDeletionsAggregator from "./userActionsAggregators/itemDeletions";
import ItemEditionsAggregator from "./userActionsAggregators/itemEdited";
import ItemHardDeletionsAggregator from "./userActionsAggregators/itemHardDeletions";
import { LDFlags } from "@binders/client/lib/launchdarkly/flags";
import { LOG_TOKEN_EXPIRATION_DAYS } from "@binders/client/lib/react/event/EventQueueAuthStore";
import { LastAccountEventMapping } from "./models/lastAccountEventMapping";
import { LastAccountUserActionsMapping } from "./models/lastAccountUserActionMapping";
import { MAX_RESULTS } from "./config";
import { Maybe } from "@binders/client/lib/monad";
import { MostUsedLanguagesStat } from "./models/mostUsedLanguagesStat";
import ReadSessionsAggregator from "./userActionsAggregators/readSessions";
import RelabeledLanguageAggregator from "./userActionsAggregators/relabeledLanguage";
import { RoutingServiceClient } from "@binders/client/lib/clients/routingservice/v1/client";
import UserOnlineAggregator from "./userActionsAggregators/userOnline";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import { buildUserAgentLogFormat } from "@binders/binders-service-common/lib/middleware/logging";
import { buildUserName } from "@binders/client/lib/clients/userservice/v1/helpers";
import { dedupeEvents } from "./repositories/helpers";
import { extractTitle } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { getLastEditInfo } from "@binders/client/lib/binders/create";
import { getUserActionItemId } from "@binders/client/lib/clients/trackingservice/v1/helpers";
import {
    incrementCspReportCounterByOne
} from "@binders/binders-service-common/lib/monitoring/prometheus/cspMetrics";
import { isManualToLogin } from "@binders/client/lib/util/user";
import { logUncaughtError } from "@binders/binders-service-common/lib/monitoring/apm";
import moment from "moment";

const MAX_QUERYABLE_USERACTIONS = 150000;

type UserActionsAggregatorType =
    typeof ChooseLanguageAggregator |
    typeof ItemCreationsAggregator |
    typeof ItemDeletionsAggregator |
    typeof ItemHardDeletionsAggregator |
    typeof ItemEditionsAggregator |
    typeof UserOnlineAggregator |
    typeof ReadSessionsAggregator |
    typeof RelabeledLanguageAggregator;

const INTERNAL_DATE_FORMAT = "dd/MM/yyyy";

export class TrackingService implements TrackingServiceContract {
    constructor(
        private eventRepository: EventRepository,
        private aggregationsRepository: MongoAggregationsRepository,
        private mostUsedLanguagesStatsRepository: MongoMostUsedLanguagesStatRepository,
        private readonly userActionsRepository: IUserActionsRepository,
        private readonly auditLogsRepository: IAuditLogRepository,
        private readonly lastAccountEventMappingRepository: ILastAccountEventMappingRepository,
        private readonly lastAccountUserActionsMappingRepository: ILastAccountUserActionsMappingRepository,
        private readonly userServiceClient: UserServiceClient,
        private readonly repoServiceClient: BinderRepositoryServiceClient,
        private readonly accountServiceClient: AccountServiceClient,
        private readonly routingServiceClient: RoutingServiceClient,
        private readonly authorizationServiceClient: AuthorizationServiceClient,
        private readonly manualToLocation: string,
        private readonly editorLocation: string,
        private readonly featureFlagService: IFeatureFlagService,
        private logger: Logger,
        private readonly config: Config
    ) {
    }

    async maybeSetLastAccountEvent(events: Event[]): Promise<void> {
        const userActionsRelatedEvents = events.filter(event => !NonUserActionEvents.includes(event.eventType));
        if (userActionsRelatedEvents.length === 0) {
            return;
        }
        const latestEventTimes: Record<string, Event> = userActionsRelatedEvents.reduce((reduced, event) => {
            if (!(reduced[event.eventType])) {
                return {
                    ...reduced,
                    [event.eventType]: event,
                }
            }
            if (moment(event.timestamp).isAfter(moment(reduced[event.eventType].timestamp))) {
                return {
                    ...reduced,
                    [event.eventType]: event,
                }
            }
            return reduced;
        }, {} as Record<string, Event>);

        await Promise.all(Object.values(latestEventTimes).map(event => this.logLastAccountEvent(
            event.timestamp,
            event.accountId,
            event.eventType,
        )));
    }

    private async verifyLogToken(token: string, userId: string): Promise<"valid" | "expired" | string> {
        const verifyConfig = buildLogTokenVerifyConfig(this.config);
        try {
            const jwtContent = await verifyJWT<{ userId: string }>(token, verifyConfig);
            if (jwtContent.userId === userId) {
                return "valid";
            } else {
                return `Invalid userId expected ${userId} but got ${jwtContent.userId}`;
            }
        } catch (e) {
            if (e.message === "jwt expired") return "expired";
            return e.message;
        }
    }

    private async filterAndTransformEvents(
        events: EventPayload[],
        authenticatedUserId?: string,
        isBackendUser?: boolean
    ): Promise<EventPayload[]> {
        const verifiedEvents: EventPayload[] = [];
        for (const event of events) {
            if (isBackendUser) {
                event.userId = event.userId ?? authenticatedUserId ?? "public";
                verifiedEvents.push(event);
            } else if (event.userId == null || event.userId === "public") {
                // Public events are not protected
                verifiedEvents.push(event);
            } else if (event.authToken == null) {
                // No authtoken provided even though there is a userId. Logging & falling back to "authenticatedUserId" or "public"
                this.logger.error(
                    "No authToken attached to the event when trying to log() an Event",
                    "tracking-events",
                    { event }
                );
                event.userId = authenticatedUserId ?? "public";
                verifiedEvents.push(event);
            } else {
                const logTokenVerifyResult = await this.verifyLogToken(event.authToken, event.userId);
                if (logTokenVerifyResult === "valid") {
                    verifiedEvents.push(event);
                } else if (logTokenVerifyResult === "expired") {
                    event.userId = authenticatedUserId ?? "public";
                    verifiedEvents.push(event);
                    this.logger.warn(
                        "Expired token when trying to log() an event",
                        "tracking-events",
                        { event }
                    );
                } else {
                    this.logger.error(
                        `Invalid token when trying to log() an event. Reason: ${logTokenVerifyResult}`,
                        "tracking-events",
                        { event }
                    );
                    event.userId = authenticatedUserId ?? "public";
                    throw new Error("Invalid JWT token for event.");
                }
            }
        }
        return verifiedEvents.map(e => omit(["authToken"], e));
    }

    async log(
        events: EventPayload[],
        userId?: string,
        isBackendUser?: boolean
    ): Promise<boolean> {
        const authenticatedUserId = userId === "public" ? undefined : userId;
        events = await this.filterAndTransformEvents(events, authenticatedUserId, isBackendUser);
        const domainEvents = dedupeEvents(events.map(event => Event.parseRequest(event)));
        const sortedDomainEvents = sortByDate(domainEvents, event => event.timestamp);
        this.maybeSetLastAccountEvent(sortedDomainEvents);
        sortedDomainEvents.forEach(event => {
            if (event.eventType === EventType.USER_IS_ONLINE) {
                this.userServiceClient.updateLastOnline(userId || event.data["userId"] as string);
            }
            if (event.eventType === EventType.BINDER_EDITED) {
                captureServerEvent(
                    ServerEvent.DocumentEdited,
                    {
                        userId: event.userId?.value(),
                        accountId: event.accountId
                    },
                    {
                        binderId: event.data?.["binderId"],
                        itemId: event.data?.["itemId"],
                        itemTitle: event.data?.["itemTitle"],
                        isoCode: event.data?.["isoCode"],
                    }
                );
            }
        });
        try {
            await this.eventRepository.logEvents(sortedDomainEvents);
            return true;
        } catch (error) {
            this.logger.error(
                "Could not save events to collection.",
                "tracking-events",
                { events: sortedDomainEvents, error }
            );
            return false;
        }
    }

    async createLogAuthToken(userId?: string): Promise<CreateLogAuthTokenResponse> {
        if (userId == null || userId === "public") {
            throw new Unauthorized("UserId is required")
        }
        const signConfig = buildLogTokenSignConfig(this.config)
        const token = await signJWT({ userId, purpose: "log-token" }, signConfig);
        return {
            token,
            userId,
            expiresOn: add(new Date(), { days: LOG_TOKEN_EXPIRATION_DAYS })
        };
    }

    async logAuditLog(
        logType: AuditLogType,
        userId: string,
        accountId?: string,
        userAgent?: string,
        data?: AuditLogData,
        ip?: string | string[],
        timestamp?: string
    ): Promise<boolean> {
        let auditLog: AuditLog;
        try {
            const now = new Date();
            const userAgentObj = buildUserAgentLogFormat(userAgent);

            auditLog = new AuditLog(
                logType,
                this.dateOrUndefined(timestamp) ?? now,
                now,
                userAgentObj,
                Array.isArray(ip) ? ip.join("-") : ip,
                data,
                accountId,
                userId,
            );
            await this.auditLogsRepository.logAudition(auditLog);
            return true;
        } catch (error) {
            this.logger.error(
                "Could not save events to collection.",
                "audit-logs",
                { events: auditLog, error }
            );
            return false;
        }
    }

    private dateOrUndefined(str?: string): Date | undefined {
        const date = parseJSON(str);
        return isValid(date) ? date : undefined;
    }

    async findAuditLogs(
        accountId: string,
        logType: AuditLogType,
        startDate?: Date,
        endDate?: Date
    ): Promise<ContractAuditLog[]> {
        const logs = await this.auditLogsRepository.findLogs({
            accountId, logType, startDate, endDate
        });
        return logs.map(toAuditLog);
    }

    async findActivePublicationsInUserActions(userActions: IUserAction[]): Promise<PublicationSummary[]> {
        const { publicationIdsSet, binderIdsSet } = userActions.reduce((reduced, userAction) => {
            let { publicationIdsSet, binderIdsSet } = reduced;
            const publicationId = (userAction.data as IUserActionDataReadSession).publicationId;
            const itemId = userAction.data.itemId; // in case of "not read" useractions
            if (publicationId) {
                publicationIdsSet = publicationIdsSet.add(publicationId);
            } else if (itemId) {
                binderIdsSet = binderIdsSet.add(itemId);
            }
            return { publicationIdsSet, binderIdsSet };
        }, { publicationIdsSet: new Set<string>(), binderIdsSet: new Set<string>() });
        const publicationIds = Array.from(publicationIdsSet);
        const binderIds = Array.from(binderIdsSet);
        return this.repoServiceClient.findPublicationsBackend(
            {
                ...(publicationIds.length ? { ids: publicationIds } : {}),
                ...(binderIds.length ? { binderIds } : {}),
                isActive: 1,
            },
            { maxResults: 10000, summary: true }
        ) as Promise<PublicationSummary[]>;
    }

    async logLastAccountEvent(
        time: Date,
        accountId: string,
        eventType: EventType,
    ): Promise<Maybe<LastAccountEventMapping>> {
        let newMapping: LastAccountEventMapping;
        try {
            newMapping = new LastAccountEventMapping(time, accountId, eventType);
            const insertedMapping = await this.lastAccountEventMappingRepository.setLatestEventTimeForAccount(newMapping);
            return Maybe.just(insertedMapping);
        } catch (error) {
            this.logger.error(
                "Could not save event-account mapping to collection.",
                "lastAccountEventMapping",
                { events: newMapping, error }
            );
            return Maybe.nothing();
        }
    }

    async getLatestEventTimeForAccount(accountId: string, eventTypes: EventType[]): Promise<Maybe<Date>> {
        try {
            return await this.lastAccountEventMappingRepository.getLatestEventTimeForAccount(accountId, eventTypes);
        } catch (error) {
            this.logger.error(
                `Could not retrieve last event time for account ${accountId}`,
                "lastAccountEventMapping",
                { error }
            );
            return Maybe.nothing();
        }
    }

    private async getPostFilterForItemIds(filter: IUserActionFilter) {
        const { accountId, itemIds, omitDescendantsInItemIds } = filter;
        if (omitDescendantsInItemIds) {
            return (userAction: IUserAction) => itemIds.includes(userAction.data.itemId);
        }
        const docTree: AncestorTree = await this.repoServiceClient.getAccountAncestorTree(accountId);
        return (userAction: IUserAction) => {
            const uaItemId = getUserActionItemId(userAction);
            return any(itemId => uaItemId === itemId || docTree.isDescendentOf(uaItemId, itemId), itemIds);
        }
    }

    async countUserActions(filter: IFindUserActionsFilter): Promise<number> {
        const userIds = await this.getUserIdsFromUserActionFilter(filter);
        const keysToOmitFromUAFilter = filter.omitDescendantsInItemIds ?
            ["limitResults"] :
            ["limitResults", "itemIds"];
        return await this.userActionsRepository.countUserActions(
            { ...omit(keysToOmitFromUAFilter, filter), userIds },
            filter.limitResults ?? undefined
        );
    }

    async findUserActions(
        filter: IFindUserActionsFilter,
        options?: FindUserActionsOptions
    ): Promise<UserActionsFindResult<IUserAction>> {

        if (options?.totalResultsLimit !== undefined) {
            const totalCount = await this.countUserActions(filter);
            if (totalCount > options.totalResultsLimit) {
                const exception: FindUserActionsException = { type: "limit", total: totalCount, limit: options.totalResultsLimit };
                return {
                    userActions: [],
                    exception: JSON.stringify(exception)
                }
            }
        }

        const { userActionTypes, skipUnpublished } = filter;
        const userIds = await this.getUserIdsFromUserActionFilter(filter);

        const keysToOmitFromUAFilter = filter.omitDescendantsInItemIds ?
            ["limitResults"] :
            ["limitResults", "itemIds"];

        const filterByContent = filter.itemIds?.length > 0 ?
            await this.getPostFilterForItemIds(filter) :
            () => true;

        let userActions = await this.userActionsRepository.find(
            { ...omit(keysToOmitFromUAFilter, filter), userIds },
            filterByContent,
            filter.limitResults ?? undefined
        );

        let notReadActions: IUserAction[] = [];
        const hasNotReadFilter = userActionTypes && userActionTypes.indexOf(UserActionType.NOT_READ) > -1;
        if (hasNotReadFilter) {
            const { allElements, collectionIds } = await this.getFilterElementsFromUserActionFilter(filter);
            notReadActions = await this.buildNotReadActions(
                filter,
                userIds,
                allElements,
                collectionIds,
            );
        }
        if (skipUnpublished) {
            const activePublications = await this.findActivePublicationsInUserActions([...userActions, ...notReadActions]);
            userActions = this.filterUnpublishedFromUserActions(userActions, activePublications);
            notReadActions = this.filterUnpublishedFromUserActions(notReadActions, activePublications);
        }

        return {
            userActions: !hasNotReadFilter ?
                userActions :
                [
                    ...userActions,
                    ...notReadActions,
                ],
        }
    }

    private async getUserIdsFromUserActionFilter(filter: IUserActionFilter): Promise<string[]> {
        const { accountId, userGroupIds, userIds: ids } = filter;
        if (!userGroupIds || userGroupIds.length === 0) {
            return ids as string[];
        }
        const usergroupMap = await this.userServiceClient.multiGetGroupMemberIds(
            accountId,
            userGroupIds,
        );
        return Object.keys(usergroupMap).reduce((reduced, usergroupId) => {
            reduced.push(...usergroupMap[usergroupId]);
            return reduced;
        }, [] as string[]);
    }

    private async getFilterElementsFromUserActionFilter(filter: IUserActionFilter): Promise<{ allElements: string[]; collectionIds: string[] }> {
        const { itemIds, recursive } = filter;
        if (recursive && itemIds && itemIds.length > 0) {
            const foundItems = itemIds.length === 0 ?
                [] :
                await this.repoServiceClient.findItems(
                    { binderIds: itemIds },
                    { maxResults: 10000 },
                );

            const collectionsQueried = foundItems
                .filter(item => item["kind"] === "collection")
                .map(item => item.id);

            const elementsQueried = foundItems
                .filter(item => !item["kind"] || item["kind"] !== "collection")
                .map(item => item.id);

            const collectionElements = await this.repoServiceClient.getCollectionsElements(
                collectionsQueried,
                true
            );
            const uniqueElements = new Set([...elementsQueried, ...collectionElements.map(e => e.key)]);
            return {
                allElements: Array.from(uniqueElements),
                collectionIds: [
                    ...collectionsQueried,
                    ...collectionElements.filter(el => el.kind === "collection").map(el => el.key),
                ],
            };
        }
        return {
            allElements: itemIds,
            collectionIds: [],
        };
    }

    private filterUnpublishedFromUserActions(userActions: IUserAction[], activePublications: PublicationSummary[]) {
        return userActions.reduce((reduced, userAction) => {
            const publicationId = (userAction.data as IUserActionDataReadSession).publicationId;
            const binderId = userAction.data["itemId"];
            if (!publicationId && !binderId) { // filtering unpublished doesn't apply for this useraction
                return reduced.concat(userAction);
            }
            if (activePublications.some(p => p.id === publicationId || p.binderId === binderId)) {
                reduced.push(userAction);
            }
            return reduced;
        }, []);
    }

    private async buildNotReadActions(
        filter: IUserActionFilter,
        userIds: string[],
        allElements: string[],
        collectionIds: string[],
    ): Promise<IUserAction[]> {
        const { accountId, itemIds } = filter;
        const actionsWithReadData = await this.userActionsRepository.find({
            ...filter,
            userIds,
            userActionTypes: [UserActionType.DOCUMENT_READ],
            itemIds: allElements,
        });
        const { members } = await this.accountServiceClient.getAccount(accountId);
        const filteredMembers = userIds.length === 0 ?
            members :
            members.filter(
                userId => userIds.indexOf(userId) > -1,
            );
        const ids = allElements.length === 0 ? itemIds : allElements;
        const hasSpecificIds = ids.length > 0;
        const notReadData = hasSpecificIds ?
            [] :
            await this.buildNotReadActionsFromAllItems(
                filter.accountId,
                actionsWithReadData,
                filteredMembers,
            );

        const onlyDocuments = ids.filter(id => collectionIds.indexOf(id) === -1);
        return onlyDocuments.reduce((data, itemId) => {
            filteredMembers.forEach(userId => {
                const hasNoItemIdForUserId = actionsWithReadData.findIndex(
                    this.hasItemIdForUserId(userId, itemId),
                ) === -1;
                if (hasNoItemIdForUserId) {
                    data.push(this.makeNewNotReadItem(itemId, accountId, userId));
                }
            });
            return data;
        }, notReadData);
    }

    private async buildNotReadActionsFromAllItems(
        accountId: string,
        actionsWithReadData: IUserAction[],
        userIds: string[],
    ): Promise<IUserAction[]> {
        const accountItems = await this.repoServiceClient.findItems(
            { accountId },
            { maxResults: MAX_RESULTS },
        );
        return userIds.reduce((out, userId) => {
            const userActionsWithReadData = actionsWithReadData
                .filter(a => a.userId === userId);
            accountItems
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .filter((item: any) => item.kind !== "collection")
                .filter(item => userActionsWithReadData.findIndex(b => b.data.itemId === item.id) === -1)
                .forEach(item => out.push(this.makeNewNotReadItem(
                    item.id,
                    accountId,
                    userId,
                )));
            return out;
        }, [] as IUserAction[]);
    }

    private makeNewNotReadItem(
        itemId: string,
        accountId: string,
        userId: string,
    ): IUserAction {
        return {
            id: itemId,
            index: "",
            accountId,
            userId,
            data: {
                itemId,
                itemKind: "not read",
            },
            userActionType: UserActionType.NOT_READ,
        };
    }

    private hasItemIdForUserId(userId: string, itemId: string): (a: IUserAction) => boolean {
        return (a: IUserAction) => (
            a.userId === userId && (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                a.data.itemId === itemId || (<any>a.data).publicationId === itemId
            )
        );
    }

    // per binder(s)
    async allBinderStatistics(binderId: string, filter: IEventFilter, accountId: string): Promise<IAllDocumentStatistics> {
        const [
            chunkTimings,
            languageStatistics,
            { viewsAnalytics, viewsPerMonthStatistics }
        ] = await Promise.all([
            this.getChunkTimings(accountId, binderId, filter.range?.rangeStart, filter.range?.rangeEnd),
            this.languageStatisticsByBinder(accountId, binderId, filter.range?.rangeStart, filter.range?.rangeEnd),
            this.userActionsViewsStatistics(binderId, accountId)
        ]);
        return {
            chunkTimings,
            languageStatistics,
            viewsAnalytics,
            viewsPerMonthStatistics,
        };
    }


    async collectionLanguageStatistics(collectionId: string, filter: IEventFilter): Promise<ICollectionLanguageStatistics> {
        const collectionLanguageAnalytics = await this.languageStatistics(collectionId, filter);
        return { collectionLanguageAnalytics };
    }

    async allViewsStatistics(itemIds: string[], accountId: string): Promise<IAllViewsStatistics> {
        return this.userActionsRepository.countPerItemId({
            accountId,
            itemIds,
            userActionTypes: [UserActionType.DOCUMENT_READ],
        });
    }


    async binderStatistics(binderIds: Array<string>, filter: IEventFilter): Promise<IBinderStatistics[]> {
        if (binderIds.length === 0) {
            return [];
        }
        const userActionFilter: UserActionsFilter = {
            itemIds: binderIds
        }
        if (filter.range) {
            userActionFilter.startRange = {
                rangeStart: filter.range.rangeStart,
                rangeEnd: filter.range.rangeEnd
            }
        }
        const [views, edits, createdStats, binders] = await Promise.all([
            this.userActionsRepository.countPerItemId({
                ...userActionFilter,
                userActionTypes: [UserActionType.DOCUMENT_READ],
            }),
            this.userActionsRepository.countPerItemId({
                ...userActionFilter,
                userActionTypes: [UserActionType.ITEM_EDITED]
            }),
            this.userActionsRepository.find({
                ...userActionFilter,
                userActionTypes: [UserActionType.ITEM_CREATED]
            }),
            binderIds.length === 0 ?
                Promise.resolve([]) :
                this.repoServiceClient.findBindersBackend(
                    { binderIds },
                    { maxResults: binderIds.length }
                )
        ]);
        const uniqueUserIds = createdStats.reduce(
            (acc, createdStats) => acc.add(createdStats.userId || "public"),
            new Set<string>()
        );
        const users = uniqueUserIds.size > 0 ?
            (await this.userServiceClient.findUserDetailsForIds(Array.from(uniqueUserIds))) :
            [];
        const usersById = {};
        users.forEach(user => {
            usersById[user.id] = user.displayName || user.login
        });
        const statsById = {};
        for (const binderId of binderIds) {
            const binderCreationStats = createdStats.find(s => s.data.itemId === binderId);
            const created = binderCreationStats && binderCreationStats.start;
            const createdByUserId = binderCreationStats && binderCreationStats.userId;
            const createdBy = createdByUserId && usersById[createdByUserId];
            const binder = binders.find(b => b.id === binderId);
            const { lastEdit, lastEditBy, lastEditByUserId } = binder ?
                getLastEditInfo(binder) :
                { lastEdit: new Date(0), lastEditBy: "n/a", lastEditByUserId: "n/a" };
            statsById[binderId] = {
                created,
                createdBy,
                createdByUserId,
                lastEdit,
                lastEditBy,
                lastEditByUserId,
            }
        }
        return binderIds.map(binderId => ({
            _id: binderId,
            views: views[binderId] || 0,
            edits: edits[binderId] || 0,
            created: statsById[binderId].created,
            createdBy: statsById[binderId].createdBy,
            createdByUserId: statsById[binderId].createdByUserId,
            lastEdit: statsById[binderId].lastEdit,
            lastEditBy: statsById[binderId].lastEditBy,
            lastEditByUserId: statsById[binderId].lastEditByUserId
        }));
    }

    findEvents(accountId: string, eventFilter: IEventFilter, options?: SearchOptions): Promise<ClientEvent[]> {
        return this.eventRepository.findEvents(accountId, eventFilter, options);
    }

    findEventsInRange(
        accountId: string,
        eventFilter: IEventFilter,
        options?: SearchOptions
    ): Promise<ClientEvent[]> {
        return this.eventRepository.findEventsInRange(accountId, eventFilter, options);
    }

    async documentCreationsStatistics(accountId: string): Promise<IDocumentCreationsStatistics[]> {
        const filter = {
            accountId,
            userActionTypes: [UserActionType.ITEM_CREATED]
        };
        const aggregation: DateHistogramAggregation<IUserAction> = {
            groupBy: "start",
            agg: "date_histogram",
            resolution: "days"
        }
        const aggStats = await this.userActionsRepository.aggregate(filter, aggregation);
        const result: IDocumentCreationsStatistics[] = [];
        for (const creationTimeKey in aggStats) {
            result.push({
                date: new Date(Number.parseInt(creationTimeKey, 10)),
                creations: aggStats[creationTimeKey]
            });
        }
        return this.fillInMissingDataPoints(result, this.getNumberOfDaysSinceBeginning(), "creations");
    }

    async itemEditsStatistics(accountId: string): Promise<IItemEditsStatistics[]> {
        const filter = {
            accountId,
            userActionTypes: [UserActionType.ITEM_EDITED]
        };
        const aggregation: DateHistogramAggregation<IUserAction> = {
            groupBy: "start",
            agg: "date_histogram",
            resolution: "days"
        }
        const aggStats = await this.userActionsRepository.aggregate(filter, aggregation);
        const result: IItemEditsStatistics[] = [];
        for (const creationTimeKey in aggStats) {
            result.push({
                date: new Date(Number.parseInt(creationTimeKey, 10)),
                edits: aggStats[creationTimeKey]
            });
        }
        return this.fillInMissingDataPoints(result, this.getNumberOfDaysSinceBeginning(), "edits");
    }

    private fillInMissingDataPoints(result, numberOfRequiredDays, key) {
        const missingMoment = moment()
            .subtract(numberOfRequiredDays - 1, "days")
            .startOf("day");
        let previousMoment = undefined;
        let nextSample = result.shift();
        let nextMoment;
        if (nextSample) {
            nextMoment = moment(nextSample.date);
        }
        const complete = [];
        for (let i = 0; i < numberOfRequiredDays; i++) {
            previousMoment = moment(missingMoment);
            missingMoment.add(1, "day");
            if (nextMoment && nextMoment.isSameOrAfter(previousMoment) && nextMoment.isBefore(missingMoment)) {
                complete.push(nextSample);
                nextSample = result.shift();
                if (nextSample) {
                    nextMoment = moment(nextSample.date);
                }
            } else {
                complete.push({
                    date: previousMoment.toDate(),
                    [key]: 0
                });
            }
        }
        return complete;
    }

    async documentDeletionsStatistics(accountId: string): Promise<IDocumentDeletionsStatistics[]> {
        const filter = {
            accountId,
            userActionTypes: [UserActionType.ITEM_DELETED]
        };
        const aggregation: DateHistogramAggregation<IUserAction> = {
            groupBy: "start",
            agg: "date_histogram",
            resolution: "days"
        }
        const aggStats = await this.userActionsRepository.aggregate(filter, aggregation);
        const result: IDocumentDeletionsStatistics[] = [];
        for (const creationTimeKey in aggStats) {
            result.push({
                date: new Date(Number.parseInt(creationTimeKey, 10)),
                deletions: aggStats[creationTimeKey]
            });
        }
        return this.fillInMissingDataPoints(result, this.getNumberOfDaysSinceBeginning(), "deletions");
    }

    async searchUserActions(filter: IFindUserActionsFilter, userId?: string, isBackend?: boolean): Promise<UserActionsFindResult<IUserActionSummary>> {
        let updatedFilter: IFindUserActionsFilter = undefined;
        if (isBackend || await this.isUserAccountAdmin(userId, filter.accountId)) {
            updatedFilter = filter;
        } else {
            const uniqueItemIds = await this.findItemIdsWithAdminPermsForUser(userId, filter.accountId);
            if (uniqueItemIds.length === 0) {
                this.logger.warn(`User ${userId} is not admin on any items`, "searchUserActions");
                throw new Unauthorized("Not allowed");
            }
            if (filter.itemIds.length === 0) {
                // Limit search to collections with admin permissions
                updatedFilter = { ...filter, itemIds: uniqueItemIds };
            } else {
                // Filter out itemIds for which a user does not have admin permissions
                const docTree = await this.repoServiceClient.getAccountAncestorTree(filter.accountId);
                const sanitizedItemIds = filter.itemIds.filter(
                    itemId => uniqueItemIds.some(ancestorItemId => itemId === ancestorItemId || docTree.isDescendentOf(itemId, ancestorItemId))
                );
                if (sanitizedItemIds.length === 0) {
                    this.logger.warn(`After sanitization user ${userId} is not admin for provided itemIds ${JSON.stringify(filter.itemIds)}`, "searchUserActions");
                    throw new Unauthorized("Not allowed");
                }
                updatedFilter = { ...filter, itemIds: sanitizedItemIds };
            }
        }
        return this.userActionsStatistics(updatedFilter);
    }

    private async findItemIdsWithAdminPermsForUser(userId: string, accountId: string): Promise<string[]> {
        const resourceGroups = await this.authorizationServiceClient.findAllowedResourceGroups(
            userId,
            ResourceType.DOCUMENT,
            PermissionName.ADMIN,
            true,
            accountId
        );
        const itemIds = resourceGroups.flatMap(rg => rg.ids);
        return Array.from(new Set(itemIds));
    }

    private async isUserAccountAdmin(userId: string, accountId: string): Promise<boolean> {
        const userIds = await this.authorizationServiceClient.getAccountAdmins(accountId);
        return userIds.includes(userId);
    }

    async searchUserReadSessions(filter: UserReadSessionsFilter): Promise<UserActionsFindResult<IUserActionSummary>> {
        return this.userActionsStatistics({
            ...filter,
            userActionTypes: [UserActionType.DOCUMENT_READ]
        });
    }

    private async userActionsStatistics(filter: IFindUserActionsFilter): Promise<UserActionsFindResult<IUserActionSummary>> {
        const { accountId, shouldIncludeParentPaths } = filter;
        filter.excludeUserActionTypes = filter.excludeUserActionTypes ?? [];
        filter.excludeUserActionTypes.push(UserActionType.CHOOSE_LANGUAGE);

        const findResult = await this.findUserActions(filter, { totalResultsLimit: MAX_QUERYABLE_USERACTIONS });
        if (findResult.exception) {
            return { userActions: [], exception: findResult.exception };
        }
        const userActions = findResult.userActions;

        const userIds = userActions
            .map(u => u.userId)
            .filter(id => id?.indexOf("uid-") === 0);
        const distinctUserIds = Array.from(new Set(userIds));
        const users = await this.userServiceClient.findUserDetailsForIds(distinctUserIds);

        const features = await this.accountServiceClient.getAccountFeatures(accountId);
        const usergroupMap = features.includes(FEATURE_USERGROUPS_IN_USERACTION_EXPORT) ?
            await this.userServiceClient.getGroupsForUsers(distinctUserIds, accountId) :
            {};

        const [domainFilter] = await this.routingServiceClient.getDomainFiltersForAccounts([accountId]);
        const { domain } = domainFilter;
        const titles = await this.getItemTitles(userActions);

        const itemsAncestors = shouldIncludeParentPaths ?
            await this.getParentPathsForUserActionItems(userActions) :
            undefined;

        const obfuscateReadingTimesConfig = await this.featureFlagService.getFlag<ObfuscatedReadingTimeConfiguration>(LDFlags.OBFUSCATED_READING_TIME_CONFIGURATION);
        const userActionsSummaries = userActions.map(action =>
            this.userActionToAdvancedStatistics(action, users, usergroupMap, domain, titles, itemsAncestors, obfuscateReadingTimesConfig)
        );
        return { userActions: userActionsSummaries };
    }

    private async getParentPathsForUserActionItems(userActions: IUserAction[]): Promise<Record<string, string[]>> {
        const itemIds = this.getItemIdsFromUserActions(userActions);
        const ancestors = await this.repoServiceClient.getItemsAncestors(itemIds);
        const preparedTitles = await this.getCollectionsTitles(ancestors);
        return itemIds.reduce((prev, id) => {
            try {
                prev[id] = this.buildAncestors(id, ancestors, preparedTitles, []);
            } catch (ex) {
                this.logger.error(`Circular path for id ${id}`, "read-sessions");
                prev[id] = [];
            }
            return prev;
        }, {} as Record<string, string[]>);
    }


    private async userActionsViewsStatistics(
        itemId: string,
        accountId: string
    ): Promise<{ viewsAnalytics: IViewsStatistics, viewsPerMonthStatistics: IViewsStatistics }> {
        const filter = {
            accountId,
            itemIds: [itemId],
            userIds: [],
            userGroupIds: [],
            startRange: { rangeStart: new Date("01/01/1980") },
            userActionTypes: [UserActionType.DOCUMENT_READ],
            recursive: false,
        }
        const userActionsFindResult = await this.findUserActions(filter);
        const userActions: IUserAction[] = userActionsFindResult.userActions;
        const groupedByDays = userActions.reduce((prev, current) => {
            const dateBeingProcessed = fmtDate(new Date(current.start), INTERNAL_DATE_FORMAT);
            if (prev[dateBeingProcessed]) {
                prev[dateBeingProcessed]++;
                return prev;
            }
            return { ...prev, [dateBeingProcessed]: 1 };
        }, {} as { [date: string]: number });

        const perDayStatistics = Array.from(Array(401).keys()).map(i => {
            const date = subDays(Date.now(), i);
            const views = groupedByDays[fmtDate(date, INTERNAL_DATE_FORMAT)] ?? 0;
            return { date, views };
        }).reverse();

        const perMonthStatistics = Object.keys(groupedByDays).reduce((prev, currentDate) => {
            const currentViews = groupedByDays[currentDate];
            const currentParsedDate = parse(currentDate, INTERNAL_DATE_FORMAT, new Date());
            const monthBeingProcessed = fmtDate(currentParsedDate, "MM/yyyy");
            if (prev[monthBeingProcessed]) {
                prev[monthBeingProcessed].views += currentViews;
                return prev;
            }
            return { ...prev, [monthBeingProcessed]: { date: startOfMonth(currentParsedDate), views: currentViews } };
        }, {});
        return {
            viewsAnalytics: {
                [itemId]: perDayStatistics
            },
            viewsPerMonthStatistics: {
                [itemId]: Object.values(perMonthStatistics)
            },
        }
    }

    private userActionToAdvancedStatistics(
        userAction: IUserAction,
        users: User[],
        usergroupMap: UsergroupsPerUser,
        domainFromFilter: string,
        titles: Map<string, string>,
        itemsAncestors: { [itemId: string]: Array<string> },
        obfuscateReadingTimesConfiguration?: ObfuscatedReadingTimeConfiguration,
    ): IUserActionSummary {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { userId, data, userActionType, start, end, duration: uaDuration } = userAction as IUserAction<any>;
        const { itemKind, itemId, publicationId, itemTitle, title: dTitle } = data;
        let duration = uaDuration;
        if (duration === undefined) {
            const seconds = end ? differenceInSeconds(new Date(end), new Date(start)) : -1;
            duration = seconds > 0 ? seconds : 0;
        }

        let title = "", url = "";

        if (publicationId) {
            title = itemTitle || dTitle || titles.get(publicationId) || "";
            url = this.buildUserActionUrl(userActionType, "publication", domainFromFilter, publicationId);
        } else if (["collection", "binder"].indexOf(itemKind) > -1) {
            title = itemTitle || dTitle || titles.get(itemId);
            if (!title) {
                title = "item deleted";
            }
            url = this.buildUserActionUrl(userActionType, itemKind, domainFromFilter, itemId);
        } else if (itemKind === "not read") {
            title = itemTitle || dTitle || titles.get(itemId);
            url = this.buildUserActionUrl(userActionType, "binder", domainFromFilter, itemId);
        }

        const userActionTranslationKey = getUserActionTranslationKey(userActionType);
        const userActionExtraInfo = [
            UserActionType.LANGUAGE_ADDED,
            UserActionType.LANGUAGE_DELETED,
            UserActionType.DOCUMENT_PUBLISHED,
            UserActionType.DOCUMENT_UNPUBLISHED,
        ].includes(userActionType) ?
            `: ${(data as ILanguageOperationData).languageCode}` :
            "";

        const userGroupNames = usergroupMap[userId] ? usergroupMap[userId].map(g => g.name) : [];

        const numberOfAncestorColumns = 10;
        const { displayName, login, userTags } = this.getUserDetailsForUserAction(userAction, users);
        const isReadingTimeObfuscated = userActionType === UserActionType.DOCUMENT_READ && obfuscateReadingTimesConfiguration?.openedSeconds;
        return {
            userDisplayName: displayName,
            userEmail: login,
            userActionTranslationKey,
            userActionExtraInfo,
            title,
            timestamp: start,
            duration: isReadingTimeObfuscated ? 0 : duration,
            obfuscatedDuration: isReadingTimeObfuscated ?
                this.#obfuscateDuration(duration, obfuscateReadingTimesConfiguration) :
                undefined,
            url,
            id: itemId,
            ...(itemsAncestors ? { ancestors: this.cropToNItems(itemsAncestors[itemId], numberOfAncestorColumns) } : {}),
            userTags: userTags,
            userGroupNames,
        };
    }

    #obfuscateDuration(duration: number, config: ObfuscatedReadingTimeConfiguration): IUserActionSummary["obfuscatedDuration"] {
        if (duration > (config.openedSeconds.min ?? 0) && duration <= config.openedSeconds.max) return "opened";
        if (duration > (config.skimmedSeconds.min ?? 0) && duration <= config.skimmedSeconds.max) return "skimmed";
        if (duration > (config.readSeconds.min ?? 0) && duration <= (config.readSeconds.max ?? Infinity)) return "read";
        return "unknown";
    }

    private getUserDetailsForUserAction(
        userAction: IUserAction,
        users: User[]
    ): { displayName: string, login: string, userTags: IUserTag[] } {
        if (userAction.userId === "uid-repo-service") {
            return {
                displayName: "Manual.to backend",
                login: "",
                userTags: []
            }
        }
        if (userAction.userId === "uid-purge-bins") {
            return {
                displayName: "Automatic deletion",
                login: "",
                userTags: []
            }
        }
        const user = users.find(u => u.id === userAction.userId);
        if (user) {
            return {
                displayName: user.displayName === user.login ? "" : user.displayName,
                login: user.login,
                userTags: user.userTags || [],
            }
        }
        return {
            displayName: "public",
            login: "",
            userTags: []
        }
    }

    private buildUserActionUrl(
        userActionType: UserActionType,
        itemKind: "binder" | "publication" | "collection",
        domainFromFilter: string,
        itemId: string,
    ): string {
        const isReaderLink = [
            UserActionType.DOCUMENT_READ,
            UserActionType.USER_ONLINE,
            UserActionType.COLLECTION_VIEW,
            UserActionType.DOCUMENT_PUBLISHED,
            UserActionType.DOCUMENT_UNPUBLISHED,
        ].includes(userActionType);
        return isReaderLink ?
            buildReaderItemUrl(itemKind, domainFromFilter, itemId, this.manualToLocation) :
            buildEditorItemUrl(itemKind, domainFromFilter, itemId, this.editorLocation);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private getItemIdsFromUserActions(userActions: IUserAction<any>[]): string[] {
        const itemIds = new Set<string>();
        userActions.forEach(ua => {
            const { itemId } = ua.data;
            if (itemId) {
                itemIds.add(itemId);
            }
        });
        return Array.from(itemIds);

    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private async getItemTitles(userActions: IUserAction<any>[]): Promise<Map<string, string>> {
        const publicationIds = new Set<string>();
        const itemIds = new Set<string>();

        const titlesMap = new Map<string, string>();
        userActions.forEach(ua => {
            const { itemId, itemTitle, publicationId } = ua.data;
            if (itemTitle && publicationId) {
                if (!titlesMap.has(publicationId)) {
                    titlesMap.set(publicationId, itemTitle);
                }
            } else {
                if (publicationId) {
                    publicationIds.add(publicationId);
                } else {
                    if (itemId) {
                        itemIds.add(itemId);
                    }
                }
            }
        });

        this.logger.debug(`Amount of titles we need to fetch ${publicationIds.size} + ${itemIds.size}`, "useraction-titles");
        if (publicationIds.size > 0) {
            const distinctPublicationIds = Array.from(publicationIds);
            const distinctPublicationIdsChunks = splitEvery(1024, distinctPublicationIds);
            for (const distinctPublicationIdsChunk of distinctPublicationIdsChunks) {
                const publicationFilter = { ids: distinctPublicationIdsChunk as string[] };
                const options = { maxResults: distinctPublicationIdsChunk.length };
                const publications = await this.repoServiceClient.findPublicationsBackend(publicationFilter, options);
                for (const publication of publications) {
                    titlesMap.set(publication.id, publication.language.storyTitle);
                }
            }
        }
        if (itemIds.size > 0) {
            const distinctItemIds = Array.from<string>(itemIds);
            const distictItemIdsChunks = splitEvery(512, distinctItemIds);
            for (const distictItemIdsChunk of distictItemIdsChunks) {
                const options = { maxResults: distictItemIdsChunk.length };
                const items = distictItemIdsChunk.length === 0 ?
                    [] :
                    await this.repoServiceClient.findItems({ binderIds: distictItemIdsChunk }, options);
                for (const item of items) {
                    titlesMap.set(item.id, extractTitle(item));
                }
            }
        }
        return titlesMap;
    }

    // per account
    async loginStatistics(accountId: string): Promise<ILoginStatistics[]> {
        const filter = {
            accountId,
            userActionTypes: [UserActionType.USER_ONLINE]
        };
        const sumAgg = {
            agg: "sum",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            groupBy: ("data.numberOfUsers" as any)
        }
        const aggregation: DateHistogramAggregation<IUserAction> = {
            groupBy: "start",
            agg: "date_histogram",
            resolution: "days",
            aggregation: sumAgg
        }
        const aggStats = await this.userActionsRepository.aggregate(filter, aggregation);
        const result: ILoginStatistics[] = [];
        for (const creationTimeKey in aggStats) {
            result.push({
                date: new Date(Number.parseInt(creationTimeKey, 10)),
                logins: aggStats[creationTimeKey]
            });
        }
        return this.fillInMissingDataPoints(result, this.getNumberOfDaysSinceBeginning(), "logins");
    }

    private getNumberOfDaysSinceBeginning(from = BEGINNING_OF_2017): number {
        return differenceInDays(Date.now(), from);
    }

    async userCountStatistics(accountId: string): Promise<IUserCountStatistics[]> {
        const account = await this.accountServiceClient.getAccount(accountId);
        const users = account && await this.userServiceClient.findUserDetailsForIds(account.members);
        if (!users?.length) {
            return [];
        }
        const numberOfDaysSinceBeginning = this.getNumberOfDaysSinceBeginning(new Date(account.created));
        const daysRange = this.buildRange(numberOfDaysSinceBeginning);
        const datesMap = this.createRangeSkeleton(daysRange, { count: 0 });

        const accountMemberships = await this.accountServiceClient.findAccountMemberships(accountId);

        const sortedAccountMemberships = sortByDate(accountMemberships, e => e.start);
        // Some account memberships are lacking the end date, we need to artificially populate it
        for (let i = 0; i < sortedAccountMemberships.length - 1; i++) {
            if (!sortedAccountMemberships[i].end) {
                sortedAccountMemberships[i].end = sortedAccountMemberships[i + 1].start;
            }
        }

        const asUserCountStatistic = (date: Date): IUserCountStatistics => {
            const accountMembership = sortedAccountMemberships.find(({ start, end }) => isInRange(date, start, end));
            return { date, count: accountMembership?.memberCount ?? 0 };
        };
        return Object.keys(datesMap)
            .map(dateStr => new Date(dateStr))
            .map(date => asUserCountStatistic(date));
    }

    async accountViewsStatistics(accountId: string, excludeAuthors?: boolean): Promise<IAccountViewsStatistics> {

        const numberOfDaysSinceBeginning = this.getNumberOfDaysSinceBeginning();
        const range = this.buildRange(numberOfDaysSinceBeginning);
        const rangeSkeleton = this.createRangeSkeleton(range, { views: 0 });

        const filter = {
            accountId,
            userActionTypes: [UserActionType.DOCUMENT_READ],
            ...(excludeAuthors ? { userIsAuthor: false } : {}),
        };
        const aggregation: DateHistogramAggregation<IUserAction> = {
            agg: "date_histogram",
            groupBy: "start",
            resolution: "days"
        }
        const stats = await this.userActionsRepository.aggregate(filter, aggregation);

        for (const statKey in stats) {
            const statDate = fromUnixTime(Number.parseInt(statKey, 10) / 1000);
            const skeletonKey = fmtDateIso8601(statDate);
            const views = stats[statKey];
            rangeSkeleton[skeletonKey].views += views;
        }
        return rangeSkeleton;
    }

    private buildRange(daysCount: number): Required<IRange> {
        const now = new Date();
        return {
            rangeStart: startOfDay(subDays(now, daysCount)),
            rangeEnd: endOfDay(now),
        };
    }

    private createRangeSkeleton<T extends Record<string, number>>(
        { rangeStart, rangeEnd }: Required<IRange>,
        initObj: T,
    ): Record<string, T & { date: Date }> {
        const output: Record<string, T & { date: Date }> = {};
        let currentDate = rangeStart;
        while (isBefore(currentDate, rangeEnd)) {
            output[fmtDateIso8601(currentDate)] = {
                ...initObj,
                date: currentDate
            };
            currentDate = addDays(currentDate, 1);
        }
        return output;
    }

    getChunkTimings(
        accountId: string,
        binderId: string,
        rangeStart?: Date,
        rangeEnd?: Date,
    ): Promise<ChunkTimingsPerPublication> {
        return this.userActionsRepository.getChunkTimings(
            accountId,
            binderId,
            rangeStart ? { rangeStart } : {},
            rangeEnd ? { rangeEnd } : {},
        );
    }

    private async extractPublicationIdToStoryTitleMap(documentEvents: EventsByDocumentId) {
        const publicationIds = new Set<string>();
        for (const events of documentEvents.values()) {
            const firstOpenedDocument = events.find(event => event.eventType === EventType.DOCUMENT_OPENED);
            const publicationId = firstOpenedDocument?.data?.["documentId"] as string;
            if (publicationId != null) {
                publicationIds.add(publicationId);
            }
        }
        const publications = publicationIds.size > 0 ?
            await this.repoServiceClient.findPublicationsBackend({ ids: [...publicationIds] }, { maxResults: MAX_RESULTS }) :
            [];
        return publications.reduce((titlesMap, publication) =>
            titlesMap.set(publication.id, publication.language.storyTitle), new Map<string, string>());
    }

    private async extractUserIdToUserLoginMap(documentEvents: EventsByDocumentId) {
        const uniqueUserIds = new Set<string>();
        for (const events of documentEvents.values()) {
            events.map(event => event.userId?.value())
                .filter(userId => userId != null)
                .forEach(userId => uniqueUserIds.add(userId));
        }
        const userDetails = await this.userServiceClient.findUserDetailsForIds([...uniqueUserIds]);
        return userDetails.reduce((idsToLogins, user) =>
            idsToLogins.set(user.id, user.login), new Map<string, string>());
    }

    private normalizeReadSessions(readSessions: IDocumentReadSession[]) {
        const twoHoursMs = 7200000;
        return readSessions
            .reduce((reduced, readSession) => {
                if (readSession.incomplete) {
                    return reduced.concat(readSession);
                }
                // for complete read sessions: omit sessions shorter than 1 second, truncate sessions longer than 2 hours
                const { start, end: proposedEnd } = readSession;
                const durationMs = proposedEnd.getTime() - start.getTime();
                readSession.truncated = false;
                if (durationMs < 1000) {
                    return reduced;
                }
                if (durationMs > twoHoursMs) {
                    readSession.end = moment(start).add(2, "hours").toDate();
                    readSession.duration = 7200;
                    readSession.truncated = true;
                } else {
                    readSession.duration = Math.round(durationMs / 1000);
                }
                return reduced.concat(readSession);
            }, []);
    }

    private readSessionsForPublication(
        publication: Publication,
        events: Event[],
        publicationLanguage: string,
        publicationIdToStoryTitle: Map<string, string>,
        userIdToUserLogin: Map<string, string>,
        incompleteReadSessions: IDocumentReadSession[],
    ): IDocumentReadSessionsMap {
        const { id: publicationId, authorIds } = publication;

        const readSessionsMap = events.reduce((reduced, event) => {
            const userId = event.userId?.value();
            const eventTimestamp = new Date(event.timestamp);
            const { binderId, sessionId } = event.data as { binderId: string, sessionId: string };

            const language = publicationLanguage || UNDEFINED_LANG;

            const { toAdd: toAddSoFar, toComplete: toCompleteSoFar } = reduced;

            let readSession = toAddSoFar.find(rs => rs.sessionId === sessionId);
            if (!readSession) {
                readSession = toCompleteSoFar.find(rs => rs.sessionId === sessionId);
            }

            switch (event.eventType) {
                case EventType.DOCUMENT_OPENED: {
                    const newReadSession: IDocumentReadSession = {
                        documentId: publicationId,
                        binderId,
                        language,
                        documentName: publicationIdToStoryTitle.get(publicationId),
                        start: eventTimestamp,
                        end: undefined,
                        duration: 0,
                        truncated: false,
                        userId: userId || "public",
                        userLogin: userId ? userIdToUserLogin.get(userId) : "",
                        sessionId,
                        timeInactive: 0,
                        lastActivityTimestamp: eventTimestamp,
                        incomplete: true,
                        userIsAuthor: userId && (authorIds || []).includes(userId),
                        path: event.data["path"] as string,
                        semanticLinkId: event.data["semanticLinkId"] as string,
                        chunkTimingsMap: initializeChunkTimingsMap(publication),
                    };
                    if (!toAddSoFar.some(rs => rs.start === eventTimestamp)) {
                        toAddSoFar.push(newReadSession);
                    }
                    break;
                }
                case EventType.CHUNK_BROWSED:
                    if (readSession) {
                        readSession.end = eventTimestamp;
                        const chunkIndex = event.data["oldChunk"] as number;
                        if (chunkIndex == null) {
                            break;
                        }
                        if (!(readSession.chunkTimingsMap)) {
                            // normally the chunkTimingsMap should be present at this point, because a DOCUMENT_OPENED event (where they're
                            // initialized) should have occurred before this CHUNK_BROWSED but sometimes the order of events seems mixed up
                            readSession.chunkTimingsMap = initializeChunkTimingsMap(publication);
                        }
                        if (chunkIndex >= Object.keys(readSession.chunkTimingsMap).length) {
                            // Skip the Made with.manual.to chunk
                            break;
                        }
                        const timeSpentSoFar = readSession.chunkTimingsMap[chunkIndex]?.timeSpentMs ?? 0;
                        const additionalTimeSpent = event.data["timeSpend"] as number;
                        readSession.chunkTimingsMap[chunkIndex].timeSpentMs = truncateTimeSpentOnChunk(timeSpentSoFar + additionalTimeSpent);
                    }
                    break;
                case EventType.DOCUMENT_CLOSED:
                    if (readSession) {
                        readSession.end = eventTimestamp;
                        readSession.incomplete = false;
                    }
                    break;
                case EventType.READ_SESSION_BLUR:
                    if (readSession) {
                        readSession.lastActivityTimestamp = eventTimestamp;
                    }
                    break;
                case EventType.READ_SESSION_FOCUS:
                    if (readSession) {
                        const { lastActivityTimestamp } = readSession;
                        const diff = moment.duration(moment(eventTimestamp).diff(lastActivityTimestamp));
                        const timeInactive = diff.asMilliseconds();
                        readSession.timeInactive += timeInactive;
                    }
                    break;
            }
            return { toAdd: toAddSoFar, toComplete: toCompleteSoFar };
        }, {
            toAdd: [] as IDocumentReadSession[],
            toComplete: incompleteReadSessions,
        });

        return {
            toAdd: this.normalizeReadSessions(readSessionsMap.toAdd),
            toComplete: this.normalizeReadSessions(readSessionsMap.toComplete.filter(rs => !rs.incomplete)),
        };
    }

    private buildAncestors(id: string, ancestors: DocumentAncestors, preparedTitles: { [id: string]: string }, acc: string[]): string[] {
        if (ancestors[id].length === 0) {
            return acc;
        }
        return this.buildAncestors(ancestors[id][0], ancestors, preparedTitles, [preparedTitles[ancestors[id][0]], ...acc]);
    }

    private cropToNItems<T>(items: T[], n: number): T[] {
        // limit the number of ancestors, excluding the root collection
        if (items.length >= n + 1) {
            return items.slice(1, n + 1);
        }
        const paddingCount = items.length === 0 ? n : n - items.length + 1;
        const padding = new Array(paddingCount).fill("");
        return [...(items.slice(1)), ...padding];
    }

    private async getCollectionsTitles(ancestors: DocumentAncestors): Promise<{ [collectionId: string]: string }> {
        const collectionSet = Object.keys(ancestors).reduce((prev, ancestor) => {
            return ancestors[ancestor].length > 0 ? prev.add(ancestors[ancestor][0]) : prev;
        }, new Set<string>());

        const collections = Array.from(collectionSet);
        const collectionChunks = splitEvery(5000, collections)
        const options = {
            maxResults: 6000,
            omitContentModules: true,
        };
        const preparedTitles = {};
        for (let i = 0; i < collectionChunks.length; i++) {
            const collectionChunk = collectionChunks[i];
            const filter = {
                binderIds: collectionChunk,
            };
            const items = filter.binderIds.length === 0 ?
                [] :
                await this.repoServiceClient.findItems(filter, options);
            items.forEach(item => {
                preparedTitles[item.id] = item["titles"][0].title;
            })
        }
        return preparedTitles;
    }

    private async buildReadSessionsMapForEvents(
        documentEvents: Map<string, Event[]>,
        incompleteReadSessions?: IDocumentReadSession[],
    ): Promise<IDocumentReadSessionsResult> {
        const readSessions: IDocumentReadSessionsResult = {
            toAdd: {},
            toComplete: {},
            lastEventTimestamp: this.findMostRecentEventTimestamp(documentEvents),
        };
        if (documentEvents.size === 0) {
            return readSessions;
        }
        const publications = await this.repoServiceClient.findPublicationsBackend(
            { ids: [...documentEvents.keys()] },
            { maxResults: MAX_RESULTS }
        );
        const publicationsById = publications.reduce((idToPub, pub) =>
            idToPub.set(pub.id, pub as Publication), new Map<string, Publication>());

        const publicationIdToStoryTitle = await this.extractPublicationIdToStoryTitleMap(documentEvents);
        const userIdToUserLogin = await this.extractUserIdToUserLoginMap(documentEvents);

        for (const [publicationId, events] of documentEvents.entries()) {
            const publication = publicationsById.get(publicationId);
            if (!publication) {
                this.logger.error(`Error: No publication found with id ${publicationId}, skipping...`, "read-sessions");
                continue;
            }
            const { toAdd, toComplete } = this.readSessionsForPublication(
                publication as Publication,
                events,
                publication.language?.iso639_1,
                publicationIdToStoryTitle,
                userIdToUserLogin,
                incompleteReadSessions || []
            );
            readSessions.toAdd[publicationId] = toAdd;
            readSessions.toComplete[publicationId] = toComplete;
        }
        return readSessions;
    }

    private findMostRecentEventTimestamp(docEventsMap: Map<string, Event[]>): number | undefined {
        let lastEventTimestamp: number = undefined;
        for (const events of docEventsMap.values()) {
            for (const event of events) {
                const eventTimeStamp = event.timestamp.getTime();
                if (lastEventTimestamp == null || (lastEventTimestamp < eventTimeStamp)) {
                    lastEventTimestamp = eventTimeStamp;
                }
            }
        }
        return lastEventTimestamp;
    }

    async buildReadSessionsMapWithPublicationIds(
        accountId: string,
        publicationIds: string[],
        filter: IEventFilter = {},
        incompleteReadSessions?: IDocumentReadSession[],
        eventSearchOptions: SearchOptions = {},
    ): Promise<IDocumentReadSessionsResult> {
        const documentEvents = await this.eventRepository.documentEventsInRange(
            accountId,
            publicationIds,
            filter,
            eventSearchOptions,
        );
        return this.buildReadSessionsMapForEvents(documentEvents, incompleteReadSessions);
    }

    async readSessionsCsv(accountId: string): Promise<string> {
        const escapeForCsv = (v) => v ? `"${v.replace(/"/g, "\"\"").replace(/(\n|\\n)/g, " ").trim()}"` : "";
        const userActions = await this.userActionsRepository.find({
            accountId,
            userActionTypes: [UserActionType.DOCUMENT_READ],
            excludeUserIds: await this.getManualToUserIds(),
        });

        const userIdSet = new Set<string>();
        const binderIdSet = new Set<string>();
        userActions.forEach((ua) => {
            if (ua.userId && ua.userId !== "public" && !userIdSet.has(ua.userId)) {
                userIdSet.add(ua.userId);
            }
            const binderId = ua?.data?.itemId;
            if (binderId && !binderIdSet.has(binderId)) {
                binderIdSet.add(binderId);
            }
        });
        const userMap = new Map<string, User>();
        const users = await this.userServiceClient.findUserDetailsForIds(Array.from(userIdSet));
        users.forEach((u: User) => userMap.set(u.id, u))
        const ancestorColumnCount = 10;
        const binderIds = Array.from(binderIdSet);
        // get ancestors for binders
        const ancestors = await this.repoServiceClient.getItemsAncestors(binderIds);
        const preparedTitles = await this.getCollectionsTitles(ancestors);
        // { [itemId]: Array<ancestor titles> }
        const itemsAncestors = binderIds.reduce((prev, id) => {
            try {
                prev[id] = this.buildAncestors(id, ancestors, preparedTitles, []);
            } catch (ex) {
                this.logger.error(`Circular path for id ${id}`, "read-sessions");
                prev[id] = [];
            }
            return prev;
        }, {});

        const header = "binderId;documentId;documentName;language;start;end;duration;duration in seconds;truncated;userId;userLogin;userName;" +
            `${Array(ancestorColumnCount).fill("collection ")
                .map((el, i) => `${el}${i + 1}`)
                .join(";")}\n`
        const rows = userActions
            .map(ua => {
                const { data, end: endOrUndefined, start, duration: durationOrUndefined, userId } = ua;
                const { itemId, publicationId, itemTitle, itemLanguage } = (data as IUserActionDataReadSession);
                const end = endOrUndefined ?? "n/a";
                const duration = durationOrUndefined ?? NaN;
                const truncatedDuration = Math.min(duration, 1800);
                const truncated = (duration > 1800 ? 1 : 0);
                const durationInSeconds = isNaN(truncatedDuration) ? "n/a" : truncatedDuration;
                const durationMinutes = Math.floor(truncatedDuration / 60);
                const durationSeconds = Math.round(1000 * (truncatedDuration % 60)) / 1000;
                let durationStr;
                if (isNaN(truncatedDuration)) {
                    durationStr = "n/a";
                } else {
                    if (truncatedDuration > 60) {
                        durationStr = `${durationMinutes}m${durationSeconds}s`;
                    } else {
                        durationStr = `${truncatedDuration}s`;
                    }
                }
                const user = userMap.get(userId);
                const userLogin = user?.login || "n/a";
                const userName = user ? buildUserName(user, { noFallbackToId: true }) : "n/a";
                const language = (itemLanguage === UNDEFINED_LANG ? UNDEFINED_LANG_UI : itemLanguage) || UNDEFINED_LANG_UI;
                const el = `${itemId};${publicationId};${escapeForCsv(itemTitle)};${language};${start};${end};` +
                    `${durationInSeconds};${durationStr};${truncated};${userId};${userLogin};${userName};`;
                return el + this.cropToNItems(itemsAncestors[itemId], ancestorColumnCount).join(";")
            })
            .join("\n");
        return header + rows + "\n";
    }

    languageStatistics(collectionId: string, filter: IEventFilter): Promise<ILanguageStatistics[]> {
        return this.eventRepository.languages(collectionId, filter);
    }

    async languageStatisticsByBinder(
        accountId: string,
        binderId: string,
        rangeStart?: Date,
        rangeEnd?: Date,
    ): Promise<ILanguageStatistics[]> {
        const languageStatisticsUnsorted = await this.userActionsRepository.getLanguagesStatistics(
            accountId,
            binderId,
            rangeStart ? { rangeStart } : {},
            rangeEnd ? { rangeEnd } : {},
        );
        const languageStatistics = languageStatisticsUnsorted.sort((a, b) => b.amount - a.amount);
        const undefinedLanguageStat = languageStatistics.find(stat => stat.languageCode.toLowerCase() === UNDEFINED_LANG);
        if (undefinedLanguageStat) {
            if (languageStatistics.length > 1) {
                const binder = await this.repoServiceClient.getBinder(binderId, {
                    skipPopulateVisuals: true,
                    ancestorThumbnailsOptions: {
                        inheritAncestorThumbnails: false
                    }
                });
                const primaryLanguage = binder.languages.sort((l1, l2) => l1.priority < l2.priority ? -1 : 1)[0];
                const { iso639_1: primaryLanguageCode } = primaryLanguage;

                const primaryLanguageStat = languageStatistics.find(
                    stat => stat.languageCode.toLowerCase() === primaryLanguageCode.toLowerCase()
                ) || {
                    amount: 0,
                    languageCode: primaryLanguageCode
                };
                const otherLanguageStats = without([undefinedLanguageStat, primaryLanguageStat], languageStatistics);
                const amount = primaryLanguageStat.amount + undefinedLanguageStat.amount;
                return [
                    ...otherLanguageStats,
                    { languageCode: primaryLanguageCode.toUpperCase(), amount }
                ];
            }
            return [{
                languageCode: UNDEFINED_LANG_UI,
                amount: undefinedLanguageStat.amount
            }];
        }
        return languageStatistics;
    }

    async composerStatistics(binderIds: Array<string>, accountId: string, filter: IEventFilter): Promise<IComposerStatistics> {
        const binderStatistics = await this.binderStatistics(binderIds, filter);
        const mostUsedLanguages = await this.mostUsedLanguages(accountId);
        return {
            binderStatistics,
            mostUsedLanguages,
        }
    }

    private async updateMostUsedLanguage(accountId: string) {
        const languageCodes = await this.repoServiceClient.getMostUsedLanguages([accountId]);
        const stat = new MostUsedLanguagesStat(accountId, { languageCodes }, new Date());
        this.mostUsedLanguagesStatsRepository.addMostUsedLanguagesStat(stat);
    }

    async mostUsedLanguages(accountId: string): Promise<string[]> {
        const mostUsedLanguagesStat = await this.mostUsedLanguagesStatsRepository.findMostUsedLanguagesStat(accountId);
        const ONE_DAY = 86400000;
        const statExpired = ts => moment().diff(moment(ts)) > ONE_DAY;
        if (!mostUsedLanguagesStat || statExpired(mostUsedLanguagesStat.timestamp)) {
            this.updateMostUsedLanguage(accountId)
            return [];
        }
        const { data: { languageCodes } } = mostUsedLanguagesStat;
        return languageCodes;
    }

    private async getMostInteractedDocuments(accountId: string, action: UserActionType, count: number) {
        const aggregation = {
            agg: "terms",
            groupBy: "data.itemId",
            size: count
        };
        const filter: UserActionsFilter = {
            accountId,
            userActionTypes: [action]
        };
        const aggregations = await this.userActionsRepository.aggregate(filter, aggregation as TermsAggregation<IUserAction>);
        const binderIds = Object.keys(aggregations);
        const statistics = binderIds.length > 0 ?
            (await this.binderStatistics(binderIds, {})) :
            [];
        const items = binderIds.length === 0 ?
            [] :
            await this.repoServiceClient.findItems(
                { binderIds },
                { maxResults: 1000 },
            );
        const binders = items.filter((item: Binder) => !!item.bindersVersion);
        const documents: IDashboardDocument[] = binders.map((binder: Binder) => ({
            _id: binder.id,
            title: binder.languages[0].storyTitle, // TODO: Find the correct way of getting a binder title
            lastEdition: binder.lastModified,
            numberOfReads: statistics
                .filter(stat => stat._id === binder.id)
                .reduce((sum, stat) => sum + stat.views, 0),
            numberOfEdits: statistics
                .filter(stat => stat._id === binder.id)
                .reduce((sum, stat) => sum + stat.edits, 0),
        }));
        return documents;
    }

    async mostReadDocuments(accountId: string, count: number): Promise<IDashboardDocument[]> {
        const docs = await this.getMostInteractedDocuments(accountId, UserActionType.DOCUMENT_READ, count);
        docs.sort((left, right) => right.numberOfReads - left.numberOfReads);
        return docs;
    }

    async mostEditedDocuments(accountId: string, count: number): Promise<IDashboardDocument[]> {
        const docs = await this.getMostInteractedDocuments(accountId, UserActionType.ITEM_EDITED, count);
        docs.sort((left, right) => right.numberOfEdits - left.numberOfEdits);
        return docs;
    }

    async mostActiveEditors(accountId: string, count: number): Promise<DocumentEditor[]> {
        const editorInfo = await this.userActionsRepository.mostActiveEditors(accountId, count + 20);
        const userIds = editorInfo.map(info => info.userId);
        const users = userIds.length > 0 ?
            await this.userServiceClient.findUserDetailsForIds(userIds) :
            [];
        const fullEditorInfo: DocumentEditor[] = editorInfo.map(info => {
            const user = users.find(user => user.id === info.userId);
            const { displayName = "", login = "" } = user ?? {};
            return {
                ...info,
                displayName,
                login
            };
        });
        return fullEditorInfo
            // Filter out manual.to users, except for the Binders Media account
            .filter(info => (accountId === "aid-0fb03b72-d6ed-4204-abbd-f64b8879b4a6" || !isManualToLogin(info.login)))
            .slice(0, count);
    }

    getAggregatorType(type: AggregatorType): UserActionsAggregatorType {
        switch (type) {
            case AggregatorType.CHOOSELANGUAGE:
                return ChooseLanguageAggregator;
            case AggregatorType.ITEMCREATIONS:
                return ItemCreationsAggregator;
            case AggregatorType.ITEMDELETIONS:
                return ItemDeletionsAggregator;
            case AggregatorType.ITEMHARDDELETIONS:
                return ItemHardDeletionsAggregator;
            case AggregatorType.ITEMEDITED:
                return ItemEditionsAggregator;
            case AggregatorType.USERONLINE:
                return UserOnlineAggregator;
            case AggregatorType.READSESSIONS:
                return ReadSessionsAggregator;
            case AggregatorType.RELABELLANGUAGE:
                return RelabeledLanguageAggregator;
            default:
                return undefined;
        }
    }

    buildAggregationRange(
        account: Account,
        aggregatorType: AggregatorType,
        lastAggregation: Aggregation,
        rangeOverride?: IRange,
    ): IRange {
        if (rangeOverride) {
            return {
                rangeStart: new Date(rangeOverride.rangeStart),
                rangeEnd: new Date(rangeOverride.rangeEnd),
            }
        }
        let rangeStart: Date;
        if (!lastAggregation) {
            rangeStart = aggregatorType === AggregatorType.USERONLINE ?
                subYears(Date.now(), 1) :
                new Date(account.created);
        } else {
            rangeStart = lastAggregation.data.rangeEnd;
        }
        const rangeEnd = new Date();
        return { rangeStart, rangeEnd };
    }

    buildAggregationRangeFilter(
        account: Account,
        aggregatorType: AggregatorType,
        lastAggregation: Aggregation,
        rangeOverride?: IRange,
    ): IRangeFilter {
        return {
            fieldName: "timestamp",
            ...this.buildAggregationRange(account, aggregatorType, lastAggregation, rangeOverride),
            excludeRangeStart: true,
        }
    }

    async aggregateUserEventsForAccount(
        account: Account,
        options?: AggregateOptions,
    ): Promise<IAccountAggregationReport> {
        const { rangeOverride, aggregatorTypes, limitNumberOfEvents } = options || {};
        const aggregatorTypesToAggregate = aggregatorTypes || AllAggregatorTypes;
        const aggregationType = !aggregatorTypes ? "full" : "individual";
        const accountAggregationReport = { eventFilter: {}, aggregatorReports: {} };
        for (const aggregatorType of aggregatorTypesToAggregate) {
            const Aggregator = this.getAggregatorType(aggregatorType);
            const relevantEventTypes = Aggregator.eventTypes;
            const lastEventTime = await this.getLatestEventTimeForAccount(account.id, relevantEventTypes);

            const lastAggregations = await this.aggregationsRepository.getLastAggregations([account.id], aggregatorType);
            const lastAggregation = [...lastAggregations].pop();

            const newEventsAvailable =
                lastAggregation && lastEventTime &&
                !(lastEventTime.isNothing()) &&
                moment(lastEventTime.get()).isAfter(lastAggregation.data.rangeEnd)

            if (!lastAggregation || newEventsAvailable) {
                const eventFilter = {
                    range: this.buildAggregationRangeFilter(
                        account,
                        aggregatorType,
                        lastAggregation,
                        rangeOverride,
                    )
                };
                const aggregator = new Aggregator(
                    this.userActionsRepository,
                    this.aggregationsRepository,
                    aggregationType,
                    this,
                    account.id,
                    eventFilter,
                    this.logger,
                    limitNumberOfEvents,
                );
                const aggregationResult = await aggregator.run();
                accountAggregationReport.eventFilter = eventFilter;
                this.buildAggregationReport(accountAggregationReport, aggregationResult);
            } else {
                accountAggregationReport.aggregatorReports[aggregatorType] = {
                    toAddCount: 0,
                    info: "No new events since last aggregation",
                };
            }
        }
        return accountAggregationReport;
    }

    async aggregateUserEvents(
        accountIds?: string[],
        options?: AggregateOptions,
    ): Promise<IAggregationReport> {
        let accountsToProcess: Account[] = [];
        if (accountIds) {
            for (const accountId of accountIds) {
                accountsToProcess.push(await this.accountServiceClient.getAccount(accountId));
            }
        } else {
            accountsToProcess = await this.accountServiceClient.listAccounts();
        }
        const aggregationReport: IAggregationReport = {};
        for (const account of accountsToProcess) {
            try {
                aggregationReport[account.id] = await this.aggregateUserEventsForAccount(account, options);
            } catch (e) {
                aggregationReport[account.id] = {
                    eventFilter: {},
                    aggregatorReports: {},
                    exception: e.message,
                };
            }
        }
        return aggregationReport;
    }

    private buildAggregationReport(
        accountAggregationReport: IAccountAggregationReport,
        result: AggregationResult,
    ) {
        const { aggregatorType, lastEventTimestamp, rangeUsed } = result;
        let oldest, newest = undefined;
        const toAdd = result.toAdd || [];
        const toComplete = result.toComplete || [];
        toAdd.forEach(actionToAdd => {
            const time = actionToAdd.start.getTime();
            oldest = (!oldest || (oldest && time < oldest)) ? time : oldest;
            newest = (!newest || (newest && time > newest)) ? time : newest;
        });
        accountAggregationReport.aggregatorReports[aggregatorType] = mergeUserActionReportBodies(
            accountAggregationReport.aggregatorReports[aggregatorType],
            {
                toAddCount: toAdd.length,
                toCompleteCount: (toComplete || []).length,
                oldest: new Date(oldest),
                newest: new Date(newest),
            }
        );
        accountAggregationReport.aggregatorReports[aggregatorType].lastEventTimestamp = lastEventTimestamp;
        accountAggregationReport.aggregatorReports[aggregatorType].rangeUsed = rangeUsed;
    }

    async lastUserActionsAggregationTime(accountId: string): Promise<Date> {
        const lastAggregations = await this.aggregationsRepository.getLastAggregations([accountId]);
        const [lastAggregation] = lastAggregations;
        return lastAggregation?.timestamp;
    }

    async viewStatsForPublications(publicationIds: string[]): Promise<IViewsStatsPerPublication> {
        const filter: UserActionsFilter = {
            publicationIds,
            userActionTypes: [
                UserActionType.DOCUMENT_READ
            ]
        };
        const aggregation = {
            agg: "terms",
            groupBy: "data.publicationId",
            aggregation: {
                agg: "terms",
                groupBy: "userId"
            }
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return await this.userActionsRepository.aggregate(filter, aggregation as any) as any;
    }

    async logSerializedClientErrors(serializedErrors: string[], context: ClientErrorContext, request?: WebRequest): Promise<void> {
        if (!request) {
            return;
        }
        const inflatedErrors = serializedErrors.map(serializedError => {
            const deflated = JSON.parse(serializedError);
            if (!deflated) {
                return undefined;
            }
            return Object.assign(
                Object.create(Error.prototype),
                deflated
            );
        });
        for (const error of inflatedErrors) {
            if (error !== undefined) {
                await logUncaughtError(error, request, { clientContext: context });
            }
        }
    }

    async globalUsage(): Promise<GlobalUsage> {
        // Sum read session duration
        // Count document creations
        // Count document edit sessions

        const agg: TermsAggregation<IUserAction> = {
            agg: "terms",
            groupBy: "accountId",
            size: 1000
        };

        const documentCreations = await this.userActionsRepository.aggregate(
            { userActionTypes: [UserActionType.ITEM_CREATED] },
            agg
        );
        const documentEditSessions = await this.userActionsRepository.aggregate(
            { userActionTypes: [UserActionType.ITEM_EDITED] },
            agg
        )
        const documentsRead = await this.userActionsRepository.aggregate(
            { userActionTypes: [UserActionType.DOCUMENT_READ] },
            agg
        );

        const timeSpentPerAccount = {};
        const getReadDuration = (end, start) => {
            if (!end || !start) {
                return 0;
            }
            const endDate = new Date(end);
            const startDate = new Date(start);
            return Math.min(
                60 * 60 * 1000,
                Math.abs(endDate.getTime() - startDate.getTime())
            );
        }
        await this.userActionsRepository.forEach(
            { userActionTypes: [UserActionType.DOCUMENT_READ] },
            (action) => {
                const { accountId, start, end } = action;
                if (!(accountId in timeSpentPerAccount)) {
                    timeSpentPerAccount[accountId] = 0;
                }
                const duration = getReadDuration(end, start);
                timeSpentPerAccount[accountId] += duration;
            }
        )
        const accountResults: AccountUsage[] = [];
        for (const accountId in documentCreations) {
            accountResults.push({
                accountId,
                documentsCreated: documentCreations[accountId],
                documentEdits: documentEditSessions[accountId],
                documentsRead: documentsRead[accountId],
                timeSpentInReader: timeSpentPerAccount[accountId]
            })
        }

        return {
            accounts: accountResults
        }
    }

    async multiInsertUserAction(userActions: IUserAction[], accountId: string, options?: MultiInsertOptions): Promise<void> {
        await this.userActionsRepository.multiInsertUserAction(userActions, options);
    }

    async resetAggregations(accountId: string): Promise<void> {
        const aggregationsDeleted = await this.aggregationsRepository.resetAggregations(accountId);
        const userActionsDeleted = await this.userActionsRepository.deleteUserActions({ accountId });
        const eventsDeleted = await this.eventRepository.deleteEvents({ account_id: accountId });
        this.logger.info(`Removed ${aggregationsDeleted} aggs, ${userActionsDeleted} user actions and ${eventsDeleted} events`, "reset-aggs");
    }

    private async getUsersOnlinePerMonth(): Promise<Record<MonthKey, number>> {
        const usersOnlineSets = {};
        const process = (userAction: IUserOnlineUserAction) => {
            const { start, data } = userAction;
            const { users } = data;
            const startDate = new Date(start);
            const monthKey = buildMonthKeyFromDate(startDate);
            for (const user of users) {
                if (!user) {
                    continue;
                }
                const userSet = usersOnlineSets[monthKey] || new Set();
                userSet.add(user);
                usersOnlineSets[monthKey] = userSet;
            }
        }
        await this.userActionsRepository.forEach(
            { userActionTypes: [UserActionType.USER_ONLINE] },
            process
        )
        const usersOnline = {};
        for (const monthKey of Object.keys(usersOnlineSets)) {
            usersOnline[monthKey] = usersOnlineSets[monthKey].size;
        }
        return usersOnline;
    }

    async globalUsagePerMonth(): Promise<GlobalUsagePerMonth> {
        const [userCreations, usersOnlineMap] = await Promise.all([
            this.userServiceClient.getUsersCreatedPerMonth(),
            this.getUsersOnlinePerMonth()
        ]);
        const globalUsage: GlobalUsagePerMonth = {};
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        for (let y = 2018; y <= currentYear; y++) {
            for (let m = 1; m <= 12; m++) {
                if (y === currentYear && m > currentMonth) {
                    break;
                }
                const monthKey = buildMonthKey(y, m);
                const usersCreated = userCreations[monthKey] || 0;
                const usersOnline = usersOnlineMap[monthKey] || 0;
                globalUsage[monthKey] = {
                    usersCreated,
                    usersOnline,
                    documents: 0
                }
            }
        }
        return globalUsage;
    }

    async accountsLastUsageInformation(accountIds: string[]): Promise<AccountsLastUsageInformation> {
        const usageInformation = {} as AccountsLastUsageInformation;
        for (const accountId of accountIds) {
            usageInformation[accountId] = await this.accountLastUsageInformation(accountId);
        }
        return usageInformation;
    }

    private async accountLastUsageInformation(accountId: string): Promise<AccountLastUsageInformation> {
        const latestDates = await this.lastAccountUserActionsMappingRepository.getLastUserActionsForAccount(accountId);
        return latestDates.lift(acc => (<AccountLastUsageInformation>{
            ...acc.readDate && { readDate: acc.readDate.toISOString() },
            ...acc.editDate && { editDate: acc.editDate.toISOString() },
        })).getOrElse({});
    }

    async recalculateAccountsLastUsageInformation(): Promise<void> {
        const accounts = await this.accountServiceClient.listAccounts();
        const accountIds = accounts.map(acc => acc.id);
        const manualToUserIds = new Set(await this.getManualToUserIds());
        for (const accountId of accountIds) {
            await this.recalculateAccountLastUsageInformation(accountId, manualToUserIds);
        }
    }

    private async getManualToUserIds(): Promise<string[]> {
        const manualToUsers = await this.userServiceClient.searchUsersBackend({
            login: "^.*@manual.to$",
        }, {
            maxResults: 99999,
        });
        return manualToUsers.hits.map(user => user.id);
    }

    private async recalculateAccountLastUsageInformation(accountId: string, manualToUserIds: Set<string>): Promise<void> {
        const lastUsageInfo = await this.lastAccountUserActionsMappingRepository.getLastUserActionsForAccount(accountId);
        const readLatestDate = lastUsageInfo.lift(u => u.readDate).getOrElse(undefined);
        const editLatestDate = lastUsageInfo.lift(u => u.editDate).getOrElse(undefined);
        const readDate = await this.findLatestNonManualToUserActionDateForAccount(accountId, ALL_READ_USER_ACTIONS, manualToUserIds, readLatestDate);
        const editDate = await this.findLatestNonManualToUserActionDateForAccount(accountId, ALL_EDIT_USER_ACTIONS, manualToUserIds, editLatestDate);
        if (readDate.isJust() || editDate.isJust()) {
            const mapping = new LastAccountUserActionsMapping(accountId, readDate.getOrElse(undefined), editDate.getOrElse(undefined));
            await this.lastAccountUserActionsMappingRepository.setLastUserActionsForAccount(mapping);
        }
    }

    private async findLatestNonManualToUserActionDateForAccount(
        accountId: string,
        userActionTypes: UserActionType[],
        manualToUserIds: Set<string>,
        startDate?: Date,
    ): Promise<Maybe<Date>> {
        const oneResultFilter: IFindUserActionsFilter = {
            accountId,
            userActionTypes,
            ...startDate ?? { startRange: { rangeStart: startDate } },
        };

        const userAction = await this.userActionsRepository.findFirst(
            oneResultFilter,
            (u: IUserAction<unknown>) => !manualToUserIds.has(u.userId),
            "start");
        return userAction.lift(u => this.extractDate(u));
    }

    private extractDate(userAction: IUserAction<unknown>): Date | undefined {
        const endDate = parseJSON(userAction.end);
        if (isValid(endDate)) {
            return endDate;
        }
        const startDate = parseJSON(userAction.start);
        if (isValid(startDate)) {
            return startDate;
        }
        return undefined;
    }

    async cspReport(report: Record<string, string>): Promise<void> {
        // To see how to deal with these reports go to: https://bindersmedia.atlassian.net/wiki/spaces/SD/pages/219414529/CSP+Reports
        this.logger.warn("", "csp-report", report);
        const {
            "blocked-uri": blockedUri = "unknown",
            "effective-directive": effectiveDirective = "unknown",
        } = report;
        incrementCspReportCounterByOne(blockedUri, effectiveDirective);
    }
}

export class TrackingServiceFactory {
    public readonly aggregationsRepositoryFactory: MongoAggregationsRepositoryFactory;
    public readonly mostUsedLanguageStatsRepositoryFactory: MongoMostUsedLanguagesStatRepositoryFactory;
    public readonly auditLogRepositoryFactory: AuditLogRepositoryFactory;
    public readonly lastAccountEventMappingFactory: MongoLastAccountEventMappingRepositoryFactory;
    public readonly lastAccountUserActionsRepoFactory: MongoLastAccountUserActionsMappingRepositoryFactory;
    private readonly logger: Logger;

    constructor(
        private readonly config: Config,
        private readonly userServiceClient: UserServiceClient,
        private readonly repoServiceClient: BinderRepositoryServiceClient,
        private readonly accountServiceClient: AccountServiceClient,
        private readonly routingServiceClient: RoutingServiceClient,
        private readonly authorizationServiceClient: AuthorizationServiceClient,
        private readonly manualToLocation: string,
        private readonly editorLocation: string,
        private readonly trackingRepositoryFactory: ITrackingRepositoryFactory,
        private readonly featureFlagService: IFeatureFlagService,
        aggregationCollectionConfig: CollectionConfig,
        mostUsedLanguagesStatCollectionConfig: CollectionConfig,
        auditLogCollectionConfig: CollectionConfig,
        lastAccountEventMappingCollectionConfig: CollectionConfig,
        lastAccountUserActionsCollectionConfig: CollectionConfig,
    ) {
        this.logger = LoggerBuilder.fromConfig(config);
        this.aggregationsRepositoryFactory = new MongoAggregationsRepositoryFactory(aggregationCollectionConfig, this.logger);
        this.mostUsedLanguageStatsRepositoryFactory = new MongoMostUsedLanguagesStatRepositoryFactory(mostUsedLanguagesStatCollectionConfig, this.logger);
        this.auditLogRepositoryFactory = new AuditLogRepositoryFactory(auditLogCollectionConfig, this.logger);
        this.lastAccountEventMappingFactory = new MongoLastAccountEventMappingRepositoryFactory(lastAccountEventMappingCollectionConfig, this.logger);
        this.lastAccountUserActionsRepoFactory = new MongoLastAccountUserActionsMappingRepositoryFactory(lastAccountUserActionsCollectionConfig, this.logger);
    }

    forRequest(request: { logger?: Logger }): TrackingService {
        const trackingRepository = this.trackingRepositoryFactory.build(request.logger);
        const aggregationsRepository = this.aggregationsRepositoryFactory.build(request.logger);
        const mostUsedLanguagesStatRepository = this.mostUsedLanguageStatsRepositoryFactory.build(request.logger);
        const userActionsRepository = new ElasticUserActionsRepository(this.config, request.logger);
        const auditLogRepository = this.auditLogRepositoryFactory.build(request.logger);
        const lastAccountEventMappingRepository = this.lastAccountEventMappingFactory.build(request.logger);
        const lastAccountUserActionsMappingRepository = this.lastAccountUserActionsRepoFactory.build(request.logger);
        return new TrackingService(
            trackingRepository,
            aggregationsRepository,
            mostUsedLanguagesStatRepository,
            userActionsRepository,
            auditLogRepository,
            lastAccountEventMappingRepository,
            lastAccountUserActionsMappingRepository,
            this.userServiceClient,
            this.repoServiceClient,
            this.accountServiceClient,
            this.routingServiceClient,
            this.authorizationServiceClient,
            this.manualToLocation,
            this.editorLocation,
            this.featureFlagService,
            request.logger,
            this.config
        );
    }

    static async fromConfig(config: Config, logger: Logger): Promise<TrackingServiceFactory> {
        const loginOption = getMongoLogin("tracking_service");
        const [
            aggregationsConfig,
            mostUsedLanguagesStatConfig,
            auditLogConfig,
            lastAccountEventMappingConfig,
            lastAccountUserActionsMappingConfig,
            userClient,
            accountClient,
            repoClient,
            routingClient,
            authorizationClient,
            trackingFactory,
            featureFlagService,
        ] = await Promise.all([
            CollectionConfig.promiseFromConfig(config, "aggregations", loginOption),
            CollectionConfig.promiseFromConfig(config, "mostUsedLanguagesStats", loginOption),
            CollectionConfig.promiseFromConfig(config, "auditLog", loginOption),
            CollectionConfig.promiseFromConfig(config, "lastAccountEventMapping", loginOption),
            CollectionConfig.promiseFromConfig(config, "lastAccountUserActionsMapping", loginOption),
            BackendUserServiceClient.fromConfig(config, "tracking-service"),
            BackendAccountServiceClient.fromConfig(config, "tracking-service"),
            BackendRepoServiceClient.fromConfig(config, "tracking-service"),
            BackendRoutingServiceClient.fromConfig(config, "tracking-service"),
            BackendAuthorizationServiceClient.fromConfig(config, "tracking-service"),
            TrackingRepositoryFactory.fromConfig(config, logger),
            LaunchDarklyService.create(config, logger),
        ]);
        const manualToLocation = config.getString("services.manualto.externalLocation").getOrElse(undefined);
        const editorLocation = config.getString("services.editor.externalLocation").getOrElse(undefined);
        return new TrackingServiceFactory(
            config,
            userClient,
            repoClient,
            accountClient,
            routingClient,
            authorizationClient,
            manualToLocation,
            editorLocation,
            trackingFactory,
            featureFlagService,
            aggregationsConfig,
            mostUsedLanguagesStatConfig,
            auditLogConfig,
            lastAccountEventMappingConfig,
            lastAccountUserActionsMappingConfig,
        );
    }
}

function toAuditLog(auditLog: AuditLog): ContractAuditLog {
    return {
        accountId: auditLog.accountId?.value(),
        logType: auditLog.logType,
        timestamp: auditLog.timestamp.getMilliseconds(),
        userId: auditLog.userId?.value(),
        userAgent: {} as IUserAgentLogFormat,
        data: auditLog.data
    };
}

const MAX_TIME_SPENT_ON_CHUNK_MS = minutesToMilliseconds(5);
const truncateTimeSpentOnChunk = (timeSpentMs: number): number => Math.min(MAX_TIME_SPENT_ON_CHUNK_MS, timeSpentMs);

/**
 * Checks whether date is in interval {@link startDate} (inclusive) - {@link endDate} (exclusive)
 */
function isInRange(date: Date, startDate: Date, endDate = END_OF_TIME): boolean {
    return !isBefore(date, startDate) &&
        isBefore(date, endDate);
}
