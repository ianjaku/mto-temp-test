import {
    AccountAdminBody,
    AccountAdminParamsOrBody,
    AccountMemberBody,
    AccountMemberParams,
    Allow,
    Authorization,
    MultiAuthorizationAnd,
    MultiAuthorizationOr,
    MultiDocumentEdit,
    PublishDocument,
    ReviewDocument,
    authorize
} from  "@binders/binders-service-common/lib/middleware/authorization";
import {
    ApplicationToken,
    ApplicationTokenOrPublic,
} from  "@binders/binders-service-common/lib/middleware/authentication";
import { NotificationService, NotificationServiceFactory } from "./service";
import { AccountServiceContract } from "@binders/client/lib/clients/accountservice/v1/contract";
import { Alert } from "@binders/client/lib/clients/notificationservice/v1/contract";
import { AuditLogType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import {
    AuthorizationServiceContract
} from  "@binders/client/lib/clients/authorizationservice/v1/contract";
import { ServiceRoute } from "@binders/binders-service-common/lib/middleware/app";
import { TrackingServiceClient } from "@binders/client/lib/clients/trackingservice/v1/client";
import { Unauthorized } from "@binders/client/lib/clients/model";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import { getAppRoutes } from "@binders/client/lib/clients/notificationservice/v1/routes";
import { getClientIps } from "@binders/binders-service-common/lib/util/ip";

export function getServiceRoutes(
    notificationServiceFactory: NotificationServiceFactory,
    azClient: AuthorizationServiceContract,
    accountClient: AccountServiceContract,
    trackingClient: TrackingServiceClient
): { [name: string]: ServiceRoute } {
    const appRoutes = getAppRoutes();

    function withService<T>(f: (service: NotificationService, request: WebRequest) => Promise<T>): (request: WebRequest) => Promise<T> {
        return function (request: WebRequest) {
            const service = notificationServiceFactory.forRequest(request)
            return f(service, request);
        };
    }

    function docPublish(key: string, keyInBody?: boolean): Authorization {
        return authorize(PublishDocument(req => Promise.resolve(keyInBody ? req.body[key] : req.params[key])), azClient);
    }

    function docReview(getDocIdFromRequest: (req: WebRequest) => string): Authorization {
        return authorize(
            ReviewDocument(
                (req) => Promise.resolve(getDocIdFromRequest(req))
            ),
            azClient
        );
    }

    function keyInBody(key: string): Authorization {
        return async (req: WebRequest) => {
            if (req.body != null && req.body[key] == null) {
                throw new Unauthorized(`${key} not found.`);
            }
        }
    }

    function multiDocEdit(key: string, requireAll = true) {
        return MultiDocumentEdit(azClient, key, requireAll);
    }

    function logAuditLogAlertChange(request: WebRequest) {
        return (alert: Alert, deleted?: boolean) => {
            trackingClient.logAuditLog(
                AuditLogType.ALERT_CHANGED,
                request.user?.userId,
                undefined,
                request["headers"] && request["headers"]["user-agent"],
                { alert, deleted },
                getClientIps(request)
            )
        }
    }

    return {
        sendNotification: {
            ...appRoutes.sendNotification,
            serviceMethod: withService((service, request) =>
                service.sendNotification(
                    request.body.notification,
                    request.body.options,
                )),
        },
        sendPublishRequestNotification: {
            ...appRoutes.sendPublishRequestNotification,
            serviceMethod: withService((service, request) =>
                service.sendPublishRequestNotification(
                    request.body.accountId,
                    request.body.binderId,
                    request.user.userId
                )),
            authentication: ApplicationToken,
            authorization: docReview(req => req.body.binderId)
        },
        connect: {
            ...appRoutes.connect,
            serviceMethod: withService((service, request) =>
                service.connect(request["ws"], request.user)),
            authentication: ApplicationTokenOrPublic,
            authorization: Allow
        },
        findNotificationTargets: {
            ...appRoutes.findNotificationTargets,
            serviceMethod: withService((service, request) =>
                service.findNotificationTargets(
                    request.body.accountId,
                    request.body.notificationKind,
                    request.body.itemIds
                )),
            authentication: ApplicationToken,
            authorization: MultiAuthorizationOr([
                AccountAdminBody(azClient),
                MultiAuthorizationAnd([
                    keyInBody("itemIds"),
                    multiDocEdit("itemIds", false)
                ])
            ])
        },
        findScheduledNotifications: {
            ...appRoutes.findScheduledNotifications,
            serviceMethod: withService((service, request) =>
                service.findScheduledNotifications(
                    request.body.accountId,
                    request.body.itemId,
                    request.body.kind
                )),
            authentication: ApplicationToken,
            authorization: docPublish("itemId", true)
        },
        findSentNotifications: {
            ...appRoutes.findSentNotifications,
            serviceMethod: withService((service, request) =>
                service.findSentNotifications(
                    request.body.accountId,
                    request.body.itemId
                )),
            authentication: ApplicationToken,
            authorization: AccountMemberBody(accountClient)
        },
        addNotificationTarget: {
            ...appRoutes.addNotificationTarget,
            serviceMethod: withService((service, request) =>
                service.addNotificationTarget(
                    request.body
                )),
            authentication: ApplicationToken,
            authorization: MultiAuthorizationOr([
                AccountAdminBody(azClient),
                MultiAuthorizationAnd([
                    keyInBody("itemId"),
                    docPublish("itemId", true)
                ])
            ])
        },
        deleteNotificationTarget: {
            ...appRoutes.deleteNotificationTarget,
            serviceMethod: withService((service, request) =>
                service.deleteNotificationTarget(
                    request.body.accountId,
                    request.body.targetId,
                    request.body.notificationKind,
                    request.body.itemId
                )),
            authentication: ApplicationToken,
            authorization: MultiAuthorizationOr([
                AccountAdminBody(azClient),
                MultiAuthorizationAnd([
                    keyInBody("itemId"),
                    docPublish("itemId", true)
                ])
            ])
        },
        deleteAllForAccount: {
            ...appRoutes.deleteAllForAccount,
            serviceMethod: withService((service, request) =>
                service.deleteAllForAccount(
                    request.params.accountId
                )),
        },
        deleteNotificationTargets: {
            ...appRoutes.deleteNotificationTargets,
            serviceMethod: withService((service, request) =>
                service.deleteNotificationTargets(
                    request.body.targetId,
                    request.body.accountId,
                )),
        },
        runScheduledEvents: {
            ...appRoutes.runScheduledEvents,
            serviceMethod: withService((service) =>
                service.runScheduledEvents()
            ),
        },
        addNotificationTemplate: {
            ...appRoutes.addNotificationTemplate,
            serviceMethod: withService((service, request) =>
                service.addNotificationTemplate(
                    request.body.accountId,
                    request.body.templateData,
                    request.body.templateName,
                    request.body.scheduledDate,
                    request.body.scheduledTime,
                )),
            authentication: ApplicationToken,
            authorization: MultiAuthorizationOr([
                AccountAdminBody(azClient),
                AccountMemberBody(accountClient),
            ])
        },
        deleteNotificationTemplate: {
            ...appRoutes.deleteNotificationTemplate,
            serviceMethod: withService((service, request) =>
                service.deleteNotificationTemplate(
                    request.body.accountId,
                    request.body.notificationTemplateId,
                )),
            authentication: ApplicationToken,
            authorization: MultiAuthorizationOr([
                AccountAdminBody(azClient),
                AccountMemberBody(accountClient),
            ])
        },
        getNotificationTemplatesForAccount: {
            ...appRoutes.getNotificationTemplatesForAccount,
            serviceMethod: withService((service, request) =>
                service.getNotificationTemplatesForAccount(
                    request.params.accountId
                )),
            authentication: ApplicationToken,
            authorization: MultiAuthorizationOr([
                AccountAdminParamsOrBody(azClient),
                AccountMemberParams(accountClient),
            ])
        },
        sendCustomNotification: {
            ...appRoutes.sendCustomNotification,
            serviceMethod: withService((service, request) =>
                service.sendCustomNotification(
                    request.body.accountId,
                    request.body.itemId,
                    request.body.targets,
                    request.body.subject,
                    request.body.text,
                    request.body.sendAt,
                    request.user?.userId
                )),
            authentication: ApplicationToken,
            authorization: docPublish("itemId", true)
        },
        updateScheduledNotification: {
            ...appRoutes.updateScheduledNotification,
            serviceMethod: withService((service, request) =>
                service.updateScheduledNotification(
                    request.body.scheduledEventId,
                    request.body.notification,
                    request.body.sendAt,
                )),
            authentication: ApplicationToken,
            authorization: docPublish("itemId", true)
        },
        createAlert: {
            ...appRoutes.createAlert,
            serviceMethod: withService((service, request) =>
                service.createAlert(
                    request.body.params,
                    logAuditLogAlertChange(request)
                )),
        },
        updateAlert: {
            ...appRoutes.updateAlert,
            serviceMethod: withService((service, request) =>
                service.updateAlert(
                    request.body.alert,
                    logAuditLogAlertChange(request)
                )),
        },
        deleteAlert: {
            ...appRoutes.deleteAlert,
            serviceMethod: withService((service, request) =>
                service.deleteAlert(
                    request.params.alertId,
                    logAuditLogAlertChange(request)
                )),
        },
        getAlert: {
            ...appRoutes.getAlert,
            serviceMethod: withService((service, request) =>
                service.getAlert(
                    request.params.id
                )),
        },
        findActiveAlerts: {
            ...appRoutes.findActiveAlerts,
            serviceMethod: withService((service, request) =>
                service.findActiveAlerts(
                    request.params.accountId,
                    request.user.userId
                )),
            authentication: ApplicationToken,
            authorization: AccountMemberParams(accountClient),
        },
        findAllAlerts: {
            ...appRoutes.findAllAlerts,
            serviceMethod: withService((service) =>
                service.findAllAlerts()
            ),
        }
    };
}
