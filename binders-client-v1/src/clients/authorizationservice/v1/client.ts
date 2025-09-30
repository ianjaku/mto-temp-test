import {
    AccountsWithPermissions,
    Acl,
    AssigneeGroup,
    AssigneeType,
    AuthorizationServiceContract,
    IAclRestrictionSet,
    IResourceGroupsFilter,
    PermissionMap,
    PermissionName,
    ResourceGroup,
    ResourceIdPermissionsName,
    ResourcePermission,
    ResourceType,
    Role
} from "./contract";
import { BindersServiceClient, RequestHandler } from "../../client";
import { BindersServiceClientConfig } from "../../config";
import { Config } from "../../../config";
import { getRoutes } from "./routes";

export class AuthorizationServiceClient extends BindersServiceClient implements AuthorizationServiceContract {
    grantPublicReadAccess(accountId: string, documentId: string): Promise<Acl> {
        const options = { pathParams: { accountId, documentId } };
        return this.handleRequest("grantPublicReadAccess", options);
    }

    revokePublicReadAccess(accountId: string, documentId: string): Promise<Acl> {
        const options = { pathParams: { accountId, documentId } };
        return this.handleRequest("revokePublicReadAccess", options);
    }

    accountAcls(accountId: string): Promise<Acl[]> {
        const options = { pathParams: { accountId } };
        return this.handleRequest<Acl[]>("accountAcls", options);
    }

    userDocumentsAcls(userAndGroupIds: string[], accountId: string): Promise<Acl[]> {
        const options = { pathParams: { accountId }, body: { userAndGroupIds } };
        return this.handleRequest<Acl[]>("userDocumentsAcls", options);
    }

    resourceAcls(resourceGroup: ResourceGroup, accountId?: string): Promise<{ [key: string]: Acl[] }> {
        const options = { body: { resourceGroup, accountId } };
        return this.handleRequest("resourceAcls", options);
    }

    allResourceAcls(
        resourceGroups: ResourceGroup[],
        accountId: string
    ): Promise<Acl[]> {
        const options = { body: { resourceGroups, accountId } };
        return this.handleRequest("allResourceAcls", options);
    }

    addAccountAdmin(accountId: string, userId: string): Promise<string[]> {
        const options = { pathParams: { accountId }, body: { userId } };
        return this.handleRequest("addAccountAdmin", options);
    }


    getAdminGroup(accountId: string): Promise<string> {
        const options = { pathParams: { accountId } };
        return this.handleRequest("getAdminGroup", options);
    }


    addAccountAdminUserGroup(accountId: string, groupId: string): Promise<string[]> {
        const options = { pathParams: { accountId }, body: { groupId } };
        return this.handleRequest("addAccountAdminUserGroup", options);
    }

    addAclAssignee(aclId: string, accountId: string, assigneeType: AssigneeType, assigneeId: string): Promise<Acl> {
        const options = { pathParams: { accountId, aclId }, body: { assigneeType, assigneeId } };
        return this.handleRequest("addAclAssignee", options);
    }

    updateAclAssignee(oldAclId: string, aclId: string, accountId: string, assigneeType: AssigneeType, assigneeId: string): Promise<Acl> {
        const options = {
            pathParams: { accountId, oldAclId, aclId },
            body: { assigneeType, assigneeId },
        };
        return this.handleRequest("updateAclAssignee", options);
    }

    duplicateResourceAcls(fromToIdPairs: string[][], resourceType: ResourceType, accountId: string): Promise<void> {
        const options = {
            body: { fromToIdPairs, resourceType, accountId },
        };
        return this.handleRequest("duplicateResourceAcls", options);
    }

    addUserToAccount(
        accountId: string,
        userId: string,
        fromUserId?: string,
        fromUserIp?: string | string[],
        fromUserAgent?: string
    ): Promise<void> {
        const options = { pathParams: { accountId }, body: { fromUserAgent, fromUserId, fromUserIp, userId } };
        return this.handleRequest<void>("addUserToAccount", options);
    }

    // eslint-disable-next-line @typescript-eslint/ban-types
    authorize(userId: string, accountIds: Array<string>, requiredPermission: ResourcePermission): Promise<Object> {
        const options = { body: { userId, accountIds, requiredPermission } };
        return this.handleRequest("authorize", options);
    }

    constructor(endpointPrefix: string, requestHandler: RequestHandler, accountIdProvider?: () => string) {
        super(endpointPrefix, getRoutes(), requestHandler, accountIdProvider);
    }

    createDefaultAccountRoles(accountId: string, collectionId: string): Promise<Acl[]> {
        const options = { pathParams: { accountId }, body: { collectionId } };
        return this.handleRequest("createDefaultAccountRoles", options);
    }

    findAllowedResourceGroups(userId: string, resourceType: ResourceType, permission: PermissionName, skipPublic: boolean, accountId: string): Promise<ResourceGroup[]> {
        const options = { body: { userId, resourceType, permission, accountId, skipPublic } };
        return this.handleRequest("findAllowedResourceGroups", options);
    }

    findMyResourceGroups(accountIds: string[], resourceType: ResourceType, permissions: PermissionName[], filter?: IResourceGroupsFilter): Promise<PermissionMap[]> {
        const options = { body: { accountIds, resourceType, permissions, filter } };
        return this.handleRequest("findMyResourceGroups", options);
    }

    findResourcePermissions(
        userId: string,
        resourceType: ResourceType,
        resourceId: string,
        accountId?: string
    ): Promise<PermissionName[]> {
        const options = {
            body: {
                userId,
                resourceType,
                resourceId,
                accountId: resourceType === ResourceType.ACCOUNT ? resourceId : accountId
            }
        };
        return this.handleRequest("findResourcePermissions", options);
    }

    findResourcePermissionsWithRestrictions(
        userId: string,
        resourceType: ResourceType,
        resourceId: string,
        accountId?: string
    ): Promise<Acl[]> {
        const options = {
            body: {
                userId,
                resourceType,
                resourceId,
                accountId: resourceType === ResourceType.ACCOUNT ? resourceId : accountId
            }
        };
        return this.handleRequest("findResourcePermissionsWithRestrictions", options);
    }

    findMultipleResourcesPermissions(userId: string, resourceType: ResourceType, resourceIds: string[], accountId?: string): Promise<ResourceIdPermissionsName> {
        const options = { body: { userId, resourceType, resourceIds, accountId } };
        return this.handleRequest("findMultipleResourcesPermissions", options);
    }

    findPublicResourceGroups(resourceType: ResourceType, permissions: PermissionName[], accountIds?: string[]): Promise<PermissionMap[]> {
        const options = { body: { resourceType, permissions, accountIds } };
        return this.handleRequest("findPublicResourceGroups", options);
    }
    findPublicPermissions(resourceType: ResourceType, resourceId: string, accountId: string): Promise<PermissionName[]> {
        const options = { body: { resourceType, resourceId, accountId } };
        return this.handleRequest("findPublicPermissions", options);
    }

    getAccountAdmins(accountId: string): Promise<string[]> {
        const options = { pathParams: { accountId } };
        return this.handleRequest("getAccountAdmins", options);
    }

    static fromConfig(
        config: Config,
        version: string,
        requestHandler: RequestHandler,
        accountIdProvider?: () => string,
    ): AuthorizationServiceClient {
        const versionedPath = BindersServiceClientConfig.getVersionedPath(config, "authorization", version);
        return new AuthorizationServiceClient(versionedPath, requestHandler, accountIdProvider);
    }

    // list the requests
    loadAcl(aclId: string, accountId: string): Promise<Acl> {
        const options = { pathParams: { aclId, accountId } };
        return this.handleRequest("loadAcl", options);
    }

    createAcl(name: string, description: string, accountId: string, assignees: AssigneeGroup[], rules: Array<ResourcePermission>, roleId: string): Promise<Acl> {
        const options = { body: { name, description, accountId, assignees, rules, roleId } };
        return this.handleRequest("createAcl", options);
    }

    updateAcl(toUpdate: Acl): Promise<Acl> {
        const options = { body: toUpdate, pathParams: { accountId: toUpdate.accountId, aclId: toUpdate.id } };
        return this.handleRequest("updateAcl", options);
    }

    deleteAcl(aclId: string, accountId: string): Promise<void> {
        const options = { pathParams: { accountId, aclId } };
        return this.handleRequest<void>("deleteAcl", options);
    }

    removeAccountAdmin(accountId: string, userId: string): Promise<string[]> {
        const options = { pathParams: { accountId }, body: { userId } };
        return this.handleRequest("removeAccountAdmin", options);
    }

    removeAclAssignee(aclId: string, accountId: string, assigneeType: AssigneeType, assigneeId: string): Promise<Acl> {
        const options = { pathParams: { accountId, aclId }, body: { assigneeType, assigneeId } };
        return this.handleRequest("removeAclAssignee", options);
    }

    removeUserFromAccount(
        accountId: string,
        userId: string,
        fromUserAgent?: string,
        fromUserId?: string,
        fromUserIp?: string | string[],
    ): Promise<void> {
        const options = { pathParams: { accountId, userId }, body: { fromUserAgent, fromUserId, fromUserIp } };
        return this.handleRequest<void>("removeUserFromAccount", options);
    }

    removeUsergroupFromAccount(accountId: string, groupId: string): Promise<void> {
        const options = { pathParams: { accountId, groupId } };
        return this.handleRequest<void>("removeUsergroupFromAccount", options);
    }

    addDocumentAcl(accountId: string, documentId: string, roleId: string, aclRestrictionSet?: IAclRestrictionSet): Promise<Acl> {
        const options = { pathParams: { accountId, documentId }, body: { roleId, aclRestrictionSet } };
        return this.handleRequest("addDocumentAcl", options);
    }

    canAccessBackend(userId: string): Promise<boolean> {
        const options = { body: { userId } };
        return this.handleRequest("canAccessBackend", options);
    }

    hasAvailableEditorAccount(accountIds: string[], userId: string): Promise<boolean> {
        const options = { body: { accountIds }, pathParams: { userId } };
        return this.handleRequest("hasAvailableEditorAccount", options);
    }

    getAccountsForEditor(userId: string): Promise<AccountsWithPermissions[]> {
        const options = { pathParams: { userId } };
        return this.handleRequest("getAccountsForEditor", options);
    }

    removeResourceFromAcls(resourceId: string): Promise<void> {
        const options = { pathParams: { resourceId } };
        return this.handleRequest("removeResourceFromAcls", options);
    }

    //ROLES

    saveRole(
        name: string,
        isBuiltin: boolean,
        isDefault: boolean,
        permissions: PermissionName[],
        accountId: string,
    ): Promise<Role> {
        const options = {
            body: {
                name, isBuiltin, isDefault, permissions, accountId,
            },
        };
        return this.handleRequest("saveRole", options);
    }

    allRolesForAccount(accountId: string): Promise<Role[]> {
        const options = { pathParams: { accountId } };
        return this.handleRequest("allRolesForAccount", options);
    }

    handleCacheOnGroupMemberRemoval(accountId: string, groupId: string, membersIds: string[], forceFlush = false): Promise<void> {
        const options = {
            pathParams: {
                accountId,
                groupId,
            },
            body: {
                membersIds,
                forceFlush,
            },
        };
        return this.handleRequest("handleCacheOnGroupMemberRemoval", options);
    }

    allResourceIdsForAccounts(
        accountIds: string[]
    ): Promise<{[accountId: string]: string[]}> {
        const options = {
            body: {
                accountIds
            }
        }
        return this.handleRequest("allResourceIdsForAccounts", options);
    }

    deleteAllForAccount(accountId: string): Promise<void> {
        return this.handleRequest("deleteAllForAccount", {
            pathParams: {
                accountId
            }
        });
    }

    containsPublicAcl(accountId: string, itemIds: string[]): Promise<boolean> {
        return this.handleRequest("containsPublicAcl", {
            body: {
                accountId,
                itemIds
            },
        });
    }
}