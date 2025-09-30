import {
    AccountAdminParams,
    AccountMember,
    Allow,
    BindersAccountAdmin
} from "@binders/binders-service-common/lib/middleware/authorization";
import {
    ApplicationToken,
    Public
} from "@binders/binders-service-common/lib/middleware/authentication";
import {
    AuditLogType,
    TrackingServiceContract,
    UserActionType
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { Logger, LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { PublicApi, PublicApiAuthentication } from "./access";
import { PublicApiService, PublicApiServiceFactory } from "./service";
import {
    ServerEvent,
    captureServerEvent
} from "@binders/binders-service-common/lib/tracking/capture";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import {
    AuthorizationServiceClient
} from "@binders/client/lib/clients/authorizationservice/v1/client";
import { Config } from "@binders/client/lib/config/config";
import { FileSizeExceededError } from "./errorhandler";
import {
    FindBindersStatusesQueryParams
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import PublicAPIContract from "@binders/client/lib/clients/publicapiservice/v1/contract";
import { ServiceRoute } from "@binders/binders-service-common/lib/middleware/app";
import { TallyAuthorization } from "@binders/binders-service-common/lib/tally";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import { getRoutes as getAppRoutes } from "@binders/client/lib/clients/publicapiservice/v1/routes";
import { getClientIps } from "@binders/binders-service-common/lib/util/ip";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function getServiceRoutes(
    config: Config,
    serviceFactory: PublicApiServiceFactory,
    accountClient: AccountServiceClient,
    authorizationClient: AuthorizationServiceClient,
    trackingClient: TrackingServiceContract
): { [name in keyof PublicAPIContract]: ServiceRoute } {
    const appRoutes = getAppRoutes();
    const PublicApiAuth = PublicApi(config);

    function withService<T>(f: (service: PublicApiService, request) => Promise<T>): (request) => Promise<T> {
        return function(request) {
            const service = serviceFactory.forRequest(request);
            return f(service, request);
        };
    }

    function splitCsv(csv: string): string[] {
        return csv?.split(",").map(x => x.trim()).filter(x => x.length > 0) ?? [];
    }

    function ensureContentSizeIsBelowLimit(request: WebRequest, logger: Logger, maxFileSizeMb = 100, logCategory?: string): void {
        const MAX_FILE_SIZE_B = maxFileSizeMb * 1024 * 1024;
        const contentLength = request.headers["content-length"];
        if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE_B) {
            logger.warn(`File size exceeds ${maxFileSizeMb}MB limit`, logCategory || "ensureContentSizeIsBelowLimit", {
                contentLength: contentLength,
                maxSize: MAX_FILE_SIZE_B
            });
            throw new FileSizeExceededError(
                `File size exceeds the maximum allowed size of ${maxFileSizeMb}MB`,
                MAX_FILE_SIZE_B,
                contentLength,
            );
        }
    }

    return {
        findBindersStatuses: {
            ...appRoutes.findBindersStatuses,
            serviceMethod: withService((service, request) => (
                service.findBindersStatuses(
                    request.user,
                    request.query as FindBindersStatusesQueryParams
                )
            )),
            // First column is the ID, then all columns that do not have "parentTitle" in the name, and then the parentTitles
            csvFormattingOrder: ["id", "title", /^((?!(parentTitle)).)*$/i, /parentTitle[0-9]+/i],
            ...PublicApiAuth
        },
        listCollections: {
            ...appRoutes.listCollections,
            serviceMethod: withService((service, request) => (
                service.listCollections(request.user)
            )),
            ...PublicApiAuth,
        },
        findCollection: {
            ...appRoutes.findCollection,
            serviceMethod: withService((service, request) => (
                service.findCollection(
                    request.params.collectionId,
                    request.user,
                )
            )),
            ...PublicApiAuth,
        },
        findPublication: {
            ...appRoutes.findPublication,
            serviceMethod: withService((service, request) => (
                service.findPublication(
                    request.body.accountId,
                    request.body.documentId,
                    request.body.languageCode,
                    request.body.format,
                    request.body.viewportDimensions,
                    request.user,
                )
            )),
            ...PublicApiAuth,
        },
        generateApiToken: {
            ...appRoutes.generateApiToken,
            serviceMethod: withService((service, request) => {
                const logAudit = async (token: string) => {
                    await trackingClient.logAuditLog(
                        AuditLogType.PUBLIC_API_TOKEN_GENERATED,
                        request.user.userId,
                        request.body.accountId,
                        request["headers"] && request["headers"]["user-agent"],
                        { token },
                        getClientIps(request)
                    );
                }
                return service.generateApiToken(
                    request.body.accountId,
                    request.user.userId,
                    logAudit
                );
            }),
            authentication: ApplicationToken,
            authorization: AccountMember(
                accountClient,
                async request => request.body.accountId,
            )
        },
        getApiToken: {
            ...appRoutes.getApiToken,
            serviceMethod: withService((service, request) => (
                service.getApiToken(
                    request.params.accountId,
                    request.user.userId
                )
            )),
            authentication: ApplicationToken,
            authorization: AccountMember(
                accountClient,
                async request => request.params.accountId
            )
        },
        globalUsagePerMonth: {
            ...appRoutes.globalUsagePerMonth,
            serviceMethod: withService((service) => (
                service.globalUsagePerMonth()
            )),
            authentication: PublicApiAuth.authentication,
            authorization: BindersAccountAdmin(authorizationClient)
        },
        createUser: {
            ...appRoutes.createUser,
            serviceMethod: withService((service, request) => (
                service.createUser(
                    request.params.accountId,
                    request.body.login,
                    request.body.displayName,
                    request.body.firstName,
                    request.body.lastName,
                    request.body.password,
                )
            )),
            authentication: PublicApiAuthentication(config),
            authorization: AccountAdminParams(authorizationClient),
        },
        deleteUser: {
            ...appRoutes.deleteUser,
            serviceMethod: withService((service, request) => (
                service.deleteUser(
                    request.params.accountId,
                    request.params.userId,
                )
            )),
            authentication: PublicApiAuthentication(config),
            authorization: AccountAdminParams(authorizationClient),
        },
        tallyWebhookPlgSignup: {
            ...appRoutes.tallyWebhookPlgSignup,
            serviceMethod: withService((service, request) => (
                service.tallyWebhookPlgSignup(request.body, {
                    templateCollectionId: request.header("x-binders-template-collection-id"),
                    trialAccountId: request.header("x-binders-trial-account-id"),
                    tallySignature: request.header("tally-signature"),
                })
            )),
            authentication: Public,
            authorization: TallyAuthorization(config),
        },
        searchUserActions: {
            ...appRoutes.searchUserActions,
            serviceMethod: withService(async (service, request) => {
                const result = await service.searchUserActions({
                    accountId: request.params.accountId,
                    binderIds: splitCsv(request.query.binderIds),
                    endIso8601Date: request.query.endIso8601Date ? new Date(request.query.endIso8601Date) : undefined,
                    endUtcTimestamp: request.query.endUtcTimestamp ? parseInt(request.query.endUtcTimestamp) : undefined,
                    itemIds: splitCsv(request.query.itemIds),
                    skipOwnerReadActions: Boolean(request.query.skipOwnerReadActions),
                    skipUnpublished: Boolean(request.query.skipUnpublished),
                    startIso8601Date: request.query.startIso8601Date ? new Date(request.query.startIso8601Date) : undefined,
                    startUtcTimestamp: request.query.startUtcTimestamp ? parseInt(request.query.startUtcTimestamp) : undefined,
                    userActionTypes: splitCsv(request.query.userActionTypes).map((t: string) => UserActionType[t]),
                    userGroupIds: splitCsv(request.query.userGroupIds),
                    userIds: splitCsv(request.query.userIds),
                });
                captureServerEvent(
                    ServerEvent.PublicApiSearchUserActions,
                    { accountId: request.params.accountId, userId: request.user?.id },
                    { noResults: result.length },
                );
                return result;
            }),
            authentication: PublicApiAuth.authentication,
            authorization: AccountAdminParams(authorizationClient),
        },
        generateOneTakeManual: {
            ...appRoutes.generateOneTakeManual,
            serviceMethod: withService(async (service, request) => {
                const logger = LoggerBuilder.fromConfig(config);
                ensureContentSizeIsBelowLimit(request, logger);
                return await service.generateOneTakeManual(
                    request.params.accountId,
                    request.params.collectionId,
                    [],
                    request,
                );
            }),
            authentication: Public,
            authorization: Allow,
            rateLimit: { name: "public-api/generateOneTakeManual", maxRequests: 15, windowMs: 1000 * 60 * 10 },
        }
    }
}