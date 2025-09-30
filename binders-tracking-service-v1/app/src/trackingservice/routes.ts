import {
    AccountAdminBody,
    AccountAdminBodyFilter,
    AccountAdminParams,
    AccountMemberBody,
    AdminDocument,
    Allow,
    Authorization,
    IdExtractor,
    MultiAuthorization,
    authorize,
    authorizeItemIds,
} from "@binders/binders-service-common/lib/middleware/authorization";
import {
    ApplicationToken,
    ApplicationTokenOrPublic,
    Public
} from "@binders/binders-service-common/lib/middleware/authentication";
import {
    AuthorizationServiceContract,
    PermissionName
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { TrackingService, TrackingServiceFactory } from "./service";
import {
    validateLogType,
    validateUserId
} from "@binders/client/lib/clients/validation";
import { AccountServiceContract } from "@binders/client/lib/clients/accountservice/v1/contract";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import LaunchDarklyService from "@binders/binders-service-common/lib/launchdarkly/server";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { ServiceRoute } from "@binders/binders-service-common/lib/middleware/app";
import { TrackingServiceContract } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import { completeUserActions } from "./helper";
import { getRoutes as getAppRoutes } from "@binders/client/lib/clients/trackingservice/v1/routes";
import { requireLaunchDarklyFlagEnabled } from "@binders/binders-service-common/lib/middleware/flags";

export function getServiceRoutes(
    trackingServiceFactory: TrackingServiceFactory,
    azClient: AuthorizationServiceContract,
    accountClient: AccountServiceContract,
    launchDarklyService: LaunchDarklyService,
): { [name in keyof TrackingServiceContract]: ServiceRoute } {

    function withService<T>(f: (service: TrackingService, request: WebRequest) => Promise<T>): (request: WebRequest) => Promise<T> {
        return function (request: WebRequest) {
            const service = trackingServiceFactory.forRequest(request);
            return f(service, request);
        };
    }
    function docAdmin(extractor: IdExtractor): Authorization {
        return authorize(AdminDocument(extractor), azClient);
    }

    const appRoutes = getAppRoutes();

    const AccountMember = AccountMemberBody(accountClient);

    /* tslint:disable:no-any */
    return {
        log: {
            ...appRoutes.log,
            serviceMethod: withService((service, request) => {
                const { body, user } = request;
                // There might still be some legacy code that uses the userId in the body and not in the event itself
                // The sole purpose of this code is to fill in those gaps.
                // If that happens, it will be logged in the service
                let userId = user?.userId;
                if (user?.isBackend) {
                    userId = body.userId ?? user.userId;
                }
                return service.log(body.events, userId, request.user?.isBackend);
            }),
            authentication: ApplicationTokenOrPublic,
            authorization: Allow
        },
        createLogAuthToken: {
            ...appRoutes.createLogAuthToken,
            serviceMethod: withService((service, request) => {
                return service.createLogAuthToken(request.user?.userId);
            }),
            authentication: ApplicationToken,
            authorization: Allow
        },
        logAuditLog: {
            ...appRoutes.logAuditLog,
            serviceMethod: withService((service, request) => {
                const { body } = request;
                return <Promise<boolean>>(service.logAuditLog(
                    assertCorrectness(body.logType, validateLogType, request.logger),
                    assertCorrectness(body.userId, validateUserId, request.logger),
                    body.accountId,
                    body.userAgent,
                    body.data,
                    body.ip,
                    body.timestamp
                ));
            }),
        },
        findAuditLogs: {
            ...appRoutes.findAuditLogs,
            serviceMethod: withService((service, request) => {
                const { body } = request;
                return service.findAuditLogs(
                    body.accountId,
                    body.logType,
                    body.startDate,
                    body.endDate
                );
            }),
        },
        findUserActions: {
            ...appRoutes.findUserActions,
            serviceMethod: withService((service, request) =>
                service.findUserActions(request.body.filter),
            ),
        },
        collectionLanguageStatistics: {
            ...appRoutes.collectionLanguageStatistics,
            serviceMethod: withService((service, request) =>
                service.collectionLanguageStatistics(request.body.collectionId, request.body.filter)
            ),
            authentication: ApplicationToken,
            authorization: docAdmin(req => req.body.collectionId),
        },
        allBinderStatistics: {
            ...appRoutes.allBinderStatistics,
            serviceMethod: withService((service, request) =>
                service.allBinderStatistics(request.body.binderId, request.body.filter, request.body.accountId)
            ),
            authentication: ApplicationToken,
            authorization: docAdmin(req => req.body.binderId)
        },
        allViewsStatistics: {
            ...appRoutes.allViewsStatistics,
            serviceMethod: withService((service, request) =>
                service.allViewsStatistics(request.body.itemIds, request.body.accountId),
            ),
            authentication: ApplicationToken,
            authorization: AccountMember,
        },
        composerStatistics: {
            ...appRoutes.composerStatistics,
            serviceMethod: withService((service, request) =>
                service.composerStatistics(request.body.binderIds, request.body.accountId, request.body.filter)
            ),
            authentication: ApplicationToken,
            authorization: AccountAdminBody(azClient),
        },
        mostUsedLanguages: {
            ...appRoutes.mostUsedLanguages,
            serviceMethod: withService((service, request) =>
                service.mostUsedLanguages(request.body.accountId)
            ),
            authentication: ApplicationToken,
            authorization: AccountMember,
        },
        findEvents: {
            ...appRoutes.findEvents,
            serviceMethod: withService((service, request) =>
                service.findEvents(request.body.accountId, request.body.eventFilter)
            ),
        },
        loginStatistics: {
            ...appRoutes.loginStatistics,
            serviceMethod: withService((service, request) =>
                service.loginStatistics(request.body.accountId)
            ),
        },
        userCountStatistics: {
            ...appRoutes.userCountStatistics,
            serviceMethod: withService((service, request) =>
                service.userCountStatistics(request.body.accountId)
            ),
        },
        accountViewsStatistics: {
            ...appRoutes.accountViewsStatistics,
            serviceMethod: withService((service, request) =>
                service.accountViewsStatistics(request.body.accountId, request.body.excludeAuthors)
            ),
        },
        documentCreationsStatistics: {
            ...appRoutes.documentCreationsStatistics,
            serviceMethod: withService((service, request) =>
                service.documentCreationsStatistics(request.body.accountId)
            ),
        },
        itemEditsStatistics: {
            ...appRoutes.itemEditsStatistics,
            serviceMethod: withService((service, request) =>
                service.itemEditsStatistics(request.body.accountId)
            ),
        },
        readSessionsCsv: {
            ...appRoutes.readSessionsCsv,
            serviceMethod: withService(async (service, request) => {
                if (!request?.user?.isBackend) {
                    await requireLaunchDarklyFlagEnabled(launchDarklyService, LDFlags.ACCOUNT_ADMINS_CAN_GENERATE_ACCOUNT_REPORTS, request.logger);
                }
                return service.readSessionsCsv(request.params.accountId);
            }),
            authentication: ApplicationToken,
            authorization: AccountAdminParams(azClient),
        },
        searchUserActions: {
            ...appRoutes.searchUserActions,
            serviceMethod: withService((service, request) =>
                service.searchUserActions(request.body.filter, request.user.userId, request.user.isBackend)
            ),
            authentication: ApplicationToken,
            authorization: Allow,
        },
        searchUserReadSessions: {
            ...appRoutes.searchUserReadSessions,
            serviceMethod: withService((service, request) =>
                service.searchUserReadSessions(request.body.filter)
            ),
            authentication: ApplicationToken,
            authorization: MultiAuthorization([
                AccountAdminBodyFilter(azClient),
                authorizeItemIds(
                    (request) => request.body.filter.itemIds,
                    [PermissionName.EDIT],
                    azClient
                )
            ])
        },
        aggregateUserEvents: {
            ...appRoutes.aggregateUserEvents,
            serviceMethod: withService((service, request) => {
                const { body: { accountIds, options } } = request;
                return service.aggregateUserEvents(accountIds, options);
            }),
        },
        lastUserActionsAggregationTime: {
            ...appRoutes.lastUserActionsAggregationTime,
            serviceMethod: withService((service, request) => {
                return service.lastUserActionsAggregationTime(request.params.accountId);
            }),
            authentication: ApplicationToken,
            authorization: Allow,
        },
        viewStatsForPublications: {
            ...appRoutes.viewStatsForPublications,
            serviceMethod: withService((service, request) =>
                service.viewStatsForPublications(request.body.publicationIds),
            ),
        },
        logSerializedClientErrors: {
            ...appRoutes.logSerializedClientErrors,
            serviceMethod: withService((service, request) =>
                service.logSerializedClientErrors(
                    request.body.serializedErrors,
                    request.body.context,
                    request
                )
            ),
            authentication: ApplicationTokenOrPublic,
            authorization: Allow
        },
        globalUsage: {
            ...appRoutes.globalUsage,
            serviceMethod: withService((service) =>
                service.globalUsage()
            )
        },
        multiInsertUserAction: {
            ...appRoutes.multiInsertUserAction,
            serviceMethod: withService((service, request) =>
                service.multiInsertUserAction(
                    completeUserActions(request.body.userActions),
                    request.body.accountId,
                    request.body.options
                )
            ),
            authentication: ApplicationToken,
            authorization: AccountMember
        },
        globalUsagePerMonth: {
            ...appRoutes.globalUsagePerMonth,
            serviceMethod: withService((service) =>
                service.globalUsagePerMonth()
            )
        },
        accountsLastUsageInformation: {
            ...appRoutes.accountsLastUsageInformation,
            serviceMethod: withService((service, request) =>
                service.accountsLastUsageInformation(request.body.accountIds)
            ),
            authentication: ApplicationToken,
            authorization: Allow
        },
        recalculateAccountsLastUsageInformation: {
            ...appRoutes.recalculateAccountsLastUsageInformation,
            serviceMethod: withService((service) =>
                service.recalculateAccountsLastUsageInformation())
        },
        mostReadDocuments: {
            ...appRoutes.mostReadDocuments,
            serviceMethod: withService((service, request) =>
                service.mostReadDocuments(request.query.accountId as string, parseInt(request.query.count as string))),
        },
        mostEditedDocuments: {
            ...appRoutes.mostEditedDocuments,
            serviceMethod: withService((service, request) =>
                service.mostEditedDocuments(request.query.accountId as string, parseInt(request.query.count as string))),
        },
        mostActiveEditors: {
            ...appRoutes.mostActiveEditors,
            serviceMethod: withService((service, request) =>
                service.mostActiveEditors(request.query.accountId as string, parseInt(request.query.count as string))),
        },
        documentDeletionsStatistics: {
            ...appRoutes.documentDeletionsStatistics,
            serviceMethod: withService((service, request) =>
                service.documentDeletionsStatistics(request.query.accountId as string)),
        },
        cspReport: {
            ...appRoutes.cspReport,
            serviceMethod: withService((service, request) =>
                service.cspReport(request.body["csp-report"] ?? {})),
            authentication: Public,
            authorization: Allow,
        }
    };
}

function assertCorrectness<T>(candidate: T, validator: (_: T) => string[], logger: Logger): T {
    const validationMessages = validator(candidate);
    if (validationMessages.length > 0) {
        logger.warn(`Validation failed with ${validationMessages}`, "auditing");
    }
    return candidate;
}
