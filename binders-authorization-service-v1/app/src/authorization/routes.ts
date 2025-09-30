import {
    AccountAdmin,
    AccountMemberParams,
    Allow,
    MultiAuthorization,
    RequiredPermissionExtractor,
    authorize,
    extractAccountIdFromBody,
    extractAccountIdFromParams
} from "@binders/binders-service-common/lib/middleware/authorization";
import {
    Acl,
    AuthorizationServiceContract,
    PermissionName,
    ResourceType
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import {
    ApplicationToken,
    ApplicationTokenOrPublic,
    BackendSession,
} from "@binders/binders-service-common/lib/middleware/authentication";
import {
    AuditLogType,
    TrackingServiceContract
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { AuthorizationService, AuthorizationServiceFactory } from "./service";
import {
    ServerEvent,
    captureServerEvent,
} from "@binders/binders-service-common/lib/tracking/capture";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import { AclUpdateKind } from "./models/update";
import { ServiceRoute } from "@binders/binders-service-common/lib/middleware/app";
import { Unauthorized } from "@binders/client/lib/clients/model";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import { equals } from "ramda";
import {
    getRoutes as getAppRoutes
} from "@binders/client/lib/clients/authorizationservice/v1/routes";
import { getClientIps } from "@binders/binders-service-common/lib/util/ip";
import { validateUserId } from "@binders/client/lib/clients/validation";


export default function getServiceRoutes(
    authorizationServiceFactory: AuthorizationServiceFactory,
    trackingClient: TrackingServiceContract,
    accountServiceClient: AccountServiceClient
): { [name in keyof AuthorizationServiceContract]: ServiceRoute } {

    const appRoutes = getAppRoutes();

    function withService<T>(f: (service: AuthorizationService, request: WebRequest) => Promise<T>): (req: WebRequest) => Promise<T> {
        return function(request) {
            return authorizationServiceFactory.forRequest({ logger: request.logger })
                .then(service => f(service, request));
        };
    }

    function az(extractor: RequiredPermissionExtractor) {
        return withService(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (service, request) => authorize(extractor, service as any)(request)
        );
    }

    const documentAdminFromURL = function(request: WebRequest) {
        return authorizationServiceFactory.forRequest({ logger: request.logger })
            .then(service => {
                if (!request.user) {
                    throw new Unauthorized("Not logged in.");
                }
                return service.findResourcePermissions(request.user.userId, ResourceType.DOCUMENT, request.params.documentId)
                    .then(permissionNames => {
                        if (permissionNames.find(item => item === PermissionName.ADMIN) === undefined) {
                            throw new Unauthorized("Not an document admin.");
                        }
                        return undefined;
                    });
            });
    };

    const logAuditLogAclUpdate = (request: WebRequest, kind?: AclUpdateKind) => {
        return (newAcl: Acl, oldAcl: Acl) => {
            const { fromUserAgent, fromUserId, fromUserIp } = request.body;
            if (equals(oldAcl, newAcl)) {
                return;
            }
            let uId = fromUserId || (request.user && request.user.userId);
            if (validateUserId(uId).length !== 0 || uId === "uid-user-service") {
                uId = "public";
            }
            trackingClient.logAuditLog(
                AuditLogType.ACL_UPDATE,
                uId,
                request.params.accountId,
                fromUserAgent || (request["headers"] && request["headers"]["user-agent"]),
                {
                    oldAcl,
                    newAcl,
                },
                fromUserIp || getClientIps(request),
            );
            captureServerEvent(ServerEvent.AclUpdated, { accountId: request.params.accountId, userId: fromUserId }, { kind });
        };
    };

    const documentAdminFromAcl = function(request: WebRequest) {
        const aclId = request.params.aclId;
        const accountId = request.params.accountId;
        return authorizationServiceFactory.forRequest({ logger: request.logger })
            .then(service => {
                return service.loadAcl(aclId, accountId)
                    .then(loadedAcl => {
                        if (loadedAcl.rules.length !== 1) {
                            throw new Unauthorized("Invalid acl (rules).");
                        }
                        const relevantResourceGroup = loadedAcl.rules[0].resource;
                        if (relevantResourceGroup.ids.length > 1) {
                            throw new Unauthorized("Invalid acl (ids).");
                        }
                        if (request.user === undefined) {
                            throw new Unauthorized("Not logged in?");
                        }
                        return service.findResourcePermissions(request.user.userId, relevantResourceGroup.type, relevantResourceGroup.ids[0], accountId)
                            .then(permissionNames => {
                                if (permissionNames.find(item => item === PermissionName.ADMIN) === undefined) {
                                    throw new Unauthorized("Not an document admin.");
                                }
                                return undefined;
                            });
                    });
            });
    };

    const accountAdminAuthorization = (accountIdLocation: "body" | "params") => {
        const extractor = accountIdLocation === "body" ?
            extractAccountIdFromBody :
            extractAccountIdFromParams;
        return az(AccountAdmin(extractor));
    }

    const AccountMember = AccountMemberParams(accountServiceClient);
    const accountAdminAuthorizationBody = accountAdminAuthorization("body");
    const accountAdmin = {
        authentication: ApplicationToken,
        authorization: accountAdminAuthorization("params")
    };
    return {
        addAccountAdmin: {
            ...appRoutes.addAccountAdmin,
            serviceMethod: withService(
                (service, request) => service.addAccountAdmin(
                    request.params.accountId,
                    request.body.userId,
                    logAuditLogAclUpdate(request, "addAccountAdmin"),
                )
            ),
        },
        addAccountAdminUserGroup: {
            ...appRoutes.addAccountAdminUserGroup,
            serviceMethod: withService(
                (service, request) => service.addAccountAdminUserGroup(
                    request.params.accountId,
                    request.body.groupId
                )
            ),
        },
        addAclAssignee: {
            ...appRoutes.addAclAssignee,
            serviceMethod: withService(
                (service, request) => service.addAclAssignee(
                    request.params.aclId,
                    request.params.accountId,
                    request.body.assigneeType,
                    request.body.assigneeId,
                    logAuditLogAclUpdate(request, "addAclAssignee"),
                )
            ),
            authentication: ApplicationToken,
            authorization: MultiAuthorization([accountAdmin.authorization, documentAdminFromAcl])
        },
        updateAclAssignee: {
            ...appRoutes.updateAclAssignee,
            serviceMethod: withService(
                (service, request) => service.updateAclAssignee(
                    request.params.oldAclId,
                    request.params.aclId,
                    request.params.accountId,
                    request.body.assigneeType,
                    request.body.assigneeId,
                    logAuditLogAclUpdate(request, "updateAclAssignee"),
                )
            ),
            authentication: ApplicationToken,
            authorization: MultiAuthorization([accountAdmin.authorization, documentAdminFromAcl])
        },
        duplicateResourceAcls: {
            ...appRoutes.duplicateResourceAcls,
            serviceMethod: withService(
                (service, request) => service.duplicateResourceAcls(
                    request.body.fromToIdPairs,
                    request.body.resourceType,
                    request.body.accountId,
                )
            ),
        },
        allResourceIdsForAccounts: {
            ...appRoutes.allResourceIdsForAccounts,
            serviceMethod: withService(
                (service, request) => service.allResourceIdsForAccounts(
                    request.body.accountIds
                )
            ),
        },
        addUserToAccount: {
            ...appRoutes.addUserToAccount,
            serviceMethod: withService(
                (service, request) => service.addUserToAccount(
                    request.params.accountId,
                    request.body.userId,
                    request.body.fromUserId,
                    request.body.fromUserIp,
                    request.body.fromUserAgent || request["headers"] && request["headers"]["user-agent"],
                    logAuditLogAclUpdate(request, "addUserToAccount"),
                )
            ),
            authentication: ApplicationToken,
            authorization: MultiAuthorization([accountAdmin.authorization])
        },
        resourceAcls: {
            ...appRoutes.resourceAcls,
            serviceMethod: withService(
                (service, request) => {
                    const isBackend = request.user && (<BackendSession>request.user).isBackend;
                    const userId = request.user ? request.user.userId : undefined;
                    return service.resourceAcls(request.body.resourceGroup, request.body.accountId, userId, isBackend);
                }
            ),
            authentication: ApplicationToken,
            authorization: Allow
        },
        allResourceAcls: {
            ...appRoutes.allResourceAcls,
            serviceMethod: withService(
                (service, request) => (
                    service.allResourceAcls(
                        request.body.resourceGroups,
                        request.body.accountId
                    )
                )
            ),
        },
        removeAclAssignee: {
            ...appRoutes.removeAclAssignee,
            serviceMethod: withService(
                (service, request) => service.removeAclAssignee(
                    request.params.aclId,
                    request.params.accountId,
                    request.body.assigneeType,
                    request.body.assigneeId,
                    logAuditLogAclUpdate(request, "removeAclAssignee"),
                )
            ),
            authentication: ApplicationToken,
            authorization: MultiAuthorization([accountAdmin.authorization, documentAdminFromAcl])
        },
        authorize: {
            ...appRoutes.authorize,
            serviceMethod: withService(
                (service, request) => service.authorize(request.body.userId, request.body.accountIds, request.body.requiredPermission)
            ),
        },
        accountAcls: {
            ...appRoutes.accountAcls,
            serviceMethod: withService(
                (service, request) => service.accountAcls(request.params.accountId)
            ),
            authentication: ApplicationToken,
            authorization: accountAdmin.authorization
        },
        userDocumentsAcls: {
            ...appRoutes.userDocumentsAcls,
            serviceMethod: withService(
                (service, request) => service.userDocumentsAcls(
                    request.body.userAndGroupIds,
                    request.params.accountId,
                )
            ),
        },
        getAccountAdmins: {
            ...appRoutes.getAccountAdmins,
            serviceMethod: withService(
                (service, request) => service.getAccountAdmins(request.params.accountId)
            ),
        },
        loadAcl: {
            ...appRoutes.loadAcl,
            serviceMethod: withService(
                (service, request) => service.loadAcl(request.params.aclId, request.params.accountid)
            ),
            ...accountAdmin
        },
        createAcl: {
            ...appRoutes.createAcl,
            serviceMethod: withService(
                (service, request) => service.createAcl(
                    request.body.name,
                    request.body.description,
                    request.body.accountId,
                    request.body.assignees,
                    request.body.rules,
                    request.body.roleId,
                    logAuditLogAclUpdate(request, "createAcl"),
                )
            ),
            authentication: ApplicationToken,
            authorization: accountAdmin.authorization
        },
        removeAccountAdmin: {
            ...appRoutes.removeAccountAdmin,
            serviceMethod: withService(
                (service, request) => service.removeAccountAdmin(
                    request.params.accountId,
                    request.body.userId,
                    logAuditLogAclUpdate(request, "removeAccountAdmin"),
                )
            ),
        },
        updateAcl: {
            ...appRoutes.updateAcl,
            serviceMethod: withService(
                (service, request) => service.updateAcl(
                    request.body,
                    request.params.aclId,
                    request.params.accountId,
                    logAuditLogAclUpdate(request, "updateAcl"),
                )
            ),
            ...accountAdmin
        },
        deleteAcl: {
            ...appRoutes.deleteAcl,
            serviceMethod: withService(
                (service, request) => service.deleteAcl(
                    request.params.aclId,
                    request.params.accountId,
                    logAuditLogAclUpdate(request, "deleteAcl"),
                )
            ),
            authentication: ApplicationToken,
            authorization: accountAdmin.authorization
        },
        findMyResourceGroups: {
            ...appRoutes.findMyResourceGroups,
            serviceMethod: withService(
                (service, request) => service.findMyResourceGroups(request.body.accountIds, request.body.resourceType,
                    request.body.permissions, request.body.filter, request.user ? request.user.userId : undefined)
            ),
            authentication: ApplicationTokenOrPublic,
            authorization: Allow
        },
        findAllowedResourceGroups: {
            ...appRoutes.findAllowedResourceGroups,
            serviceMethod: withService(
                (service, request) => service.findAllowedResourceGroups(
                    request.body.userId,
                    request.body.resourceType,
                    request.body.permission,
                    request.body.skipPublic,
                    request.body.accountId
                )
            ),
        },
        findPublicResourceGroups: {
            ...appRoutes.findPublicResourceGroups,
            serviceMethod: withService(
                (service, request) => service.findPublicResourceGroups(request.body.resourceType, request.body.permissions, request.body.accountIds)
            ),
        },
        findPublicPermissions: {
            ...appRoutes.findPublicPermissions,
            serviceMethod: withService(
                (service, request) => service.findPublicPermissions(request.body.resourceType, request.body.resourceId, request.body.accountId)
            ),
        },
        findResourcePermissions: {
            ...appRoutes.findResourcePermissions,
            serviceMethod: withService(
                (service, request) => service.findResourcePermissions(
                    request.body.userId,
                    request.body.resourceType,
                    request.body.resourceId,
                    request.body.accountId
                )
            ),
        },
        findResourcePermissionsWithRestrictions: {
            ...appRoutes.findResourcePermissionsWithRestrictions,
            serviceMethod: withService(
                (service, request) => service.findResourcePermissionsWithRestrictions(
                    request.body.userId,
                    request.body.resourceType,
                    request.body.resourceId,
                    request.body.accountId
                )
            ),
        },
        createDefaultAccountRoles: {
            ...appRoutes.createDefaultAccountRoles,
            serviceMethod: withService(
                (service, request) => service.createDefaultAccountRoles(request.params.accountId, request.body.collectionId)
            ),
        },
        removeUserFromAccount: {
            ...appRoutes.removeUserFromAccount,
            serviceMethod: withService(
                (service, request) => service.removeUserFromAccount(
                    request.params.accountId,
                    request.params.userId,
                    logAuditLogAclUpdate(request, "removeUserFromAccount"),
                )
            ),
            authentication: ApplicationToken,
            authorization: accountAdmin.authorization
        },
        removeUsergroupFromAccount: {
            ...appRoutes.removeUsergroupFromAccount,
            serviceMethod: withService(
                (service, request) => service.removeUsergroupFromAccount(request.params.accountId, request.params.groupId)
            ),
            authentication: ApplicationToken,
            authorization: accountAdmin.authorization
        },
        addDocumentAcl: {
            ...appRoutes.addDocumentAcl,
            serviceMethod: withService(
                (service, request) => service.addDocumentAcl(
                    request.params.accountId,
                    request.params.documentId,
                    request.body.roleId,
                    request.body.aclRestrictionSet,
                    logAuditLogAclUpdate(request, "addDocumentAcl"),
                )
            ),
            authentication: ApplicationToken,
            authorization: documentAdminFromURL
        },
        grantPublicReadAccess: {
            ...appRoutes.grantPublicReadAccess,
            serviceMethod: withService(
                (service, request) => service.grantPublicReadAccess(
                    request.params.accountId,
                    request.params.documentId,
                    logAuditLogAclUpdate(request, "grantPublicReadAccess"),
                )
            ),
            authentication: ApplicationToken,
            authorization: documentAdminFromURL,
        },
        revokePublicReadAccess: {
            ...appRoutes.revokePublicReadAccess,
            serviceMethod: withService(
                (service, request) => service.revokePublicReadAccess(
                    request.params.accountId,
                    request.params.documentId,
                    logAuditLogAclUpdate(request, "revokePublicReadAccess"),
                )
            ),
            authentication: ApplicationToken,
            authorization: documentAdminFromURL
        },
        hasAvailableEditorAccount: {
            ...appRoutes.hasAvailableEditorAccount,
            serviceMethod: withService(
                (service, request) => service.hasAvailableEditorAccount(request.body.accountIds, request.params.userId)
            ),
            authentication: ApplicationTokenOrPublic,
            authorization: Allow
        },
        canAccessBackend: {
            ...appRoutes.canAccessBackend,
            serviceMethod: withService(
                (service, request) => service.canAccessBackend(request.body.userId)
            ),
        },
        getAccountsForEditor: {
            ...appRoutes.getAccountsForEditor,
            serviceMethod: withService(
                (service, request) => service.getAccountsForEditor(request.params.userId)
            ),
        },
        removeResourceFromAcls: {
            ...appRoutes.removeResourceFromAcls,
            serviceMethod: withService(
                (service, request) => service.removeResourceFromAcls(request.params.resourceId)
            ),
        },
        // Roles
        saveRole: {
            ...appRoutes.saveRole,
            serviceMethod: withService(
                (service, request) => service.saveRole(
                    request.body.name,
                    request.body.isBuiltin,
                    request.body.isDefault,
                    request.body.permissions,
                    request.body.accountId,
                )
            ),
            authentication: ApplicationToken,
            authorization: accountAdminAuthorizationBody
        },
        allRolesForAccount: {
            ...appRoutes.allRolesForAccount,
            serviceMethod: withService(
                (service, request) => service.allRolesForAccount(
                    request.params.accountId,
                )
            ),
            authentication: ApplicationToken,
            authorization: AccountMember
        },
        getAdminGroup: {
            ...appRoutes.getAdminGroup,
            serviceMethod: withService(
                (service, request) => service.getAdminGroup(
                    request.params.accountId,
                )
            ),
            authentication: ApplicationToken,
            authorization: AccountMember
        },
        handleCacheOnGroupMemberRemoval: {
            ...appRoutes.handleCacheOnGroupMemberRemoval,
            serviceMethod: withService(
                (service, request) => service.handleCacheOnGroupMemberRemoval(
                    request.params.accountId,
                    request.params.groupId,
                    request.body.membersIds,
                    request.body.forceFlush,
                )
            ),
        },
        findMultipleResourcesPermissions: {
            ...appRoutes.findMultipleResourcesPermissions,
            serviceMethod: withService(
                (service, request) => service.findMultipleResourcesPermissions(request.body.userId, request.body.resourceType, request.body.resourceIds, request.body.accountId)
            ),
        },
        deleteAllForAccount: {
            ...appRoutes.deleteAllForAccount,
            serviceMethod: withService(
                (service, request) => service.deleteAllForAccount(
                    request.params.accountId
                )
            ),
        },
        containsPublicAcl: {
            ...appRoutes.containsPublicAcl,
            serviceMethod: withService(
                (service, request) => {
                    const accountId = request.body.accountId;
                    const itemIds = request.body.itemIds;
                    return service.containsPublicAcl(accountId, itemIds);
                }
            ),
            authentication: ApplicationTokenOrPublic,
            authorization: Allow,
        },
    };
}
