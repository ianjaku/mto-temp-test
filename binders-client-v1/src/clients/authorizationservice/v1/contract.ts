import { AccessGranted, EntityNotFound, Unauthorized } from "../../model";
import { TranslationKeys as TK } from "../../../i18n/translations";
import i18n from "../../../i18n";

export interface Acl {
    id: string;
    name: string;
    description?: string;
    accountId: string;
    assignees: AssigneeGroup[];
    rules: ResourcePermission[];
    restrictionSet: IAclRestrictionSet;
    roleId: string;
}

export interface ITokenAcl {
    rules: ResourcePermission[];
}

export interface IAclFilter {
    roleIds?: string[];
    resourceTypes?: ResourceType[];
}

export interface IAclRestrictionSet {
    languageCodes?: string[];
}

export interface Role {
    roleId: string;
    name: string;
    permissions: PermissionName[];
    accountId?: string;
    isBuiltin: boolean;
    isDefault: boolean;
    description?: string;
    isInvisible?: boolean;
}

export enum AssigneeType {
    USER = 0,
    ACCOUNT = 1,
    PUBLIC = 2,
    USERGROUP = 3
}

export interface AssigneeGroup {
    type: AssigneeType;
    ids: string[];
}

export enum ResourceType {
    DOCUMENT = 1,
    ACCOUNT = 2
}

export interface ResourceGroup {
    name?: string;      // the name of the group, ex. blogs
    type: ResourceType;
    ids: string[];
    id?: string;
}

export type ResourceGroupWithKey = ResourceGroup & {
    resourceGroupKey: string; // includes any restrictionMap key eg "1-in-langCodes-fr" (1 = DOCUMENT)
}


export interface ResourcePermission {
    resource: ResourceGroup;
    permissions: Permission[];  // the permissions the resource group has access to
}

export interface AclResourcePermission {
    id: string;
    role: string;
    groups: string;
    order: number;
    restrictionSet: IAclRestrictionSet;
}

export enum PermissionName {
    EDIT = 0,
    VIEW = 1,
    DELETE = 2,
    CREATE = 3,
    PUBLISH = 4,
    ADMIN = 5,
    REVIEW = 6,
}

export interface IPermissionFlag {
    permissionName: PermissionName,
    languageCodes?: string[],
}

export const allPermissionNames = [
    PermissionName.EDIT,
    PermissionName.VIEW,
    PermissionName.DELETE,
    PermissionName.CREATE,
    PermissionName.PUBLISH,
    PermissionName.ADMIN,
    PermissionName.REVIEW,
]

export interface PermissionMap {
    permission: PermissionName;
    resources: ResourceGroup[];
}

export interface Permission {
    name: PermissionName;
    description?: string;
}

export interface AccountPermission {
    resourceType: ResourceType;
    permission: PermissionName;
}

export interface AccountsWithPermissions {
    accountId: string;
    permissions: AccountPermission[];
}

export enum IncludePublicPolicy {
    INCLUDE,
    INCLUDE_EXCEPT_ADVERTIZED,
    EXCLUDE,
}

export interface IResourceGroupsFilter {
    includePublic?: IncludePublicPolicy,
}

export interface ResourceIdPermissionsName {
    [resourceId: string]: PermissionName[]
}

export const PSEUDO_ROLE_IDENTIFIER = "pseudo";
export const TRANSLATOR_PSEUDO_ID = `translator_${PSEUDO_ROLE_IDENTIFIER}`;
export const TRANSLATOR_PSEUDO_NAME = "Translator";

export interface AuthorizationServiceContract {
    authorize(userId: string, accountIds: Array<string>, requiredPermission: ResourcePermission): Promise<AuthorizationAccess>;
    accountAcls(accountId: string): Promise<Array<Acl>>;
    resourceAcls(resourceGroup: ResourceGroup, accountId?: string): Promise<{ [key: string]: Acl[] }>;
    allResourceAcls(
        resourceGroups: ResourceGroup[], 
        accountId?: string
    ): Promise<Acl[]>;
    userDocumentsAcls(userAndGropIds: string[], accountId: string): Promise<Acl[]>;

    loadAcl(aclId: string, accountId: string): Promise<Acl>;
    createAcl(name: string, description: string, accountId: string, assignees: AssigneeGroup[], rules: Array<ResourcePermission>, roleId: string): Promise<Acl>;
    updateAcl(toUpdate: Acl): Promise<Acl>;
    deleteAcl(aclId: string, accountId: string): Promise<void>;
    addAclAssignee(aclId: string, accountId: string, assigneeType: AssigneeType, assigneeId: string): Promise<Acl>;
    removeAclAssignee(aclId: string, accountId: string, assigneeType: AssigneeType, assigneeId: string): Promise<Acl>;
    updateAclAssignee(oldAclId: string, aclId: string, accountId: string, assigneeType: AssigneeType, assigneeId: string): Promise<Acl>;
    duplicateResourceAcls(fromToIdPairs: string[][], resourceType: ResourceType, accountId: string): Promise<void>;

    createDefaultAccountRoles(accountId: string, collectionId: string): Promise<Acl[]>;

    addDocumentAcl(accountId: string, documentId: string, roleId: string, aclRestrictionSet?: IAclRestrictionSet): Promise<Acl>;

    grantPublicReadAccess(accountId: string, documentId: string): Promise<Acl>;
    revokePublicReadAccess(accountId: string, documentId: string): Promise<Acl>;

    // Use for search in the reposervice, each resourceGroup will be translated to an ES filter
    findAllowedResourceGroups(userId: string, resourceType: ResourceType, permission: PermissionName, skipPublic: boolean, accountId: string, skipCache?: boolean): Promise<ResourceGroup[]>;
    findPublicResourceGroups(resourceType: ResourceType, permissions: PermissionName[], accountIds?: string[], skipCache?: boolean): Promise<PermissionMap[]>;
    findMyResourceGroups(accountIds: string[], resourceType: ResourceType, permissionNames: PermissionName[], filter?: IResourceGroupsFilter): Promise<PermissionMap[]>;

    // Get the permissions for the given user on the given resource
    findResourcePermissions(
        userId: string,
        resourceType: ResourceType,
        resourceId: string,
        accountId?: string
    ): Promise<PermissionName[]>;
    findResourcePermissionsWithRestrictions(
        userId: string,
        resourceType: ResourceType,
        resourceId: string,
        accountId?: string
    ): Promise<Acl[]>;
    findMultipleResourcesPermissions(userId: string, resourceType: ResourceType, resourceIds: string[], accountId?: string): Promise<ResourceIdPermissionsName>;
    findPublicPermissions(resourceType: ResourceType, resourceId: string, accountId: string): Promise<PermissionName[]>;

    addAccountAdmin(accountId: string, userId: string): Promise<string[]>;
    addAccountAdminUserGroup(accountId: string, groupId: string): Promise<string[]>;
    getAccountAdmins(accountId: string): Promise<string[]>;
    getAdminGroup(accountId: string): Promise<string>;
    removeAccountAdmin(accountId: string, userId: string): Promise<string[]>;

    allResourceIdsForAccounts(
        accountIds: string[]
    ): Promise<{[accountId: string]: string[]}>;

    addUserToAccount(
        accountId: string,
        userId: string,
        fromUserId?: string,
        fromUserIp?: string | string[],
        fromUserAgent?: string
    ): Promise<void>;
    removeUserFromAccount(accountId: string, userId: string): Promise<void>;
    removeUsergroupFromAccount(accountId: string, groupId: string): Promise<void>;

    hasAvailableEditorAccount(accountIds: string[], userId: string): Promise<boolean>;
    getAccountsForEditor(userId: string): Promise<AccountsWithPermissions[]>;
    canAccessBackend(userId: string): Promise<boolean>;

    removeResourceFromAcls(resourceId: string): Promise<void>;

    //Roles
    saveRole(name: string, isBuiltin: boolean, isDefault: boolean, permissions: PermissionName[], accountId: string): Promise<Role>;
    allRolesForAccount(accountId: string): Promise<Role[]>;

    handleCacheOnGroupMemberRemoval(accountId: string, groupId: string, membersIds: string[], forceFlush?: boolean): Promise<void>;
    deleteAllForAccount(accountId: string): Promise<void>;
    containsPublicAcl(accountId: string, itemIds: string[]): Promise<boolean>;
}

export class AclNotFoundException extends EntityNotFound {
    constructor(id: string) {
        super(i18n.t(TK.Acl_NoAclWithIdError, { id }));
    }
}

export class RoleNotFoundException extends EntityNotFound {
    constructor(id: string) {
        super(i18n.t(TK.Acl_NoRoleWithIdError, { id }));
    }
}

export type AuthorizationAccess = AccessGranted | Unauthorized;
