import * as HTTPStatusCode from "http-status-codes";
import { AppRoute, HTTPVerb } from "../../routes";
import {
    fromBody,
    fromParams,
    validateAccountId,
    validateAccountIds,
    validateAclId,
    validateAclRestrictionSet,
    validateArrayInput,
    validateItemId,
    validateRoleId,
    validateStringArrayInput,
    validateStringInput,
    validateUserId,
    validateUserIds,
    validateUsergroupId
} from "../../validation";
import {
    validateAssigneeType,
    validateGroupIdsOrUserIds,
    validatePermissionName,
    validatePermissionNames,
    validateResourceGroup,
    validateResourceGroups,
    validateResourceType
} from "./validation";
import { AuthorizationServiceContract } from "./contract";

export function getRoutes (): { [name in keyof AuthorizationServiceContract]: AppRoute; } {
    return {
        addAccountAdmin: {
            description: "Add the give user as account admin to the account",
            path: "/roles/:accountId/admins",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromBody, "userId", validateUserId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        addAccountAdminUserGroup: {
            description: "Add the given usergroup as account admin to the account",
            path: "/roles/:accountId/groupadmins",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromBody, "groupId", validateUsergroupId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        addAclAssignee: {
            description: "Add a new assignee to the ACL",
            path: "/acls/:accountId/:aclId/assignees",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromParams, "aclId", validateAclId],
                [fromBody, "assigneeType", validateAssigneeType],
                [fromBody, "assigneeId", validateStringInput]
            ],
            successStatus: HTTPStatusCode.OK
        },
        updateAclAssignee: {
            description: "Add a new assignee to the ACL",
            path: "/acls/:accountId/:oldAclId/:aclId/assignees",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromParams, "oldAclId", validateAclId],
                [fromParams, "aclId", validateAclId],
                [fromBody, "assigneeType", validateAssigneeType],
                [fromBody, "assigneeId", validateStringInput]
            ],
            successStatus: HTTPStatusCode.OK
        },
        duplicateResourceAcls: {
            description: "Duplicate the ACLs of the given itemIds, given a [fromItem, toItem] itemId pair array",
            path: "/acls/duplicateResourceAcls",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "fromToIdPairs", validateArrayInput("fromToIdPairs", validateArrayInput("fromToIdPairs", validateStringInput))],
                [fromBody, "accountId", validateAccountId],
                [fromBody, "resourceType", validateResourceType],
            ],
            successStatus: HTTPStatusCode.OK
        },
        allResourceIdsForAccounts: {
            description: "Fetch all resource Ids which have at least 1 Acl for the given account (used in permanent caching)",
            path: "/accounts/resourceIds",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountIds", validateAccountIds]
            ],
            successStatus: HTTPStatusCode.OK
        },
        addUserToAccount: {
            description: "Setups up the default roles for a user in an account",
            path: "/roles/:accountId/default",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromBody, "userId", validateUserId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        authorize: {
            description: "Authorizes the user to a given path",
            path: "/authorize",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "userId", validateUserId],
                [fromBody, "accountIds", validateAccountIds]
            ],
            successStatus: HTTPStatusCode.OK
        },
        accountAcls: {
            description: "Find all acls for a given account id",
            path: "/acls/:accountId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "accountId", validateAccountId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        userDocumentsAcls: {
            description: "Find all document acls for a given user id and account id",
            path: "/acls-list/:accountId/",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "userAndGroupIds", validateGroupIdsOrUserIds],
                [fromParams, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        resourceAcls: {
            description: "Find all acls directly assigned to the give resource group",
            path: "/permissions/resourcegroups/_search",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "resourceGroup", validateResourceGroup]
            ],
            successStatus: HTTPStatusCode.OK
        },
        allResourceAcls: {
            description: "Fetch all Acls for the given resources",
            path: "/permissions/resourcegroups/_searchall",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "resourceGroups", validateResourceGroups]
            ],
            successStatus: HTTPStatusCode.OK
        },
        loadAcl: {
            description: "Find an acl with given id",
            path: "/acls/:accountId/load/:aclId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "aclId", validateAclId],
                [fromParams, "accountId", validateAccountId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        createAcl: {
            description: "Creates an ACL rule",
            path: "/acls/create",
            verb: HTTPVerb.POST,
            validationRules: [
                // [fromBody, "accountId", validateAccountId],
                // [fromBody, "userIds", validateUserIds]
            ],
            successStatus: HTTPStatusCode.OK
        },
        updateAcl: {
            description: "Updates a current ACL",
            path: "/acls/:accountId/update/:aclId",
            verb: HTTPVerb.PUT,
            validationRules: [
                [fromParams, "aclId", validateAclId],
                [fromParams, "accountId", validateAccountId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        createDefaultAccountRoles: {
            description: "Create the default roles for an account",
            path: "/roles/:accountId",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromBody, "collectionId", validateStringInput]
            ],
            successStatus: HTTPStatusCode.OK
        },
        deleteAcl: {
            description: "Deletes an ACL",
            path: "/acls/:accountId/delete/:aclId",
            verb: HTTPVerb.DELETE,
            validationRules: [
                [fromParams, "aclId", validateAclId],
                [fromParams, "accountId", validateAccountId]
            ],
            successStatus: HTTPStatusCode.NO_CONTENT
        },
        findMyResourceGroups: {
            description: "Find the resource groups I have access to",
            path: "/resourcegroups/mine/_search",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountIds", validateArrayInput("accountIds", validateAccountId)],
                [fromBody, "resourceType", validateResourceType],
                [fromBody, "permissions", validateArrayInput("permissions", validatePermissionName)]
            ],
            successStatus: HTTPStatusCode.OK
        },
        findAllowedResourceGroups: {
            description: "Find the resource group user has permissions on",
            path: "/resourcegroups/_search",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "userId", validateUserId],
                [fromBody, "resourceType", validateResourceType],
                [fromBody, "permission", validatePermissionName],
                [fromBody, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        findResourcePermissions: {
            description: "Find all permissions user has on a give resource",
            path: "/permissions/_search",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "userId", validateUserId],
                [fromBody, "resourceType", validateResourceType],
                [fromBody, "resourceId", validateStringInput]
            ],
            successStatus: HTTPStatusCode.OK
        },
        findResourcePermissionsWithRestrictions: {
            description: "Find all permissions user has on a give resource",
            path: "/permissionsWithRestriction/_search",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "userId", validateUserId],
                [fromBody, "resourceType", validateResourceType],
                [fromBody, "resourceId", validateStringInput],
                [fromBody, "accountId", validateAccountId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        findPublicResourceGroups: {
            description: "Find all public resource groups matching the permissions",
            path: "/resourcegroups/public/_search",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "resourceType", validateResourceType],
                [fromBody, "permissions", validateArrayInput("permissions", validatePermissionName)]
            ],
            successStatus: HTTPStatusCode.OK
        },
        findPublicPermissions: {
            description: "Find all public permissions on given resource",
            path: "/permissions/public/_search",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "resourceType", validateResourceType],
                [fromBody, "resourceId", validateStringInput],
                [fromBody, "accountId", validateAccountId],

            ],
            successStatus: HTTPStatusCode.OK
        },
        getAccountAdmins: {
            description: "Get the userids of the account admins",
            path: "/roles/:accountId/admins",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "accountId", validateAccountId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        removeAccountAdmin: {
            description: "Remove the given user from the admins in the account",
            path: "/roles/:accountId/admins/:userId",
            verb: HTTPVerb.DELETE,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromBody, "userId", validateUserId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        removeAclAssignee: {
            description: "Remove an assignee from the ACL",
            path: "/acls/:accountId/:aclId/assignees",
            verb: HTTPVerb.DELETE,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromParams, "aclId", validateAclId],
                [fromBody, "assigneeType", validateAssigneeType],
                [fromBody, "assigneeId", validateStringInput]
            ],
            successStatus: HTTPStatusCode.OK
        },
        removeUserFromAccount: {
            description: "Removes the user from all the account acls",
            path: "/acls/:accountId/_all/:userId",
            verb: HTTPVerb.DELETE,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromParams, "userId", validateUserId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        removeUsergroupFromAccount: {
            description: "Removes all group acls",
            path: "/acls/:accountId/_groups/:groupId",
            verb: HTTPVerb.DELETE,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromParams, "groupId", validateUsergroupId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        addDocumentAcl: {
            description: "Create a new acl for the given document",
            path: "/documents/addDocAcl/:accountId/:documentId", // @TODO after "BD Publishing permission / ISS summer project" release is live: addDocAcl can be removed from path
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromParams, "documentId", validateStringInput],
                [fromBody, "roleId", validateRoleId],
                [fromBody, "aclRestrictionSet", validateAclRestrictionSet, "optional"]
            ],
            successStatus: HTTPStatusCode.CREATED
        },
        grantPublicReadAccess: {
            description: "Grant public read access to a document",
            path: "/documents/:accountId/:documentId/public-read",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromParams, "documentId", validateStringInput]
            ],
            successStatus: HTTPStatusCode.OK
        },
        revokePublicReadAccess: {
            description: "Revoke public read access to a document",
            path: "/documents/:accountId/:documentId/public-read",
            verb: HTTPVerb.DELETE,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromParams, "documentId", validateStringInput]
            ],
            successStatus: HTTPStatusCode.OK
        },
        hasAvailableEditorAccount: {
            description: "Verifies if a user can be logged in to the editor",
            path: "/accounts/editors/:userId",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "userId", validateUserId],
                [fromBody, "accountIds", validateAccountIds]
            ],
            successStatus: HTTPStatusCode.OK
        },
        canAccessBackend: {
            description: "Check if the user can access backend apps",
            path: "/backend/allowed",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "userId", validateUserId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        getAccountsForEditor: {
            description: "Retrieve the list of accountids a user can use in the editor",
            path: "/accounts/editors/:userId/ids",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "userId", validateUserId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        removeResourceFromAcls: {
            description: "Remove a given resource id from all acls it's included in",
            path: "/acls/resource/:resourceId",
            verb: HTTPVerb.DELETE,
            validationRules: [
                [fromParams, "resourceId", validateStringInput]
            ],
            successStatus: HTTPStatusCode.OK
        },
        saveRole: {
            description: "Creates a new role with permissions",
            path: "/roles/save",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "permissions", validatePermissionNames]
            ],
            successStatus: HTTPStatusCode.OK
        },
        allRolesForAccount: {
            description: "Gets all roles for account + builtIn roles",
            path: "/roles/getAllForAccount/:accountId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "accountId", validateAccountId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        getAdminGroup: {
            description: "Gets admin group for given account",
            path: "/roles/getAdminGroup/:accountId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "accountId", validateAccountId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        handleCacheOnGroupMemberRemoval: {
            description: "Invalidates cache for group members if needed",
            path: "/cache/remove-group/:groupId/account/:accountId",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromParams, "groupId", validateUsergroupId],
                [fromBody, "membersIds", validateUserIds],
            ],
            successStatus: HTTPStatusCode.OK
        },
        findMultipleResourcesPermissions: {
            description: "Find all permissions user has on a give resource",
            path: "/permissions/resources/_search",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "resourceType", validateResourceType],
                [fromBody, "resourceIds", c => validateStringArrayInput(c,"binderId")]
            ],
            successStatus: HTTPStatusCode.OK
        },
        deleteAllForAccount: {
            description: "Delete everything related to the given accountId",
            path: "/accounts/:accountId/delete",
            verb: HTTPVerb.DELETE,
            validationRules: [
                [fromParams, "accountId", validateAccountId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        containsPublicAcl: {
            description: "Returns whether the given itemId is publicly acessible",
            path: "/containsPublicAcl",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromBody, "itemIds", validateArrayInput("itemIds", validateItemId)],
            ],
            successStatus: HTTPStatusCode.OK
        }
    };
}


