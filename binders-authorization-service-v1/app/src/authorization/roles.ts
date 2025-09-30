import { AccountIdentifier, AclIdentifier } from "@binders/binders-service-common/lib/authentication/identity";
import { PermissionName, ResourcePermission, ResourceType } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { builtInRoles, builtInRolesArray } from "../authorization/repositories/roles";
import { Acl } from "../authorization/models/acl";
import { Role } from "../authorization/models/roles";

export type roles = keyof typeof builtInRoles;

export type AccountRoles = {
    [key in roles]: Acl[]
}

export function getAccountRole(role: Role, accountId: string, resourcePermissions: ResourcePermission[]): Acl[] {
    return resourcePermissions.map(resourcePermission =>
        new Acl(
            AclIdentifier.generate(),
            role.pluralName,
            role.description,
            new AccountIdentifier(accountId),
            [],
            [resourcePermission],
            role.roleId,
        )
    );
}

export function getInheritedPermissions(permission: PermissionName): PermissionName[] {
    switch (permission) {
        case PermissionName.ADMIN:
            return [PermissionName.ADMIN, PermissionName.PUBLISH, PermissionName.EDIT, PermissionName.VIEW, PermissionName.REVIEW];
        case PermissionName.PUBLISH:
            return [PermissionName.PUBLISH, PermissionName.EDIT, PermissionName.VIEW, PermissionName.REVIEW];
        case PermissionName.REVIEW:
            return [PermissionName.REVIEW, PermissionName.EDIT, PermissionName.VIEW];
        case PermissionName.EDIT:
            return [PermissionName.EDIT, PermissionName.VIEW];
        default:
            return [permission];
    }
}


function buildPermission(permission: PermissionName, resourceId: string, accountId: string) {
    const permissions : {resource, permissions}[] = [];
    if(permission === PermissionName.ADMIN) {
        permissions.push(buildResourcePermission(ResourceType.ACCOUNT, PermissionName.EDIT, accountId, false));
    }
    permissions.push(buildResourcePermission(ResourceType.DOCUMENT, permission, resourceId, true));
    return permissions;
}
function buildResourcePermission(resourceType: ResourceType, permission: PermissionName, resourceId: string, inherit: boolean) {
    const permissionsToAdd = inherit ?
        getInheritedPermissions(permission) :
        [permission];
    return {
        resource: {
            type: resourceType,
            ids: [resourceId]
        },
        permissions: permissionsToAdd.map(p => { return { name: p }; })
    };
}

function buildResourcePermissionsFromRole(resourceType: ResourceType, role: Role, resourceId: string) {
    const { permissions } = role;
    const resourcePermissions = {
        resource: {
            type: resourceType,
            ids: [resourceId]
        },
        permissions: permissions.map(p => { return { name: p }; })
    }
    return resourcePermissions;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function getAdminRoleResourcePermissions(accountId: string, collectionId: string) {
    return [
        buildResourcePermission(ResourceType.ACCOUNT, PermissionName.EDIT, accountId, false),
        buildResourcePermission(ResourceType.DOCUMENT, PermissionName.ADMIN, collectionId, true)
    ];
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function getReaderRoleResourcePermissions(collectionId: string) {
    return [
        buildResourcePermission(ResourceType.DOCUMENT, PermissionName.VIEW, collectionId, true)
    ];
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function getEditorRoleResourcePermissions(collectionId: string) {
    return [
        buildResourcePermission(ResourceType.DOCUMENT, PermissionName.EDIT, collectionId, true)
    ];
}

// todo: maybe this name is not the best, because default role is something else, but for now I left it like it was before
// maybe we should take all roles for account + built in?
export function getDefaultAccountRoles(accountId: string, accountCollectionId: string): AccountRoles {

    return Object.keys(builtInRoles).reduce((prev, r) => {
        const role = builtInRolesArray.find(rol => builtInRoles[r].roleId === rol.roleId);
        prev[r] = getAccountRole(
            builtInRoles[r],
            accountId,
            buildPermission(role.permissions[0], accountCollectionId, accountId), // this can be optimized, we have the permissions in role.permissions, doesn't need to be transformed
        );
        return prev;
    }, {} as AccountRoles);
}

export function getDocumentResourcePermission(documentId: string, permission: PermissionName): ResourcePermission {
    return buildResourcePermission(ResourceType.DOCUMENT, permission, documentId, true);
}
export function getDocumentResourcePermissionsFromRole(documentId: string, role: Role): ResourcePermission {
    return buildResourcePermissionsFromRole(ResourceType.DOCUMENT, role, documentId);
}
