import * as HTTPStatusCode from "http-status-codes";
import { AppRoute, HTTPVerb } from "../../routes";
import {
    fromBody,
    fromParams,
    validateAccountId,
    validateAccountIds,
    validateArrayInput,
    validateBoolean,
    validateCollectionId,
    validateCustomerId,
    validateEmailInput,
    validateISODate,
    validateSortMethod,
    validateStringArrayInput,
    validateStringInput,
    validateSubscriptionType,
    validateUserId,
    validateUserIds,
    validateUserOrUsergroupId
} from "../../validation";
import {
    validateAG5AccountSettings,
    validateCreateMSAccountSetupRequestParams,
    validateLanguageAccountSettings,
    validateMTAccountSettings,
    validateManageMemberTrigger,
    validatePDFExportAccountSettings,
    validateSSOAccountSettings,
    validateSecurityAccountSettings,
    validateVisualAccountSettings,
} from "./validation";
import { AccountServiceContract } from "./contract";

export default function getRoutes(): { [name in keyof AccountServiceContract]: AppRoute; } {
    return {
        listAccounts: {
            description: "List available accounts",
            path: "/accounts",
            verb: HTTPVerb.GET,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        createAccount: {
            description: "Create a new account",
            path: "/accounts",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "name", validateStringInput],
                [fromBody, "subscriptionType", validateSubscriptionType],
                [fromBody, "expirationDate", validateISODate],
                [fromBody, "readerExpirationDate", validateISODate],
            ],
            successStatus: HTTPStatusCode.CREATED
        },
        getAccount: {
            description: "Retrieve an account by id",
            path: "/accounts/:accountId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "accountId", validateAccountId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        addMember: {
            description: "Add a new user to an account",
            path: "/accounts/:accountId/members",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromBody, "userId", validateUserId],
                [fromBody, "manageMemberTrigger", validateManageMemberTrigger],
            ],
            successStatus: HTTPStatusCode.OK
        },
        addMembers: {
            description: "Add new users to an account",
            path: "/accounts/:accountId/membersBulk",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromBody, "userIds", validateUserIds],
                [fromBody, "manageMemberTrigger", validateManageMemberTrigger],
            ],
            successStatus: HTTPStatusCode.OK
        },
        removeMember: {
            description: "Remove a member from an account",
            path: "/accounts/:accountId/members",
            verb: HTTPVerb.DELETE,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromBody, "userId", validateUserId],
                [fromBody, "manageMemberTrigger", validateManageMemberTrigger],
            ],
            successStatus: HTTPStatusCode.OK
        },
        removeMembers: {
            description: "Remove multiple members from an account",
            path: "/accounts/:accountId/members/multi",
            verb: HTTPVerb.DELETE,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromBody, "userIds", validateUserIds],
                [fromBody, "manageMemberTrigger", validateManageMemberTrigger],
            ],
            successStatus: HTTPStatusCode.OK
        },
        update: {
            description: "Update the details for the account",
            path: "/accounts/:accountId",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromBody, "name", validateStringInput],
                [fromBody, "subscriptionType", validateSubscriptionType],
                [fromBody, "expirationDate", validateISODate],
                [fromBody, "readerExpirationDate", validateISODate],
            ],
            successStatus: HTTPStatusCode.OK
        },
        getAccountsForUser: {
            description: "Get all accounts a user belongs to",
            path: "/accounts/memberships/:userId/:options?",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "userId", validateUserId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        getAccountIdsForUser: {
            description: "Get all account ids a user belongs to",
            path: "/accountIds/memberships/:userId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "userId", validateUserId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        getAccountIdsForUsersAndGroups: {
            description: "Get a record of all account ids given users and groups belong to",
            path: "/getAccountIdsForUsersAndGroups",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "ids", validateArrayInput("ids", validateUserOrUsergroupId)]
            ],
            successStatus: HTTPStatusCode.OK
        },
        mine: {
            description: "Get all accounts for the currently logged in user",
            path: "/mine/:options?",
            verb: HTTPVerb.GET,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        findAccountsForIds: {
            description: "Link accounts to their corresponding ids",
            path: "/accountsfind",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountIds", validateAccountIds]
            ],
            successStatus: HTTPStatusCode.OK
        },
        getAccountsForADTenant: {
            description: "Get the accounts for the matching AD tenant id",
            path: "/sso/saml/:tenantId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "tenantId", validateStringInput]
            ],
            successStatus: HTTPStatusCode.OK
        },
        setAccountSubscription: {
            description: "Link a subsciption id to an account",
            path: "/accounts/subscriptions/:accountId",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromBody, "subscriptionId", validateStringInput]
            ],
            successStatus: HTTPStatusCode.OK
        },
        getAccountSettings: {
            description: "Get the settings of given account",
            path: "/accounts/:accountId/settings",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        getPublicAccountSettings: {
            description: "Get the public settings of given account",
            path: "/accounts/:accountId/public-settings",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        setAccountDefaultVisualSettings: {
            description: "Save default visual preferences for a given account",
            path: "/accounts/:accountId/settings/visuals/defaultsettings",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromBody, "visualSettings", validateVisualAccountSettings]
            ],
            successStatus: HTTPStatusCode.OK
        },
        setAccountDefaultPDFExportSettings: {
            description: "Save default pdf export preferences for a given account",
            path: "/accounts/:accountId/settings/pdf-export/defaultsettings",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromBody, "settings", validatePDFExportAccountSettings]
            ],
            successStatus: HTTPStatusCode.OK
        },
        setAccountSecuritySettings: {
            description: "Save security settings for a given account",
            path: "/accounts/:accountId/settings/security/defaultsettings",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromBody, "settings", validateSecurityAccountSettings]
            ],
            successStatus: HTTPStatusCode.OK
        },
        setAccountAG5Settings: {
            description: "Save AG5 settings for a given account",
            path: "/setAccountAG5Settings",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromBody, "settings", validateAG5AccountSettings],
            ],
            successStatus: HTTPStatusCode.OK
        },
        setAccountMTSettings: {
            description: "Save default mt preferences for a given account",
            path: "/accounts/:accountId/settings/mt",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromBody, "settings", validateMTAccountSettings]
            ],
            successStatus: HTTPStatusCode.OK
        },
        setAccountSortMethod: {
            description: "Save default sort method for a given account",
            path: "/accounts/:accountId/settings/sortmethod",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromBody, "sortMethod", validateSortMethod]
            ],
            successStatus: HTTPStatusCode.OK
        },
        setAccountMTSettingsLanguagePair: {
            description: "Set a given mt language pair preference",
            path: "/accounts/:accountId/settings/mtpair",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromBody, "languageCodesSerialized", validateStringInput],
            ],
            successStatus: HTTPStatusCode.OK
        },
        setAccountDefaultLanguageSettings: {
            description: "Save default language preferences for a given account",
            path: "/accounts/:accountId/settings/language/defaultsettings",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromBody, "languageSettings", validateLanguageAccountSettings]
            ],
            successStatus: HTTPStatusCode.OK
        },
        setAccountDefaultInterfaceLanguage: {
            description: "Save default interface language preferences for a given account",
            path: "/accounts/:accountId/settings/language/interface",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromBody, "languageSettings", validateLanguageAccountSettings]
            ],
            successStatus: HTTPStatusCode.OK
        },
        setSSOSettings: {
            description: "Save default sso ad preferences for a given account",
            path: "/accounts/:accountId/settings/sso/settings",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromBody, "ssoSettings", validateSSOAccountSettings]
            ],
            successStatus: HTTPStatusCode.OK
        },
        getSSOSettings: {
            description: "Get sso ad preferences for a given account",
            path: "/accounts/:accountId/settings/sso/settings",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        linkFeature: {
            description: "Add a feature to an account",
            path: "/accounts/:accountId/features",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        unlinkFeature: {
            description: "Remove a feature from an account",
            path: "/accounts/:accountId/features",
            verb: HTTPVerb.DELETE,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        getAccountFeatures: {
            description: "List all features",
            path: "/features/:accountId",
            verb: HTTPVerb.GET,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        getAccountFeaturesUsage: {
            description: "Lists, for every used feature, how often it is used",
            path: "/features/usage/list",
            verb: HTTPVerb.GET,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        setAccountFeatures: {
            description: "Set an account's features",
            path: "/features/:accountId",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "features", c => validateStringArrayInput(c, "features")],
            ],
            successStatus: HTTPStatusCode.OK
        },
        findAccounts: {
            description: "Find accounts given a filter",
            path: "/accounts/find",
            verb: HTTPVerb.POST,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        updateTotalPublicDocumentLicensing: {
            description: "Update total number of public documents to the account licensing",
            path: "/licensing/update/:accountId",
            verb: HTTPVerb.PUT,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK,
        },
        findExceedingLimitsLicensing: {
            description: "Get all account licensings exceeding any of public documents or licenses limit",
            path: "/licensing/exceeding",
            verb: HTTPVerb.GET,
            validationRules: [],
            successStatus: HTTPStatusCode.OK,
        },
        getAccountLicensing: {
            description: "Get account licensing for the respective account id",
            path: "/licensing/for-account/:accountId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK,
        },
        getHelpAccount: {
            description: "Get help account",
            path: "/accounts/help/help-account/:options?",
            verb: HTTPVerb.GET,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        generateUserTokenSecretForAccountId: {
            description: "Generate user token secret for account id",
            path: "/accounts/settings/build-token-secret",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK,
        },
        findAccountMemberships: {
            description: "find memberships given an account ID and a filter",
            path: "/accounts/accountMemberships/:accountId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK,
        },
        updateStorageDetails: {
            description: "Save account storage details for a given account",
            path: "/accounts/:accountId/storageDetails",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        createMSTransactableSetupRequest: {
            description: "Microsoft transactable offers: create a request to set up a new account",
            path: "/transactable-offers/setup-requests",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "params", validateCreateMSAccountSetupRequestParams]
            ],
            successStatus: HTTPStatusCode.CREATED
        },
        listMSTransactableSetupRequests: {
            description: "Microsoft transactable offers: list all active setup requests",
            path: "/transactable-offers/setup-requests",
            verb: HTTPVerb.GET,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        msTransactableOffersFullfillmentWebhook: {
            description: "Microsoft transactable offers: Fullfilment API webhook",
            path: "/transactable-offers/webhook",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "id", validateStringInput],
                [fromBody, "activityId", validateStringInput],
                [fromBody, "subscriptionId", validateStringInput],
                [fromBody, "offerId", validateStringInput],
                [fromBody, "planId", validateStringInput],
                [fromBody, "quantity", validateStringInput],
                [fromBody, "timeStamp", validateStringInput],
                [fromBody, "status", validateStringInput],
                [fromBody, "action", validateStringInput]
            ],
            successStatus: HTTPStatusCode.OK
        },
        getAccountSubscriptionByAccountId: {
            description: "Microsoft transactable offers: fetch a subscription by an account id",
            path: "/transactable-offers/subscriptions/:accountId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        createMSTransactableSubscription: {
            description: "Microsoft transactable offers: Creates a link between an account and a subscription",
            path: "/transactable-offers/subscriptions",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateStringInput],
                [fromBody, "subscriptionId", validateStringInput]
            ],
            successStatus: HTTPStatusCode.CREATED
        },
        resolveMSPurchaseIdToken: {
            description: "Microsoft transactable offers: get information about an ms transactable token",
            path: "/transactable-offers/purchase-id-token/:purchaseIdToken",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "purchaseIdToken", validateStringInput],
            ],
            successStatus: HTTPStatusCode.OK
        },
        listCustomers: {
            description: "List available Customers",
            path: "/customers",
            verb: HTTPVerb.GET,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        findCustomers: {
            description: "Find Customers based on query",
            path: "/customerFind",
            verb: HTTPVerb.POST,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        createCustomer: {
            description: "Create a new Customer",
            path: "/customers",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "name", validateStringInput],
            ],
            successStatus: HTTPStatusCode.CREATED
        },
        updateCustomer: {
            description: "Update the details for the Customer",
            path: "/customers/:customerId",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "customerId", validateCustomerId],
                [fromBody, "name", validateStringInput],
            ],
            successStatus: HTTPStatusCode.OK
        },
        deleteCustomer: {
            description: "Delete Customer for given id",
            path: "/customers/:customerId",
            verb: HTTPVerb.DELETE,
            validationRules: [
                [fromParams, "customerId", validateCustomerId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        removeAccountFromCustomer: {
            description: "Remove an account from a Customer",
            path: "/customers/:customerId/accounts",
            verb: HTTPVerb.DELETE,
            validationRules: [
                [fromParams, "customerId", validateCustomerId],
                [fromBody, "accountId", validateAccountId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        addAccountToCustomer: {
            description: "Add an account to a Customer",
            path: "/customers/:customerId/accounts",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "customerId", validateCustomerId],
                [fromBody, "accountId", validateAccountId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        setAnonymised: {
            description: "Update the isAnonymised property",
            path: "/accounts/:accountId/isAnonymised",
            verb: HTTPVerb.PUT,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromBody, "isAnonymised", validateBoolean],
            ],
            successStatus: HTTPStatusCode.OK
        },
        deleteAccount: {
            description: "Delete the given account and everything related to it in this service",
            path: "/accounts/:accountId/delete",
            verb: HTTPVerb.DELETE,
            validationRules: [
                [fromParams, "accountId", validateAccountId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        getAllFeaturesByAccount: {
            description: "Get a map of accountIds with their enabled features",
            path: "/getAllFeaturesByAccount",
            verb: HTTPVerb.GET,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        getAccountsByFeatures: {
            description: "Find accounts with given features enabled",
            path: "/getAccountsByFeatures",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "features", validateArrayInput("features", validateStringInput)]
            ],
            successStatus: HTTPStatusCode.OK
        },
        bootstrapTrialEnvironment: {
            description: "Bootstraps a trial account setting up a test environment for a trial user",
            path: "/bootstrapTrialEnvironment",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "trialAccountId", validateAccountId],
                [fromBody, "templateCollectionId", validateCollectionId],
                [fromBody, "login", validateEmailInput],
            ],
            successStatus: HTTPStatusCode.CREATED
        },
        getLaunchDarklyFlagsForFrontend: {
            description: "Get launchdarkly flags for given accountId and userId. The latter is retrieved from the request",
            path: "/getLaunchDarklyFlagsForFrontend",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        }
    };
}
