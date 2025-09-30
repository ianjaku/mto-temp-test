import {
    AccountsLastUsageInformation,
    AggregateOptions,
    AuditLog,
    AuditLogData,
    AuditLogType,
    ClientErrorContext,
    CreateLogAuthTokenResponse,
    DocumentEditor,
    Event,
    EventPayload,
    GlobalUsage,
    GlobalUsagePerMonth,
    IAccountViewsStatistics,
    IAggregationReport,
    IAllDocumentStatistics,
    IAllViewsStatistics,
    ICollectionLanguageStatistics,
    IComposerStatistics,
    IDashboardDocument,
    IDocumentCreationsStatistics,
    IDocumentDeletionsStatistics,
    IEventFilter,
    IFindUserActionsFilter,
    IItemEditsStatistics,
    ILoginStatistics,
    IUserAction,
    IUserActionSummary,
    IUserCountStatistics,
    IViewsStatsPerPublication,
    MultiInsertOptions,
    TrackingServiceContract,
    UserActionsFindResult,
    UserReadSessionsFilter
} from "./contract";
import { BindersServiceClient, RequestHandler } from "../../client";
import { BindersServiceClientConfig } from "../../config";
import { Config } from "../../../config";
import debounce from "lodash.debounce";
import { getRoutes } from "./routes";
import { patchErrorPrototype } from "../../../util/errors";

patchErrorPrototype();

const ERROR_SEND_INTERVAL = 1000;
const MAX_ERRORS_PER_SEND_INTERVAL = 10;

export class TrackingServiceClient extends BindersServiceClient implements TrackingServiceContract {

    private errorQueue: Array<{ serializedError: string, context: ClientErrorContext }>;
    private debouncedSend: () => Promise<void>

    constructor(
        endpointPrefix: string,
        requestHandler: RequestHandler,
        accountIdProvider?: () => string,
    ) {
        super(endpointPrefix, getRoutes(), requestHandler, accountIdProvider);
        this.errorQueue = [];
        this.debouncedSend = debounce(this.sendQueue, ERROR_SEND_INTERVAL, { leading: true, trailing: true });
    }

    public static fromConfig(
        config: Config,
        version: string,
        requestHandler: RequestHandler,
        accountIdProvider?: () => string,
    ): TrackingServiceClient {
        const versionedPath = BindersServiceClientConfig.getVersionedPath(config, "tracking", version);
        return new TrackingServiceClient(versionedPath, requestHandler, accountIdProvider);
    }

    public log(events: EventPayload[], userId?: string, beacon?: boolean): Promise<boolean> {
        const options = {
            body: { events, userId },
            beacon,
            useDeviceTargetUserToken: true
        };
        return this.handleRequest("log", options);
    }

    public createLogAuthToken(): Promise<CreateLogAuthTokenResponse> {
        return this.handleRequest("createLogAuthToken", {});
    }

    public logAuditLog(
        logType: AuditLogType,
        userId: string,
        accountId?: string,
        userAgent?: string,
        data?: AuditLogData,
        ip?: string | string[],
        beacon?: boolean,
    ): Promise<boolean> {
        const options = {
            body: {
                logType,
                accountId,
                userId,
                userAgent,
                data,
                ip,
                timestamp: new Date()
            },
            beacon,
        };
        return this.handleRequest("logAuditLog", options);
    }

    public findAuditLogs(accountId: string, logType: AuditLogType, startDate?: Date, endDate?: Date): Promise<AuditLog[]> {
        const options = { body: { accountId, logType, startDate, endDate } };
        return this.handleRequest("findAuditLogs", options);
    }

    public findUserActions(filter: IFindUserActionsFilter): Promise<UserActionsFindResult<IUserAction>> {
        const options = { body: { filter } };
        return this.handleRequest("findUserActions", options);
    }

    public allBinderStatistics(binderId: string, filter?: IEventFilter, accountId?: string): Promise<IAllDocumentStatistics> {
        const options = { body: { accountId, binderId, filter: filter || {} } };
        return this.handleRequest("allBinderStatistics", options);
    }
    public collectionLanguageStatistics(collectionId: string, filter?: IEventFilter, accountId?: string): Promise<ICollectionLanguageStatistics> {
        const options = { body: { accountId, collectionId, filter: filter || {} } };
        return this.handleRequest("collectionLanguageStatistics", options);
    }
    public allViewsStatistics(itemIds: string[], accountId?: string): Promise<IAllViewsStatistics> {
        const options = { body: { accountId, itemIds } };
        return this.handleRequest("allViewsStatistics", options);
    }
    public composerStatistics(binderIds: Array<string>, accountId: string, filter?: IEventFilter): Promise<IComposerStatistics> {
        const options = { body: { binderIds, accountId, filter: filter || {} } };
        return this.handleRequest("composerStatistics", options);
    }
    public mostUsedLanguages(accountId: string): Promise<string[]> {
        const options = { pathParams: { accountId } };
        return this.handleRequest("mostUsedLanguages", options);
    }
    public findEvents(accountId: string, eventFilter: IEventFilter): Promise<Event[]> {
        const options = { body: { accountId, eventFilter } };
        return this.handleRequest("findEvents", options);
    }
    public loginStatistics(accountId: string): Promise<ILoginStatistics[]> {
        const options = { body: { accountId } };
        return this.handleRequest("loginStatistics", options);
    }
    public userCountStatistics(accountId: string): Promise<IUserCountStatistics[]> {
        const options = { body: { accountId } };
        return this.handleRequest("userCountStatistics", options);
    }

    public accountViewsStatistics(accountId: string, excludeAuthors?: boolean): Promise<IAccountViewsStatistics> {
        const options = { body: { accountId, excludeAuthors } };
        return this.handleRequest("accountViewsStatistics", options);
    }

    public async documentCreationsStatistics(accountId: string): Promise<IDocumentCreationsStatistics[]> {
        const options = { body: { accountId } };
        const response: IDocumentCreationsStatistics[] = await this.handleRequest("documentCreationsStatistics", options);
        return response.map(stat => ({
            ...stat,
            date: new Date(stat.date),
        }))
    }
    public itemEditsStatistics(accountId: string): Promise<IItemEditsStatistics[]> {
        const options = { body: { accountId } }
        return this.handleRequest("itemEditsStatistics", options)
    }
    public async searchUserActions(filter: IFindUserActionsFilter): Promise<UserActionsFindResult<IUserActionSummary>> {
        const options = { body: { filter: filter || {} } };
        const { userActions, exception }: UserActionsFindResult<IUserActionSummary> = await this.handleRequest("searchUserActions", options);
        return {
            userActions: userActions.map(ua => ({
                ...ua,
                ...(ua.timestamp ? { timestamp: new Date(ua.timestamp) } : {}),
            })),
            exception,
        };
    }
    public async searchUserReadSessions(filter: UserReadSessionsFilter, accountId?: string): Promise<UserActionsFindResult<IUserActionSummary>> {
        const options = { body: { accountId, filter: filter || {} } };
        const { userActions, exception }: UserActionsFindResult<IUserActionSummary> = await this.handleRequest("searchUserReadSessions", options);
        return {
            userActions: userActions.map(ua => ({
                ...ua,
                ...(ua.timestamp ? { timestamp: new Date(ua.timestamp) } : {}),
            })),
            exception,
        };
    }
    public aggregateUserEvents(
        accountIds?: string[],
        options?: AggregateOptions,
    ): Promise<IAggregationReport> {
        const reqOptions = { body: { accountIds, options } };
        return this.handleRequest("aggregateUserEvents", reqOptions);
    }
    public readSessionsCsv(accountId: string): Promise<string> {
        const options = { pathParams: { accountId } };
        return this.handleRequest("readSessionsCsv", options);
    }
    public async lastUserActionsAggregationTime(accountId: string): Promise<Date | null> {
        const options = { pathParams: { accountId } };
        const stringDate: string = await this.handleRequest("lastUserActionsAggregationTime", options);
        return stringDate ? new Date(stringDate) : null;
    }
    public viewStatsForPublications(publicationIds: string[], userIdToExclude?: string): Promise<IViewsStatsPerPublication> {
        const options = { body: { publicationIds, userIdToExclude } };
        return this.handleRequest("viewStatsForPublications", options);
    }
    public logSerializedClientErrors(serializedErrors: string[], context: ClientErrorContext): Promise<void> {
        const options = { body: { serializedErrors, context } };
        return this.handleRequest("logSerializedClientErrors", options);
    }
    public multiInsertUserAction(userActions: IUserAction[], accountId: string, insertOptions?: MultiInsertOptions): Promise<void> {
        const options = { body: { userActions, accountId, options: insertOptions } };
        return this.handleRequest("multiInsertUserAction", options);
    }

    public globalUsage(): Promise<GlobalUsage> {
        const options = {};
        return this.handleRequest("globalUsage", options);
    }

    public globalUsagePerMonth(): Promise<GlobalUsagePerMonth> {
        const options = {};
        return this.handleRequest("globalUsagePerMonth", options);
    }

    private async sendQueue() {
        if (this.errorQueue.length === 0) {
            return;
        }
        const errors = this.errorQueue.map(({ serializedError }) => serializedError);
        const context = this.errorQueue[0].context;
        this.errorQueue = [];
        await this.logSerializedClientErrors(errors, context);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public async logClientError(error, context: ClientErrorContext): Promise<void> {
        if (this.errorQueue.length > MAX_ERRORS_PER_SEND_INTERVAL) {
            return;
        }
        if (error instanceof ErrorEvent) {
            error = error.error;
        }
        if (typeof error === "string") {
            error = new Error(error);
        }
        try {
            const serializedError = JSON.stringify(error);
            this.errorQueue.push({ serializedError, context });
            this.debouncedSend();
        } catch (err) {
            //
        }
    }

    public accountsLastUsageInformation(accountIds: string[]): Promise<AccountsLastUsageInformation> {
        return this.handleRequest("accountsLastUsageInformation", { body: { accountIds } });
    }

    public recalculateAccountsLastUsageInformation(): Promise<void> {
        return this.handleRequest("recalculateAccountsLastUsageInformation", {});
    }

    mostReadDocuments(accountId: string, count: number): Promise<IDashboardDocument[]> {
        const options = {
            queryParams: { accountId, count }
        };
        return this.handleRequest("mostReadDocuments", options);
    }

    mostEditedDocuments(accountId: string, count: number): Promise<IDashboardDocument[]> {
        const options = {
            queryParams: { accountId, count }
        };
        return this.handleRequest("mostEditedDocuments", options);
    }

    mostActiveEditors(accountId: string, count: number): Promise<DocumentEditor[]> {
        const options = {
            queryParams: { accountId, count }
        };
        return this.handleRequest("mostActiveEditors", options);
    }

    async documentDeletionsStatistics(accountId: string): Promise<IDocumentDeletionsStatistics[]> {
        const options = { queryParams: { accountId } };
        const response: IDocumentDeletionsStatistics[] = await this.handleRequest("documentDeletionsStatistics", options);
        return response.map(stat => ({
            ...stat,
            date: new Date(stat.date),
        }));
    }

    async cspReport(_: Record<string, string>): Promise<void> {
        throw new Error("Not intended to be used this way");
    }
}
