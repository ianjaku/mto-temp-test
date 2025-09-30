import * as HTTPStatusCode from "http-status-codes";
import { AppRoute, HTTPVerb } from "../../routes";
import {
    fromBody,
    fromParams,
    fromQuery,
    validateAccountId,
    validateAccountIds,
    validateArrayInput,
    validateBinderId,
    validateBinderIds,
    validateDocumentCollectionId,
    validateItemIds,
    validateLogType,
    validateUserActionFilter,
} from "../../validation";
import { validateEventFilter, validateEvents } from "./validation";
import { TrackingServiceContract } from "./contract";

export function getRoutes(): { [name in keyof TrackingServiceContract]: AppRoute } {
    return {
        log: {
            description: "Log events",
            path: "/event",
            verb: HTTPVerb.POST,
            validationRules: [[fromBody, "events", validateEvents]],
            successStatus: HTTPStatusCode.CREATED
        },
        createLogAuthToken: {
            description: "Creates an auth token that can be sent with log events to authenticate them",
            path: "/createLogAuthToken",
            verb: HTTPVerb.POST,
            validationRules: [],
            successStatus: HTTPStatusCode.CREATED
        },
        logAuditLog: {
            description: "Log audit log actions",
            path: "/audit-log",
            verb: HTTPVerb.POST,
            validationRules: [],
            successStatus: HTTPStatusCode.CREATED
        },
        findAuditLogs: {
            description: "Find audit logs",
            path: "/findAuditLogs",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromBody, "logType", validateLogType]
            ],
            successStatus: HTTPStatusCode.OK
        },
        findUserActions: {
            description: "Returns all statistics for the given filter",
            path: "/statistics/findUserActions",
            verb: HTTPVerb.POST,
            validationRules: [[fromBody, "filter", validateUserActionFilter]],
            successStatus: HTTPStatusCode.OK
        },
        allBinderStatistics: {
            description: "Returns all statistics for the given binder",
            path: "/statistics/document/all",
            verb: HTTPVerb.POST,
            validationRules: [[fromBody, "binderId", validateBinderId]],
            successStatus: HTTPStatusCode.OK
        },
        collectionLanguageStatistics: {
            description: "Returns language statistics for the given collection",
            path: "/statistics/collection/langs",
            verb: HTTPVerb.POST,
            validationRules: [[fromBody, "collectionId", validateDocumentCollectionId]],
            successStatus: HTTPStatusCode.OK
        },
        allViewsStatistics: {
            description: "Returns all statistics for the given items",
            path: "/statistics/views/all",
            verb: HTTPVerb.POST,
            validationRules: [[fromBody, "itemIds", validateItemIds]],
            successStatus: HTTPStatusCode.OK
        },
        composerStatistics: {
            description: "Returns statistics for the given items to be used in the editor's composer",
            path: "/statistics/composer",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "binderIds", validateBinderIds],
                [fromBody, "accountId", validateAccountId],
                [fromBody, "filter", validateEventFilter],
            ],
            successStatus: HTTPStatusCode.OK
        },
        mostUsedLanguages: {
            description: "Returns the most used languages for a given account",
            path: "/statistics/mostUsedLanguages/:accountId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        findEvents: {
            description: "Returns item creation events",
            path: "/statistics/events/find",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromBody, "eventFilter", validateEventFilter]
            ],
            successStatus: HTTPStatusCode.OK
        },
        loginStatistics: {
            description: "Returns the statistics of logins",
            path: "/statistics/logins",
            verb: HTTPVerb.POST,
            validationRules: [[fromBody, "accountId", validateAccountId]],
            successStatus: HTTPStatusCode.OK
        },
        userCountStatistics: {
            description: "Returns the statistics of number of users over time",
            path: "/statistics/usercount",
            verb: HTTPVerb.POST,
            validationRules: [[fromBody, "accountId", validateAccountId]],
            successStatus: HTTPStatusCode.OK
        },
        accountViewsStatistics: {
            description: "Returns the statistics of account views",
            path: "/statistics/accountViews",
            verb: HTTPVerb.POST,
            validationRules: [[fromBody, "accountId", validateAccountId]],
            successStatus: HTTPStatusCode.OK
        },
        documentCreationsStatistics: {
            description: "Number of document creations per day for an account",
            path: "/statistics/documents/creations",
            verb: HTTPVerb.POST,
            validationRules: [[fromBody, "accountId", validateAccountId]],
            successStatus: HTTPStatusCode.OK
        },
        documentDeletionsStatistics: {
            description: "Number of document deletions per day for an account",
            path: "/statistics/documents/deletions",
            verb: HTTPVerb.GET,
            validationRules: [[fromQuery, "accountId", validateAccountId]],
            successStatus: HTTPStatusCode.OK
        },
        itemEditsStatistics: {
            description: "Number of items edited per day",
            path: "/statistics/items/edits",
            verb: HTTPVerb.POST,
            validationRules: [[fromBody, "accountId", validateAccountId]],
            successStatus: HTTPStatusCode.OK
        },
        searchUserActions: {
            description: "Returns the user actions for the given filter",
            path: "/searchUserActions",
            verb: HTTPVerb.POST,
            validationRules: [[fromBody, "filter", validateUserActionFilter]],
            successStatus: HTTPStatusCode.OK
        },
        searchUserReadSessions: {
            description: "Returns all read sessions statistics for the given filter in table format",
            path: "/searchUserReadSessions",
            verb: HTTPVerb.POST,
            validationRules: [[fromBody, "filter", validateUserActionFilter]],
            successStatus: HTTPStatusCode.OK
        },
        aggregateUserEvents: {
            description: "Aggregate events from the elaborate events collection in mongo to elasticsearch indices",
            path: "/statistics/user/aggregate",
            verb: HTTPVerb.POST,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        readSessionsCsv: {
            description: "Compose csv of all read sessions within a given account, by approximation",
            path: "/statistics/readsessions/:accountId",
            verb: HTTPVerb.GET,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        lastUserActionsAggregationTime: {
            description: "Get the timestamp of the last useractions aggregation",
            path: "/statistics/useractions/:accountId/lastaggregation",
            verb: HTTPVerb.GET,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        viewStatsForPublications: {
            description: "Returns view statistics for the publications of given binderId",
            path: "/statistics/views/forpublications",
            verb: HTTPVerb.POST,
            validationRules: [[fromBody, "publicationIds", validateArrayInput("publicationIds", validateBinderId)]],
            successStatus: HTTPStatusCode.OK
        },
        logSerializedClientErrors: {
            description: "Log an array of client-side errors",
            path: "/reporting/client-errors",
            verb: HTTPVerb.POST,
            validationRules: [],
            successStatus: HTTPStatusCode.CREATED
        },
        globalUsage: {
            description: "Get the global useage metrics",
            path: "/metrics/global",
            verb: HTTPVerb.POST,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        multiInsertUserAction: {
            description: "Insert an array of user actions",
            path: "/useractions/multi-insert",
            verb: HTTPVerb.POST,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        globalUsagePerMonth: {
            description: "Get the global platform usage metrics per month",
            path: "/metrics/global/monthly",
            verb: HTTPVerb.GET,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        accountsLastUsageInformation: {
            description: "Get info about when provided accounts were last read & edited",
            path: "/metrics/lastUsage",
            verb: HTTPVerb.POST,
            validationRules: [[fromBody, "accountIds", validateAccountIds]],
            successStatus: HTTPStatusCode.OK
        },
        recalculateAccountsLastUsageInformation: {
            description: "Triggers a recalculation of the latest read and edit times for each account",
            path: "/metrics/lastUsage/recalculate",
            verb: HTTPVerb.POST,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        mostReadDocuments: {
            description: "Fetches the most read documents for the requested account",
            path: "/mostReadDocuments",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromQuery, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        mostEditedDocuments: {
            description: "Fetches the most edited documents for the requested account",
            path: "/mostEditedDocuments",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromQuery, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        mostActiveEditors: {
            description: "Fetches the most active (non manual to) document editors for the requested account",
            path: "/mostActiveEditors",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromQuery, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        cspReport: {
            description: "Receives CSP reports from the browser",
            path: "/cspReport",
            verb: HTTPVerb.POST,
            validationRules: [],
            successStatus: HTTPStatusCode.OK,
        }
    };
}
