import * as HTTPStatusCode from "http-status-codes";
import { AppRoute, HTTPVerb } from "../../routes";
import {
    fromBody,
    fromParams,
    fromQuery,
    validateAccountId,
    validateArrayInput,
    validateBoolean,
    validateDomain,
    validateEmailInput,
    validateGroupAndUserIds,
    validateISODate,
    validateMultiAddMembersOptions,
    validateNonManualToLoginInput,
    validatePasswordInput,
    validatePositiveInt,
    validateStringArrayInput,
    validateStringInput,
    validateUserGroupsQuery,
    validateUserId,
    validateUserIds,
    validateUserOrUsergroupId,
} from "../../validation";
import {
    validateSearchOptions,
    validateUserPreferences,
    validateUserQuery,
    validateUserTag,
    validateUserTagsFilter,
    validateUserType,
    validateUsergroupId,
    validateUsersSearchByQueryOptions,
} from "./validation";
import { UserServiceContract } from "./contract";

const userValidationRules = (userObjectCandidate: Record<string, string>) => {
    const { id, displayName, login } = userObjectCandidate;
    return [
        ...validateUserId(id),
        ...validateStringInput(displayName),
        ...validateEmailInput(login),
    ];
};

export default function getRoutes(): { [name in keyof UserServiceContract]: AppRoute } {
    return {
        updateLastOnline: {
            description: "Updates the last online date for the currenly logged user",
            path: "/users/last-online/:userId",
            verb: HTTPVerb.POST,
            validationRules: [[fromParams, "userId", validateUserId]],
            successStatus: HTTPStatusCode.OK
        },
        listUsers: {
            description: "List the available users",
            path: "/",
            verb: HTTPVerb.GET,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        listUserAccess: {
            description: "List the resources and permissions a given user has on a given account",
            path: "/access/:accountId/:userId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromParams, "userId", validateUserId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        getUserByLogin: {
            description: "Get a user by their login",
            path: "/byLogin",
            verb: HTTPVerb.POST,
            validationRules: [[fromBody, "login", validateEmailInput]],
            successStatus: HTTPStatusCode.OK
        },
        confirmUser: {
            description: "Confirm a user by its login",
            path: "/confirm",
            verb: HTTPVerb.POST,
            validationRules: [[fromBody, "login", validateEmailInput]],
            successStatus: HTTPStatusCode.OK
        },
        createUser: {
            description: "Create a new user",
            path: "/",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "login", validateEmailInput],
                [fromBody, "displayName", validateStringInput],
                [fromBody, "allowDuplicate", validateBoolean],
                [fromBody, "type", validateUserType],
                [fromBody, "licenseCount", (c) => {
                    const candidate = parseInt(c);
                    return validatePositiveInt(candidate);
                }],
            ],
            successStatus: HTTPStatusCode.CREATED
        },
        createDeviceTargetUsers: {
            description: "Create users as targets of a device user",
            path: "/deviceUserTargets",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "names", validateArrayInput("names", validateStringInput)],
                [fromBody, "accountId", validateAccountId],
                [fromBody, "deviceUserEmail", validateStringInput],
            ],
            successStatus: HTTPStatusCode.CREATED
        },
        assignDeviceTargetUsers: {
            description: "Assign users/groups as targets of a device user",
            path: "/deviceUserTargets/assign",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromBody, "deviceUserId", validateUserId],
                [fromBody, "usergroupIntersections", validateArrayInput("usergroupIntersections", validateStringArrayInput)],
                [fromBody, "userAndGroupIds", validateArrayInput("userAndGroupIds", validateUserOrUsergroupId)],
            ],
            successStatus: HTTPStatusCode.OK
        },
        getDeviceTargetUserLinks: {
            description: "Get all device users for an account",
            path: "/deviceTargetUserLinks/:accountId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK,
        },
        getDeviceTargetIds: {
            description: "Get all linked userIds for a device user",
            path: "/getDeviceTargetIds/:accountId/:deviceUserId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromParams, "deviceUserId", validateUserId],
            ],
            successStatus: HTTPStatusCode.OK,
        },
        importUsers: {
            description: "Creates the specified users",
            path: "/users",
            verb: HTTPVerb.POST,
            validationRules: [],
            successStatus: HTTPStatusCode.CREATED
        },
        importCevaUsers: {
            description: "Creates the specified users from CEVA data file",
            path: "/importCevaUsers",
            verb: HTTPVerb.POST,
            validationRules: [],
            successStatus: HTTPStatusCode.CREATED
        },
        getPreferences: {
            description: "Retrieve the preferences of the provided user id",
            path: "/users/:userId/preferences",
            verb: HTTPVerb.GET,
            validationRules: [[fromParams, "userId", validateUserId]],
            successStatus: HTTPStatusCode.OK
        },
        getPreferencesMulti: {
            description: "Retrieve the preferences of the provided user ids",
            path: "/getPreferencesMulti",
            verb: HTTPVerb.POST,
            validationRules: [[fromBody, "userIds", validateArrayInput("userIds", validateUserId)]],
            successStatus: HTTPStatusCode.OK
        },
        getGroupsForUser: {
            description: "Get the groups of the provided user within a provided account",
            path: "/groups/:accountId/forUser/:userId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "userId", validateUserId],
                [fromParams, "accountId", validateAccountId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        getGroupsForUserBackend: {
            description: "Get the groups of the provided user across accounts",
            path: "/users/:userId/groups",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "userId", validateUserId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        getGroupsForUsers: {
            description: "Get the usergroups of the provided userIds",
            path: "/users/multi/groups",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "userIds", validateArrayInput("userIds", validateUserId)],
                [fromBody, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        getUser: {
            description: "Retrieve a user by id",
            path: "/users/:userId",
            verb: HTTPVerb.GET,
            validationRules: [[fromParams, "userId", validateUserId]],
            successStatus: HTTPStatusCode.OK
        },
        getUsers: {
            description: "Retrieve users by ids",
            path: "/get-users",
            verb: HTTPVerb.POST,
            validationRules: [[fromBody, "ids", validateGroupAndUserIds]],
            successStatus: HTTPStatusCode.OK
        },
        myDetails: {
            description: "Get extended details of currently logged in user",
            path: "/details",
            verb: HTTPVerb.GET,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        savePreferences: {
            description: "Update the preferences for the given user",
            path: "/users/:userId/preferences",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "userId", validateUserId],
                [fromBody, "preferences", validateUserPreferences]
            ],
            successStatus: HTTPStatusCode.OK
        },
        updateUser: {
            description: "Update user details",
            path: "/users/:userId",
            verb: HTTPVerb.PUT,
            validationRules: [
                [fromParams, "userId", validateUserId],
                [fromBody, "user", userValidationRules],
            ],
            successStatus: HTTPStatusCode.OK
        },
        whoAmI: {
            description: "Get info on the currently logged in user",
            path: "/me",
            verb: HTTPVerb.GET,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        findUserDetailsForIds: {
            description: "Link user details to user ids",
            path: "/users/link",
            verb: HTTPVerb.POST,
            validationRules: [[fromBody, "userIds", validateUserIds]],
            successStatus: HTTPStatusCode.OK
        },
        createGroup: {
            description: "Create a new user group",
            path: "/groups/:accountId",
            verb: HTTPVerb.POST,
            validationRules: [[fromParams, "accountId", validateAccountId], [fromBody, "name", validateStringInput]],
            successStatus: HTTPStatusCode.OK
        },
        getGroupMembers: {
            description: "Retrieve the members of a group",
            path: "/groups/:accountId/:groupId/members/_search",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromParams, "groupId", validateUsergroupId],
                [fromBody, "options", validateSearchOptions]
            ],
            successStatus: HTTPStatusCode.OK
        },
        multiGetGroupMembers: {
            description: "Retrieve the members of multiple groups",
            path: "/groups/:accountId/memberids/_search/all",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromBody, "groupIds", validateArrayInput("groupIds", validateUsergroupId)]
            ],
            successStatus: HTTPStatusCode.OK
        },
        multiGetGroupMemberIds: {
            description: "Retrieve the members of multiple groups",
            path: "/groups/:accountId/memberids/_search",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromBody, "groupIds", validateArrayInput("groupIds", validateUsergroupId)]
            ],
            successStatus: HTTPStatusCode.OK
        },
        addGroupMember: {
            description: "Add a member to a group",
            path: "/groups/:accountId/:groupId/members",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromParams, "groupId", validateUsergroupId],
                [fromBody, "userId", validateUserId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        multiAddGroupMembers: {
            description: "Add one or more members to one or more groups",
            path: "/groups/:accountId/multiAddMembers",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromBody, "userGroupsQuery", validateUserGroupsQuery],
                [fromBody, "userIds", validateArrayInput("userIds", validateUserId)],
                [fromBody, "options", validateMultiAddMembersOptions],
            ],
            successStatus: HTTPStatusCode.OK
        },
        removeGroupMember: {
            description: "Remove a member from a group",
            path: "/groups/:accountId/:groupId/members",
            verb: HTTPVerb.DELETE,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromParams, "groupId", validateUsergroupId],
                [fromBody, "userId", validateUserId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        searchUsers: {
            description: "Search for users with given criteria, restricts search to user's accessible accounts",
            path: "/users/search",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "query", validateUserQuery],
                [fromBody, "options", validateSearchOptions]
            ],
            successStatus: HTTPStatusCode.OK
        },
        searchUsersBackend: {
            description: "Search for users with given criteria (backend)",
            path: "/users/search/backend",
            verb: HTTPVerb.POST,
            validationRules: [[fromBody, "query", validateUserQuery], [fromBody, "options", validateSearchOptions]],
            successStatus: HTTPStatusCode.OK
        },
        searchUsergroups: {
            description: "Search for usergroups with given criteria",
            path: "/searchUsergroups",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "query", validateUserQuery],
                [fromBody, "options", validateSearchOptions]
            ],
            successStatus: HTTPStatusCode.OK
        },
        searchUsersByTerm: {
            description: "Search both users and user groups",
            path: "/searchUsersByTerm/:accountId",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromBody, "query", validateStringInput],
                [fromBody, "options", validateUsersSearchByQueryOptions],
            ],
            successStatus: HTTPStatusCode.OK
        },
        searchGroups: {
            description: "Search user groups",
            path: "/searchGroups/:accountId",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromBody, "query", validateStringInput],
                [fromBody, "options", validateSearchOptions],
            ],
            successStatus: HTTPStatusCode.OK
        },
        updateGroupName: {
            description: "Update the name of the given usergroup",
            path: "/groups/:accountId/:groupId",
            verb: HTTPVerb.PUT,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromParams, "groupId", validateUsergroupId],
                [fromBody, "name", validateStringInput]
            ],
            successStatus: HTTPStatusCode.OK
        },
        getGroups: {
            description: "Retrieve all usergroups for an account",
            path: "/groups/:accountId",
            verb: HTTPVerb.GET,
            validationRules: [[fromParams, "accountId", validateAccountId]],
            successStatus: HTTPStatusCode.OK
        },
        removeGroup: {
            description: "Remove a group for an account",
            path: "/groups/:accountId/:groupId",
            verb: HTTPVerb.DELETE,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromParams, "groupId", validateUsergroupId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        updateGroupOwners: {
            description: "Set the owners of a usergroup",
            path: "/updateGroupOwners/:accountId/:groupId",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromParams, "groupId", validateUsergroupId],
                [fromBody, "ownerUserIds", validateArrayInput("ownerUserIds", validateUserId)],
            ],
            successStatus: HTTPStatusCode.OK
        },
        getManageableGroups: {
            description: "Get the groups that can be managed by the provided actor",
            path: "/getManageableGroups/:accountId",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        canBeManagedBy: {
            description: "Decides whether all users can be managed by an another for a specific account",
            path: "/canBeManagedBy",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "managedUserAccountId", validateAccountId],
                [fromBody, "managedUserIds", validateUserIds],
                [fromBody, "groupOwnerId", validateUserId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        removeUserFromAccountUsergroups: {
            description: "Remove a user from all usergroups in an account",
            path: "/users/groups/:accountId/delete",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromBody, "userId", validateUserId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        inviteUser: {
            description: "Invite a new user",
            path: "/invite",
            verb: HTTPVerb.POST,
            validationRules: [[fromBody, "login", validateEmailInput], [fromBody, "accountId", validateAccountId]],
            successStatus: HTTPStatusCode.OK
        },
        getBouncedEmails: {
            description: "Get bounced emails",
            path: "/bounced",
            verb: HTTPVerb.POST,
            validationRules: [[fromBody, "lastDate", validateISODate]],
            successStatus: HTTPStatusCode.OK
        },
        checkIfEmailBounced: {
            description: "Get bounced email info",
            path: "/bounced/check",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "address", validateEmailInput],
                [fromBody, "accountId", validateAccountId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        sendPasswordResetLinkTo: {
            description: "send password reset link to users with provided logins",
            path: "/send-pw-link",
            verb: HTTPVerb.POST,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        sendPasswordResetLink: {
            description: "send password reset link to users with provided logins",
            path: "/send-pw-linkv2",
            verb: HTTPVerb.POST,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        sendMePasswordResetLink: {
            description: "send password reset link to me",
            path: "/reset-my-password",
            verb: HTTPVerb.POST,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        listUserImportActions: {
            description: "Retrieve the last user import actions",
            path: "/userimportactions/:accountId",
            verb: HTTPVerb.GET,
            validationRules: [[fromParams, "accountId", validateAccountId]],
            successStatus: HTTPStatusCode.OK
        },
        listWhitelistedEmails: {
            description: "List all whitelisted emails for an account, filterable",
            path: "/whitelistedemails/:accountId/:filter",
            verb: HTTPVerb.GET,
            validationRules: [[fromParams, "accountId", validateAccountId]],
            successStatus: HTTPStatusCode.OK
        },
        insertWhitelistedEmail: {
            description: "Insert a new user import action",
            path: "/whitelistedemails/:accountId",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromBody, "domain", validateDomain]
            ],
            successStatus: HTTPStatusCode.OK
        },
        insertScriptRunStat: {
            description: "Insert a new script run statistics",
            path: "/scriptrunstat",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "scriptName", validateStringInput],
            ],
            successStatus: HTTPStatusCode.OK
        },
        getLatestScriptStats: {
            description: "Get latest run for given script",
            path: "/scriptrunstat/latest/:scriptName",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "scriptName", validateStringInput],
            ],
            successStatus: HTTPStatusCode.OK
        },
        setWhitelistedEmailActive: {
            description: "Active or inactivate a whitelisted email pattern",
            path: "/whitelistedemails/:id/setactive",
            verb: HTTPVerb.POST,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        requestInvitation: {
            description: "Request a membership invitation (granted if email is on whitelist)",
            path: "/requestinvitation",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromBody, "domain", validateDomain],
                [fromBody, "email", validateEmailInput]
            ],
            successStatus: HTTPStatusCode.OK
        },
        saveTermsAcceptance: {
            description: "Persists that a user with given userId has accepted the latest terms",
            path: "/termsAcceptance",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "userId", validateUserId],
                [fromBody, "accountId", validateAccountId],
                [fromBody, "version", validateStringInput],
            ],
            successStatus: HTTPStatusCode.OK
        },
        getTermsInfo: {
            description: "Get the termsInfo for a given accountId",
            path: "/termsInfo/:accountId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        deleteUser: {
            description: "Delete a user",
            path: "/users/:userId",
            verb: HTTPVerb.DELETE,
            validationRules: [
                [fromParams, "userId", validateUserId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        multiGetUsersAndGroups: {
            description: "Multiget users and groups based on ids",
            path: "/users_usergroups/multiget",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromBody, "ids", validateArrayInput("ids", validateUserOrUsergroupId)],
            ],
            successStatus: HTTPStatusCode.OK
        },
        insertUserTag: {
            description: "Insert a user tag",
            path: "/userTags",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "userTag", validateUserTag],
            ],
            successStatus: HTTPStatusCode.OK
        },
        getUserTags: {
            description: "Fetch user tags for a user",
            path: "/userTags/:userId",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "userId", validateUserId],
                [fromBody, "filter", validateUserTagsFilter]
            ],
            successStatus: HTTPStatusCode.OK
        },
        getUsersCreatedPerMonth: {
            description: "Get a global overview over time of the users created",
            path: "/users/global/monthly",
            verb: HTTPVerb.GET,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        getAccountIdsForGroups: {
            description: "Get a record of all account ids given groups belong to",
            path: "/getAccountIdsForGroups",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "groupIds", validateArrayInput("groupIds", validateUsergroupId)],
            ],
            successStatus: HTTPStatusCode.OK
        },
        createUserWithCredentials: {
            description: "Creates a user with given info, including credentials, in given account",
            path: "/createUserWithCredentials",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "login", validateNonManualToLoginInput],
                [fromBody, "displayName", validateStringInput],
                [fromBody, "clearTextPassword", validatePasswordInput],
                [fromQuery, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK,
        },
        createHubspotIdentifyToken: {
            description: "Creates a Hubspot identify token for the chat widget",
            path: "/createHubspotIdentifyToken",
            verb: HTTPVerb.GET,
            validationRules: [],
            successStatus: HTTPStatusCode.OK,
        },
        getMockedEmails: {
            description: "Retrieve the emails sent to a certain address by the mocked mailer",
            path: "/getMockedEmails/:targetEmail",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "targetEmail", validateEmailInput],
            ],
            successStatus: HTTPStatusCode.OK
        },
        syncEntraGroupMembers: {
            description: "Syncs users of provided account with the Entra id members of its designated sync group (userGroupIdForUserManagement)",
            path: "/syncEntraGroupMembers",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        }
    }
}

