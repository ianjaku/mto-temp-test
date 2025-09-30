import * as HTTPStatusCode from "http-status-codes";
import { AppRoute, HTTPVerb } from "../../routes";
import {
    fromBody,
    fromHeaders,
    fromParams,
    fromQuery,
    validateAccountId,
    validateBinderId,
    validateBoolean,
    validateCollectionId,
    validateCommaSeparatedArrayInput,
    validateDocumentCollectionId,
    validateEmailInput,
    validateISODate,
    validateInteger,
    validateItemId,
    validateStringInput,
    validateUserActionType,
    validateUserId,
    validateUsergroupId
} from "../../validation";
import PublicAPIContract from "./contract";
import { validateViewPortDimensions } from "./validation";

export function getRoutes(): { [name in keyof PublicAPIContract]: AppRoute } {
    return {
        findBindersStatuses: {
            description: "Fetch meta information about binders",
            path: "/binders/statuses",
            verb: HTTPVerb.GET,
            validationRules: [],
            successStatus: HTTPStatusCode.OK,
        },
        listCollections: {
            description: "List all collections user has read access to",
            path: "/collections",
            verb: HTTPVerb.GET,
            validationRules: [
            ],
            successStatus: HTTPStatusCode.OK,
        },
        findCollection: {
            description: "Retrieve a collection",
            path: "/collections/:collectionId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "collectionId", validateDocumentCollectionId],
            ],
            successStatus: HTTPStatusCode.OK,
        },
        findPublication: {
            description: "Find an active publication",
            path: "/publications/find",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "documentId", validateBinderId],
                [fromBody, "languageCode", validateStringInput],
                [fromBody, "viewportDimensions", validateViewPortDimensions],
                [fromBody, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK,
        },
        generateApiToken: {
            description: "Generates a new API token for the given user and account",
            path: "/api-tokens",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.CREATED,
        },
        getApiToken: {
            description: "Fetches the API token for the given user and account",
            path: "/api-tokens/:accountId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK,
        },
        globalUsagePerMonth: {
            description: "Get platform global usage per month",
            path: "/metrics/usage/monthly",
            verb: HTTPVerb.GET,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        createUser: {
            description: "Creates a user and adds it to given account",
            path: "/:accountId/users",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromBody, "login", validateEmailInput],
                [fromBody, "displayName", validateStringInput],
            ],
            successStatus: HTTPStatusCode.CREATED,
        },
        deleteUser: {
            description: "Removes given user as member from given account",
            path: "/:accountId/user/:userId",
            verb: HTTPVerb.DELETE,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromParams, "userId", validateUserId],
            ],
            successStatus: HTTPStatusCode.OK,
        },
        tallyWebhookPlgSignup: {
            description: "Webhook used by Tally to sign up PLG Trial user",
            path: "/tallyWebhookPlgSignup",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromHeaders, "x-binders-template-collection-id", validateCollectionId],
                [fromHeaders, "x-binders-trial-account-id", validateAccountId],
                [fromHeaders, "tally-signature", validateStringInput],
            ],
            successStatus: HTTPStatusCode.OK,
        },
        searchUserActions: {
            description: "Search user actions matching the criteria",
            path: "/user-actions/search/:accountId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromQuery, "binderIds", validateCommaSeparatedArrayInput(validateBinderId), "optional"],
                [fromQuery, "endIso8601Date", validateISODate, "optional"],
                [fromQuery, "endUtcTimestamp", validateInteger, "optional"],
                [fromQuery, "itemIds", validateCommaSeparatedArrayInput(validateItemId), "optional"],
                [fromQuery, "skipOwnerReadActions", validateBoolean, "optional"],
                [fromQuery, "startIso8601Date", validateISODate, "optional"],
                [fromQuery, "startUtcTimestamp", validateInteger, "optional"],
                [fromQuery, "userActionTypes", validateCommaSeparatedArrayInput(validateUserActionType), "optional"],
                [fromQuery, "userGroupIds", validateCommaSeparatedArrayInput(validateUsergroupId), "optional"],
                [fromQuery, "userIds", validateCommaSeparatedArrayInput(validateUserId), "optional"],
            ],
            successStatus: HTTPStatusCode.OK,
        },
        generateOneTakeManual: {
            description: "Generate and publish a one-take-manual, public facing, results in a link to the manual",
            path: "/generateOneTakeManual/:accountId/:collectionId",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromParams, "collectionId", validateCollectionId],
            ],
            successStatus: HTTPStatusCode.OK
        }
    }
}

export default getRoutes;
