import {
    Acl,
    AssigneeType,
    IAclRestrictionSet,
    IncludePublicPolicy,
    PermissionMap,
    PermissionName,
    ResourceType
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { AuthorizationServiceClient } from "@binders/client/lib/clients/authorizationservice/v1/client";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config";

const client = AuthorizationServiceClient.fromConfig(config, "v1", browserRequestHandler);

export const APIFindMyResourceGroups = (accountIds: string[], resourceType: ResourceType, permissions: PermissionName[], isReadOnlyEditor: boolean): Promise<PermissionMap[]> =>
    client.findMyResourceGroups(
        accountIds,
        resourceType,
        permissions,
        { includePublic: isReadOnlyEditor ? IncludePublicPolicy.EXCLUDE : IncludePublicPolicy.INCLUDE }
    )

export const APIRemoveUserAcls = (accountId: string, userId: string): Promise<void> => client.removeUserFromAccount(accountId, userId);

export const APIAccountAcls = (accountId: string): Promise<Acl[]> => client.accountAcls(accountId);

export function APIAddUserToAcl(aclId: string, accountId: string, userId: string): Promise<Acl> {
    return client.addAclAssignee(aclId, accountId, AssigneeType.USER, userId);
}

export function APIAddDocumentAcl(accountId: string, documentId: string, roleId: string, aclRestrictionSet: IAclRestrictionSet): Promise<Acl> {
    return client.addDocumentAcl(accountId, documentId, roleId, aclRestrictionSet);
}

export function APIRemoveUserFromAcl(aclId: string, accountId: string, userId: string): Promise<Acl> {
    return client.removeAclAssignee(aclId, accountId, AssigneeType.USER, userId);
}

export function APIUpdateUserAcl(oldAclId: string, newAclId: string, accountId: string, userId: string): Promise<Acl> {
    return client.updateAclAssignee(oldAclId, newAclId, accountId, AssigneeType.USER, userId);
}

export function APIUpdateGroupAcl(oldAclId: string, newAclId: string, accountId: string, userId: string): Promise<Acl> {
    return client.updateAclAssignee(oldAclId, newAclId, accountId, AssigneeType.USERGROUP, userId);
}


export function APIRemoveUsergroupFromAcl(aclId: string, accountId: string, groupId: string): Promise<Acl> {
    return client.removeAclAssignee(aclId, accountId, AssigneeType.USERGROUP, groupId);
}

export function APIGrantPublicReadAccess(accountId: string, documentId: string): Promise<Acl> {
    return client.grantPublicReadAccess(accountId, documentId)
}

export function APIRevokePublicReadAccess(accountId: string, documentId: string): Promise<Acl> {
    return client.revokePublicReadAccess(accountId, documentId);
}

export function APIAddUsergroupToAcl(aclId: string, accountId: string, groupId: string): Promise<Acl> {
    return client.addAclAssignee(aclId, accountId, AssigneeType.USERGROUP, groupId);
}

export function APIDocumentAcls(documentIds: string[], accountId: string): Promise<{ [key: string]: Acl[] }> {
    return client.resourceAcls({ type: ResourceType.DOCUMENT, ids: documentIds }, accountId);
}