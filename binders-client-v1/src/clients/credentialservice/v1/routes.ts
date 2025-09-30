import * as HTTPStatusCode from "http-status-codes";
import { AppRoute, HTTPVerb } from "../../routes";
import {
    fromBody,
    fromParams,
    validateAccountId,
    validateArrayInput,
    validateEmailInput,
    validateLoginInput,
    validateNullOr,
    validatePasswordInput,
    validateStringInput,
    validateUserId,
    validateUserIds,
    validateUsergroupId,
} from "../../validation";
import { CredentialServiceContract } from "./contract";
import { validateTokenAcl } from "./validation";

export function getRoutes(): { [name in keyof CredentialServiceContract]: AppRoute } {
    return {
        createCredential: {
            description: "Create a new password credential for the given user",
            path: "/createCredential/:userId",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "userId", validateUserId],
                [fromBody, "login", validateStringInput],
                [fromBody, "password", validatePasswordInput]
            ],
            successStatus: HTTPStatusCode.CREATED
        },
        anonymizeCredential: {
            description: "Anonymise the user details for the user with given id",
            path: "/anonymizeCredential/:userId",
            verb: HTTPVerb.DELETE,
            validationRules: [
                [fromParams, "userId", validateUserId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        updateLogin: {
            description: "Updates the login information for a user with given id",
            path: "/login/:userId",
            verb: HTTPVerb.PUT,
            validationRules: [
                [fromParams, "userId", validateUserId],
                [fromBody, "login", validateStringInput]
            ],
            successStatus: HTTPStatusCode.OK
        },
        getBrowserUsageReport: {
            description: "Get browser usage report",
            path: "/sessions/browserReport",
            verb: HTTPVerb.GET,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        loginWithPassword: {
            description: "Create a new session with the given login and password combination",
            path: "/sessions",
            verb: HTTPVerb.POST,
            successStatus: HTTPStatusCode.OK,
            validationRules: [
            ]
        },
        loginWithUserToken: {
            description: "Create a new session using a userToken for authentication",
            path: "/sessions/fromUserToken",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        updatePassword: {
            description: "Update the password credential for the given user",
            path: "/passwords/:userId",
            verb: HTTPVerb.PUT,
            validationRules: [
                [fromParams, "userId", validateUserId],
                [fromBody, "login", validateLoginInput],
                [fromBody, "oldPassword", validateStringInput],
                [fromBody, "newPassword", validatePasswordInput]
            ],
            successStatus: HTTPStatusCode.OK
        },
        createOrUpdateCredentialForUser: {
            description: "Creates credentials or sets the password for the provided user",
            path: "/createOrUpdateCredentialForUser",
            verb: HTTPVerb.PUT,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromBody, "userId", validateUserId],
                [fromBody, "login", validateEmailInput],
                [fromBody, "plainTextPassword", validatePasswordInput]
            ],
            successStatus: HTTPStatusCode.OK
        },
        getCredentialStatusForUsers: {
            description: "Gets whether there are credentials aleady or not for the passed users",
            path: "/getCredentialStatusForUsers",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromBody, "userIds", validateUserIds],
            ],
            successStatus: HTTPStatusCode.OK
        },
        verifyPassword: {
            description: "Verify the password credential for the given user",
            path: "/verifypassword",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "login", validateStringInput],
                [fromBody, "password", validateStringInput]
            ],
            successStatus: HTTPStatusCode.OK
        },
        hasPassword: {
            description: "Verify whether the user has a password credential set",
            path: "/hasPassword",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "userId", validateUserId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        createOneTimeToken: {
            description: "Create a one time login token",
            path: "/tokens/olp",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "userId", validateUserId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        createUrlToken: {
            description: "Create a url token to be used in visual urls, provided an acl that defines the items / account it can access visuals of",
            path: "/tokens/url",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "tokenAcl", validateTokenAcl]
            ],
            successStatus: HTTPStatusCode.OK
        },
        getUsersTokens: {
            description: "Get tokens for given user ids",
            path: "/getUsersTokens",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "userIds", validateUserIds]
            ],
            successStatus: HTTPStatusCode.OK
        },
        getToken: {
            description: "Get token for given user key",
            path: "/getToken",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "key", validateStringInput]
            ],
            successStatus: HTTPStatusCode.OK
        },
        loginWithToken: {
            description: "Login with a token",
            path: "/tokens/login",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "token", validateStringInput]
            ],
            successStatus: HTTPStatusCode.OK
        },
        resetPassword: {
            description: "Reset the password with a token",
            path: "/resetpassword",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "newPassword", validatePasswordInput],
                [fromBody, "login", validateEmailInput],
                [fromBody, "accountId", validateAccountId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        loginByAuthenticatedUserId: {
            description: "Login by an authenticated userId",
            path: "/login",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "userId", validateStringInput],
                [fromBody, "userAgent", validateStringInput],
            ],
            successStatus: HTTPStatusCode.OK
        },
        loginByADIdentity: {
            description: "Login by SAML SSO",
            path: "/sso/saml/login",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "nameID", validateStringInput],
                [fromBody, "userAgent", validateStringInput],
                [fromBody, "tenantId", validateStringInput]
            ],
            successStatus: HTTPStatusCode.OK
        },
        getGroupId: {
            description: "Get usergroup Id for Active Directory Group ID",
            path: "/sso/saml/mappedgroup/:ADGroupId/:accountId",
            verb: HTTPVerb.GET,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        getAllADGroupMappings: {
            description: "Get all mapped to AD usergroups",
            path: "/sso/saml/mappedgroups/:accountId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "accountId", validateAccountId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        saveADIdentityMapping: {
            description: "Save the link between an AD user nameID and a manual.to user id",
            path: "/sso/saml/mapping",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "nameID", validateStringInput],
                [fromBody, "userId", validateUserId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        getADIdentityMappings: {
            description: "Multiget the links between an AD user nameID and a manual.to user id",
            path: "/sso/saml/mapping/multiget",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "userIds", validateArrayInput("userIds", validateUserId)]
            ],
            successStatus: HTTPStatusCode.OK
        },
        saveADGroupMapping: {
            description: "Save the link between an AD group id and a manual.to group id",
            path: "/sso/saml/groupmapping",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "ADGroupId", (c) => validateNullOr(c, validateStringInput)],
                [fromBody, "groupId", validateUsergroupId],
                [fromBody, "accountId", validateAccountId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        saveCertificate: {
            description: "Save certificate for SAML SSO",
            path: "/sso/saml/savecertificate",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "tenantId", validateStringInput],
                [fromBody, "certificate", validateStringInput],
                [fromBody, "filename", validateStringInput],
                [fromBody, "accountId", validateStringInput]
            ],
            successStatus: HTTPStatusCode.CREATED
        },
        updateCertificateTenantId: {
            description: "Save certificate for SAML SSO",
            path: "/sso/saml/updatecertificate",
            verb: HTTPVerb.PUT,
            validationRules: [
                [fromBody, "accountId", validateStringInput],
                [fromBody, "tenantId", validateStringInput],
            ],
            successStatus: HTTPStatusCode.OK
        },
        updateCertificateAccountId: {
            description: "Update certificate accountId for SAML SSO",
            path: "/sso/saml/updateCertificateAccountId",
            verb: HTTPVerb.PUT,
            validationRules: [
                [fromBody, "tenantId", validateStringInput],
                [fromBody, "certificate", validateStringInput],
                [fromBody, "filename", validateStringInput],
                [fromBody, "accountId", validateStringInput]
            ],
            successStatus: HTTPStatusCode.OK
        },

        getCertificate: {
            description: "Get certificate for SAML SSO",
            path: "/sso/saml/getcertificate/:accountId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "accountId", validateStringInput],
            ],
            successStatus: HTTPStatusCode.OK
        },
        getAllCertificates: {
            description: "Get all saved certificates for SAML SSO",
            path: "/sso/saml/getcertificates",
            verb: HTTPVerb.GET,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        getImpersonatedSession: {
            description: "Get an impersonated session for given user id",
            path: "/impersonate",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "userId", validateUserId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        createUserAccessToken: {
            description: "Creates an access token",
            path: "/authtokens/useraccess",
            verb: HTTPVerb.POST,
            validationRules: [],
            successStatus: HTTPStatusCode.CREATED
        },
        endSessionsForUser: {
            description: "Find matching sessions",
            path: "/sessions/find",
            verb: HTTPVerb.POST,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        updatePasswordByAdmin: {
            description: "Endpoint used by admins to update a user's password",
            path: "/updatePasswordByAdmin",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "userId", validateUserId],
                [fromBody, "newPassword", validatePasswordInput],
                [fromBody, "accountId", validateAccountId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        extendSession: {
            description: "Extend a session (used in the auto-logout feature)",
            path: "/extendSession",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        hasSessionExpired: {
            description: "Check if session is still active (used in the auto-logout feature)",
            path: "/hasSessionExpired",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        deleteADIdentityMappingForUsers: {
            description: "Delete AD Identity mapping for given user ids",
            path: "/deleteADIdentityMappingForUsers",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromBody, "userIds", validateUserIds]
            ],
            successStatus: HTTPStatusCode.OK
        }
    };
}


