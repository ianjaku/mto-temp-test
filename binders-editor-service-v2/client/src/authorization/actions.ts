import {
    APIAddUserToAcl,
    APIAddUsergroupToAcl,
    APIGrantPublicReadAccess,
    APIRemoveUserFromAcl,
    APIRemoveUsergroupFromAcl,
    APIRevokePublicReadAccess,
    APIUpdateGroupAcl,
    APIUpdateUserAcl,
} from "./api";
import {
    Acl,
    Permission,
    PermissionName,
    ResourceGroup,
    ResourceType,
    Role
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { getRootCollections } from "../documents/api";
import i18next from "@binders/client/lib/react/i18n";

async function grantAccessToRootCollection(
    acls: Acl[],
    accountId: string,
    userId: string,
    permissionsFilter: (permissions: Permission[]) => boolean
): Promise<Acl> {
    const collections = await getRootCollections([accountId]);
    if (collections.length !== 1) {
        throw new Error(i18next.t(TK.Account_RootCollectionLoadError, {accountId}));
    }
    const documentId = collections[0].id;
    const resourceFilter = (resource: ResourceGroup) =>
        resource.type === ResourceType.DOCUMENT &&
        resource.ids.indexOf(documentId) > -1;
    const wantedAcls = acls.filter(acl =>
        acl.rules.some(rule => permissionsFilter(rule.permissions) && resourceFilter(rule.resource))
    );
    if (wantedAcls.length === 0) {
        throw new Error(i18next.t(TK.Acl_CantFindAcl));
    }
    if (wantedAcls.length > 1) {
        throw new Error(i18next.t(TK.Acl_MultipleAclsError));
    }
    return APIAddUserToAcl(wantedAcls[0].id, accountId, userId);
}

function containPermissions(setOfPermissions: PermissionName[], permissionsToInclude: PermissionName[]): boolean {
    const [leadingPermission] = permissionsToInclude;
    if (!setOfPermissions.includes(leadingPermission)) {
        return false;
    } else {
        return setOfPermissions.reduce((result, perm) => {
            return result && permissionsToInclude.includes(perm);
        }, true);
    }
}

export function addRoleToRootCollection(acls: Acl[], role: Role, accountId: string, userId: string): Promise<Acl> {
    const permissionsFilter = (permissionsObjects: Permission[]) => {
        const permissions = permissionsObjects.map(p => p.name);
        return containPermissions(permissions, role.permissions);
    };
    return grantAccessToRootCollection(acls, accountId, userId, permissionsFilter);
}

export async function removeUserFromAcl(aclId: string, accountId: string, userId: string): Promise<void> {
    await APIRemoveUserFromAcl(aclId, accountId, userId);
}

export async function removeUsergroupFromAcl(aclId: string, accountId: string, userId: string): Promise<void> {
    await APIRemoveUsergroupFromAcl(aclId, accountId, userId);
}

export async function grantPublicReadAccess(accountId: string, documentId: string): Promise<Acl> {
    return await APIGrantPublicReadAccess(accountId, documentId);
}

export async function revokePublicReadAccess(accountId: string, documentId: string): Promise<Acl> {
    return await APIRevokePublicReadAccess(accountId, documentId);
}

export const addUserToAcl = async (aclId: string, accountId: string, userId: string): Promise<Acl> => {
    return await APIAddUserToAcl(aclId, accountId, userId);
};

export const addUsergroupToAcl = async(aclId: string, accountId: string, groupId: string): Promise<Acl> => {
    return await APIAddUsergroupToAcl(aclId, accountId, groupId);
};

export const updateUserAcl = async (oldAclId:string , aclId: string, accountId: string, userId: string): Promise<Acl> => {
    return await APIUpdateUserAcl(oldAclId, aclId, accountId, userId);
}

export const updateGroupAcl = async (oldAclId:string , aclId: string, accountId: string, groupId: string): Promise<Acl> => {
    return await APIUpdateGroupAcl(oldAclId, aclId, accountId, groupId);
}
