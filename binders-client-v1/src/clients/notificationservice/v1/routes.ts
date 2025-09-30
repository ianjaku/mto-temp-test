import * as HTTPStatusCode from "http-status-codes";

import { AppRoute, HTTPVerb } from "../../routes";
import { fromBody, fromParams, validateAccountId, validateBinderId, validateStringInput } from "../../validation";
import { validateNotification, validateNotifierKind } from "./validation";

export function getAppRoutes(): { [name: string]: AppRoute } {
    return {
        sendNotification: {
            description: "Dispatch a notification",
            path: "/notifications",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "notification", validateNotification]
            ],
            successStatus: HTTPStatusCode.CREATED
        },
        sendPublishRequestNotification: {
            description: "Notify notification targets of the PublishRequest kind that a publish request has been made",
            path: "/sendPublishRequestNotification",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromBody, "binderId", validateBinderId]
            ],
            successStatus: HTTPStatusCode.CREATED
        },
        connect: {
            description: "Open a websocket connection",
            path: "/connect",
            verb: HTTPVerb.GET,
            webSocket: true,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        findNotificationTargets: {
            description: "List all notificationtargets matching the given query",
            path: "/notificationtargets/find",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        findScheduledNotifications: {
            description: "List scheduled notifications for a specific item",
            path: "/scheduledevents/find",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromBody, "itemId", validateStringInput]
            ],
            successStatus: HTTPStatusCode.OK
        },
        findSentNotifications: {
            description: "List all sent notifications",
            path: "/notifications/sent",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        addNotificationTarget: {
            description: "Add a new notification target",
            path: "/notificationtargets",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromBody, "notifierKind", validateNotifierKind],
                [fromBody, "targetId", validateStringInput]
            ],
            successStatus: HTTPStatusCode.CREATED
        },
        deleteNotificationTarget: {
            description: "Remove an existing notification target",
            path: "/notificationtargets/delete",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromBody, "targetId", validateStringInput],
                [fromBody, "notificationKind", validateStringInput]
            ],
            successStatus: HTTPStatusCode.OK
        },
        deleteNotificationTargets: {
            description: "Remove notification targets by targetId",
            path: "/notificationtargets/delete-many",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "targetId", validateStringInput],
            ],
            successStatus: HTTPStatusCode.OK
        },
        deleteAllForAccount: {
            description: "Delete everything related to the given account",
            path: "/accounts/:accountId/delete",
            verb: HTTPVerb.DELETE,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        runScheduledEvents: {
            description: "Check if any scheduled events need to be ran, and run them",
            path: "/scheduledevents/run",
            verb: HTTPVerb.POST,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        getTestNotifierMessages: {
            description: "Returns a list of all notifications made with NotifierKind.Test (since last restart)",
            path: "/testing/notifiermessages/:accountId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "accountId", validateAccountId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        addNotificationTemplate: {
            description: "Add a new notification template",
            path: "/notificationtemplates",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromBody, "templateName", validateStringInput]
            ],
            successStatus: HTTPStatusCode.CREATED
        },
        deleteNotificationTemplate: {
            description: "Delete the given notification template",
            path: "/notificationtemplates/delete",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromBody, "notificationTemplateId", validateStringInput]
            ],
            successStatus: HTTPStatusCode.OK
        },
        getNotificationTemplatesForAccount: {
            description: "Get all saved templates for account id",
            path: "/notificationtemplates/:accountId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "accountId", validateAccountId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        sendCustomNotification: {
            description: "Send a custom notification",
            path: "/notifications/custom",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromBody, "itemId", validateStringInput],
                [fromBody, "subject", validateStringInput],
                [fromBody, "text", validateStringInput],
            ],
            successStatus: HTTPStatusCode.OK
        },
        updateScheduledNotification: {
            description: "Update a scheduled item notification",
            path: "/notifications/custom",
            verb: HTTPVerb.PUT,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromBody, "itemId", validateStringInput],
                [fromBody, "scheduledEventId", validateStringInput]
            ],
            successStatus: HTTPStatusCode.OK
        },
        createAlert: {
            description: "Create a new alert",
            path: "/alerts",
            verb: HTTPVerb.POST,
            validationRules: [],
            successStatus: HTTPStatusCode.CREATED
        },
        updateAlert: {
            description: "Updates an alert",
            path: "/alerts",
            verb: HTTPVerb.PUT,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        deleteAlert: {
            description: "Deletes an alert",
            path: "/alerts/:alertId",
            verb: HTTPVerb.DELETE,
            validationRules: [
                [fromParams, "alertId", validateStringInput]
            ],
            successStatus: HTTPStatusCode.OK
        },
        getAlert: {
            description: "Fetches a single alert",
            path: "/alerts/:id",
            verb: HTTPVerb.GET,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        findActiveAlerts: {
            description: "Fetch all active alerts",
            path: "/alerts/active/:accountId",
            verb: HTTPVerb.GET,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        findAllAlerts: {
            description: "Fetch all alerts",
            path: "/alerts",
            verb: HTTPVerb.GET,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
    };
}
