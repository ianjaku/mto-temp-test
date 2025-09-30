import {
    AccountAdminParams,
    Allow,
} from "@binders/binders-service-common/lib/middleware/authorization";
import {
    ApplicationToken,
    ApplicationTokenOrPublic,
} from "@binders/binders-service-common/lib/middleware/authentication";
import {
    AuditLogType,
    TrackingServiceContract
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { ExportService, ExportServiceFactory } from "./service";
import { AuthorizationServiceContract } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { BindersRepositoryServiceFactory } from "../repositoryservice/service";
import { ExportServiceContract } from "@binders/client/lib/clients/exportservice/v1/contract";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import LaunchDarklyService from "@binders/binders-service-common/lib/launchdarkly/server";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { ServiceRoute } from "@binders/binders-service-common/lib/middleware/app";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import { extractInterfaceLanguageFromRequest } from "@binders/binders-service-common/lib/util/i18n";
import getAppRoutes from "@binders/client/lib/clients/exportservice/v1/routes";
import { getClientIps } from "@binders/binders-service-common/lib/util/ip";
import { publicationAuthorization } from "../repositoryservice/authorization";
import { requireLaunchDarklyFlagEnabled } from "@binders/binders-service-common/lib/middleware/flags";

export function getServiceRoutes(
    logger: Logger,
    azClient: AuthorizationServiceContract,
    serviceFactory: ExportServiceFactory,
    repoServiceFactory: BindersRepositoryServiceFactory,
    trackingClient: TrackingServiceContract,
    launchDarklyService: LaunchDarklyService,
): { [name in keyof ExportServiceContract]: ServiceRoute } {
    const appRoutes = getAppRoutes();
    const repoClient = repoServiceFactory.forRequest({ logger })
    const { publicationRead } = publicationAuthorization(azClient, repoClient);

    function withService<T>(f: (service: ExportService, request: WebRequest) => Promise<T>): (request: WebRequest) => Promise<T> {
        return function(request: WebRequest) {
            const service = serviceFactory.forRequest(request);
            return f(service, request);
        };
    }

    const logAuditLogForPublicationExport = (request: WebRequest) => {
        return (
            binderId: string,
            accountId: string,
            publicationId: string,
            translationLanguage?: string,
        ) => {
            const { from } = request.body;
            trackingClient.logAuditLog(
                AuditLogType.EXPORT_PDF,
                request.user && request.user.userId,
                accountId,
                request["headers"] && request["headers"]["user-agent"],
                {
                    binderId,
                    publicationId,
                    from,
                    translationLanguage,
                },
                getClientIps(request),
            );
        };
    };

    return {
        docInfosCsv: {
            ...appRoutes.docInfosCsv,
            serviceMethod: withService(async (service, req) => {
                if (!req?.user?.isBackend) {
                    await requireLaunchDarklyFlagEnabled(launchDarklyService, LDFlags.ACCOUNT_ADMINS_CAN_GENERATE_ACCOUNT_REPORTS, req.logger);
                }
                return service.docInfosCsv(req.params.accountId);
            }),
            authentication: ApplicationToken,
            authorization: AccountAdminParams(azClient)
        },
        colInfosCsv: {
            ...appRoutes.colInfosCsv,
            serviceMethod: withService(async (service, req) => {
                if (!req?.user?.isBackend) {
                    await requireLaunchDarklyFlagEnabled(launchDarklyService, LDFlags.ACCOUNT_ADMINS_CAN_GENERATE_ACCOUNT_REPORTS, req.logger);
                }
                return service.colInfosCsv(req.params.accountId);
            }),
            authentication: ApplicationToken,
            authorization: AccountAdminParams(azClient)
        },
        exportPublication: {
            ...appRoutes.exportPublication,
            serviceMethod: withService(async (service, request) =>
                service.exportPublication(
                    request.params.publicationId,
                    request.body.domain,
                    request.body.timezone,
                    request.body.options,
                    request.body.from,
                    logAuditLogForPublicationExport(request),
                    (await extractInterfaceLanguageFromRequest(request, { domain: request.body.domain })),
                )),
            authentication: ApplicationTokenOrPublic,
            authorization: publicationRead("publicationId")
        },
        getPdfExportOptionsForBinder: {
            ...appRoutes.getPdfExportOptionsForBinder,
            serviceMethod: withService((service, request) =>
                service.getPdfExportOptionsForBinder(request.params.binderId, request.params.languageCode)
            ),
            authentication: ApplicationTokenOrPublic,
            authorization: Allow
        },
        previewExportPublication: {
            ...appRoutes.previewExportPublication,
            serviceMethod: withService(async (service, request) =>
                service.previewExportPublication(
                    request.params.publicationId,
                    request.body.domain,
                    request.body.timezone,
                    request.body.options,
                    (await extractInterfaceLanguageFromRequest(request, { domain: request.body.domain })),
                )),
            authentication: ApplicationTokenOrPublic,
            authorization: publicationRead("publicationId"),
        },
    };

}
