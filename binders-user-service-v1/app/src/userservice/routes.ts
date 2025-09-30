import {
    AccountAdminParamsOrBody,
    AccountAdminParamsOrBodyOrQuery,
    AccountFeaturesEnabled,
    AccountMemberBody,
    AccountMemberParams,
    AccountsEditorMember,
    Allow,
    Authorization,
    CurrentUserIsActor,
    MultiAuthorization,
    MultiAuthorizationAnd,
    MultiAuthorizationOr,
    maybeAuth
} from "@binders/binders-service-common/lib/middleware/authorization";
import {
    AccountServiceContract,
    FEATURE_CEVA,
    FEATURE_DEVICE_USER_IMPERSONATION,
    FEATURE_GROUP_OWNERS,
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    ApplicationToken,
    Public
} from "@binders/binders-service-common/lib/middleware/authentication";
import {
    AuditLogType,
    TrackingServiceContract,
    UserGroupActionType
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import {
    IWhitelistedEmailFilter,
    UserServiceContract,
} from "@binders/client/lib/clients/userservice/v1/contract";
import { UserService, UserServiceFactory } from "./service";
import {
    AuthorizationServiceContract
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { RoutingServiceContract } from "@binders/client/lib/clients/routingservice/v1/contract";
import { ServiceRoute } from "@binders/binders-service-common/lib/middleware/app";
import { Unauthorized } from "@binders/client/lib/clients/model";
import { UserRecordsFilter } from "./filter";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import { defaultLanguage } from "@binders/client/lib/i18n";
import {
    extractInterfaceLanguageFromRequest
} from "@binders/binders-service-common/lib/util/i18n";
import getAppRoutes from "@binders/client/lib/clients/userservice/v1/routes";
import { getClientIps } from "@binders/binders-service-common/lib/util/ip";
import { isBackendSession } from "@binders/binders-service-common/lib/middleware/authentication";
import { isManualToLogin } from "@binders/client/lib/util/user";

const getRequestUiLanguageOrUseDefault = async (
    request: WebRequest,
    accountId: string | undefined,
    domain?: string
): Promise<string> => {
    try {
        return extractInterfaceLanguageFromRequest(request, { accountId, domain });
    } catch (e) {
        request.logger?.error(`Failed to resolve interface language for request with accountId: ${accountId} and domain ${domain}: ${e.message}`, "request-interface-language");
        return defaultLanguage;
    }
}

export function getServiceRoutes(
    userServiceFactory: UserServiceFactory,
    azContract: AuthorizationServiceContract,
    accountService: AccountServiceContract,
    trackingServiceContract: TrackingServiceContract,
    routingClient: RoutingServiceContract,
    defaultLogger: Logger,
): { [name in keyof UserServiceContract]: ServiceRoute } {
    const appRoutes = getAppRoutes();

    function withService<T>(f: (service: UserService, request: WebRequest) => Promise<T>): (request: WebRequest) => Promise<T> {
        return function(request: WebRequest) {
            const service = userServiceFactory.build(request.logger);
            return f(service, request);
        };
    }

    const loginCannotBeManualToUser = (keyInBody: string): Authorization => {
        return async (request: WebRequest) => {
            if (request.body == null) return;
            const login = request.body[keyInBody];
            if (login == null) return;
            if (isManualToLogin(login.toLowerCase())) {
                throw new Unauthorized("Manual.to login not allowed");
            }
        }
    }

    const loginIsPartOfAccount = (loginKeyInBody: string): Authorization => {
        return async (request: WebRequest) => {
            const accountId: string = request.body?.accountId ?? request.params?.accountId;
            const login = request.body[loginKeyInBody];
            if (login == null) return;

            const deviceUser = await withService((service => service.getUserByLogin(login)))(request);

            if (deviceUser == null) {
                throw new Unauthorized("Device user not found");
            }
            const deviceUserAccountIds = await accountService.getAccountIdsForUser(deviceUser.id);
            if (!deviceUserAccountIds.includes(accountId)) {
                throw new Unauthorized("Device user must be part of the given account");
            }
        }
    }

    const accountMember =
        async (request: WebRequest) => {
            const { params, user } = request;
            const accountId = params && params.accountId;
            const accounts = !user ?
                [] :
                await accountService.getAccountsForUser(
                    user && user.userId
                );
            const isAllowed = accountId && accounts.findIndex(acc => acc.id === accountId) > -1;
            return isAllowed ?
                Promise.resolve() :
                Promise.reject(new Unauthorized("Not an account member"));
        };

    const userMatch = (request: WebRequest) => {
        return request.params.userId === request.user.userId ?
            Promise.resolve(undefined) :
            Promise.reject(new Unauthorized("Not logged in."));
    };

    const RequestingUserOwnsGroup = (
        userIdExtractor: (request: WebRequest) => string,
        groupIdExtractor: (request: WebRequest) => string,
    ): Authorization => {
        return async (request: WebRequest) => {
            const userId = userIdExtractor(request);
            const groupId = groupIdExtractor(request);
            const myOwnedUsergroupsResult = await withService((service) =>
                service.searchUsergroups({ ownerId: userId }, { maxResults: 99999 })
            )(request);
            if (!myOwnedUsergroupsResult.hits.some(usergroup => usergroup.id === groupId)) {
                throw new Unauthorized(`Requesting user does not own group with id ${groupId}`);
            }
        }
    }

    const RequestingUserOwnsAnyGroup = (
        userIdExtractor: (request: WebRequest) => string,
    ): Authorization => {
        return async (request: WebRequest) => {
            const userId = userIdExtractor(request);
            const accountId = request.params.accountId || request.body.accountId;
            const myOwnedUsergroupsResult = await withService((service) =>
                service.searchUsergroups({ ownerId: userId }, { maxResults: 99999 })
            )(request);
            if (!myOwnedUsergroupsResult.hits.some(usergroup => usergroup.accountId === accountId)) {
                throw new Unauthorized(`Requesting user does not own any usergroups in ${accountId}`);
            }
        }
    }

    const CanManageUsergroup = (
        azContract: AuthorizationServiceContract,
        accountService: AccountServiceContract,
        userIdExtractor: (request: WebRequest) => string,
        groupIdExtractor: (request: WebRequest) => string,
    ): Authorization => {
        return MultiAuthorizationOr([
            AccountAdminParamsOrBody(azContract),
            MultiAuthorizationAnd([
                AccountFeaturesEnabled(accountService, [FEATURE_GROUP_OWNERS]),
                RequestingUserOwnsGroup(userIdExtractor, groupIdExtractor),
            ])
        ])
    }

    const CanManageCevaImportActions = (
        azContract: AuthorizationServiceContract,
        accountService: AccountServiceContract,
        userIdExtractor: (request: WebRequest) => string,
    ): Authorization => {
        return MultiAuthorizationOr([
            AccountAdminParamsOrBody(azContract),
            MultiAuthorizationAnd([
                AccountFeaturesEnabled(accountService, [FEATURE_CEVA, FEATURE_GROUP_OWNERS]),
                RequestingUserOwnsAnyGroup(userIdExtractor),
            ])
        ])
    }

    const UserEqualsSessionUser = (userProvider: (req: WebRequest) => string): Authorization => {
        return (request) => {
            const userId = userProvider(request);
            if (!request.user.userId || !userId) {
                throw new Unauthorized(`Either user.userId ${request.user.userId} or user provided userId ${userId} are not defined`);
            }
            if (request.user.userId !== userId) {
                throw new Unauthorized(`user.userId ${request.user.userId} and user provided userId ${userId} do not match`);
            }
            return Promise.resolve();
        };
    }

    const logAuditLogForUserGroupUpdate = (
        request: WebRequest,
        userGroupAction: UserGroupActionType,
    ) => {
        trackingServiceContract.logAuditLog(
            AuditLogType.USER_GROUP_UPDATE,
            request.user && request.user.userId,
            request.params.accountId,
            request["headers"] && request["headers"]["user-agent"],
            {
                userGroupId: request.params.groupId,
                userId: request.body.userId,
                userGroupAction,
            },
            getClientIps(request),
        );
    };

    const logAuditLogForUserGroupUpdateCallback = (request: WebRequest) => {
        return (
            userGroupAction: UserGroupActionType,
            userGroupId: string,
            userId?: string,
        ) => {
            const { fromUserAgent, fromUserId, fromUserIp } = request.body;
            trackingServiceContract.logAuditLog(
                AuditLogType.USER_GROUP_UPDATE,
                fromUserId || (request.user && request.user.userId),
                request.params.accountId || request.body.accountId,
                fromUserAgent || request["headers"] && request["headers"]["user-agent"],
                {
                    userGroupId,
                    userId,
                    userGroupAction,
                },
                fromUserIp || getClientIps(request),
            );
        };
    };

    const logAuditLogForWhitelistEmailCallback = (request: WebRequest) => {
        return (
            accountId: string,
            domain: string,
            pattern: string,
            activate: boolean,
        ) => {
            const { fromUserAgent, fromUserId, fromUserIp } = request.body;
            trackingServiceContract.logAuditLog(
                AuditLogType.WHITELIST_EMAIL_CHANGED,
                fromUserId || (request.user && request.user.userId),
                accountId,
                fromUserAgent || request["headers"] && request["headers"]["user-agent"],
                {
                    domain,
                    pattern,
                    activate,
                },
                fromUserIp || getClientIps(request),
            );
        }
    };

    const userRecordsFilter = new UserRecordsFilter(userServiceFactory.build(defaultLogger));

    return {
        createUser: {
            ...appRoutes.createUser,
            serviceMethod: withService((service, request) => {
                const { login, displayName, firstName, lastName,
                    type, licenseCount: licenseCountStr,
                    allowDuplicate,
                } = request.body;
                const licenseCount = parseInt(licenseCountStr);
                return service.createUser(
                    login,
                    displayName,
                    firstName,
                    lastName,
                    type,
                    licenseCount || 1,
                    allowDuplicate,
                )
            }),
            authentication: ApplicationToken,
            authorization: AccountAdminParamsOrBodyOrQuery(azContract),
        },
        createDeviceTargetUsers: {
            ...appRoutes.createDeviceTargetUsers,
            serviceMethod: withService((service, request) => {
                const { names, accountId, deviceUserEmail } = request.body;
                return service.createDeviceTargetUsers(names, accountId, deviceUserEmail)
            }),
            authentication: ApplicationToken,
            authorization: MultiAuthorizationAnd([
                loginCannotBeManualToUser("deviceUserEmail"),
                AccountAdminParamsOrBody(azContract),
                loginIsPartOfAccount("deviceUserEmail")
            ])
        },
        assignDeviceTargetUsers: {
            ...appRoutes.assignDeviceTargetUsers,
            serviceMethod: withService((service, request) => {
                const { accountId, deviceUserId, userAndGroupIds, usergroupIntersections } = request.body;
                return service.assignDeviceTargetUsers(accountId, deviceUserId, userAndGroupIds, usergroupIntersections)
            }),
            authentication: ApplicationToken,
            authorization: AccountAdminParamsOrBody(azContract)
        },
        getDeviceTargetUserLinks: {
            ...appRoutes.getDeviceTargetUserLinks,
            serviceMethod: withService((service, request) =>
                service.getDeviceTargetUserLinks(request.params.accountId)
            ),
            authentication: ApplicationToken,
            authorization: MultiAuthorizationAnd([
                AccountFeaturesEnabled(accountService, [FEATURE_DEVICE_USER_IMPERSONATION]),
                accountMember,
            ]),
        },
        getDeviceTargetIds: {
            ...appRoutes.getDeviceTargetIds,
            serviceMethod: withService((service, request) => {
                if (!isBackendSession(request.user) && !request.user.isDeviceUser) {
                    // we can short-circuit here if we already know that the requested user is not a device user (MT-4286)
                    return Promise.resolve([]);
                }
                return service.getDeviceTargetIds(
                    request.params.accountId,
                    request.params.deviceUserId,
                    request.query["expandGroups"] === "true",
                );
            }),
            authentication: ApplicationToken,
            authorization: MultiAuthorizationAnd([
                accountMember,
                UserEqualsSessionUser(req => req.params.deviceUserId)
            ]),
        },
        importUsers: {
            ...appRoutes.importUsers,
            serviceMethod: withService((service, request) =>
                service.importUsers(
                    request.body.users,
                    request.body.accountId,
                    request.body.domain,
                    request.body.usergroupId,
                    request.body.replaceInGroup,
                    request.body.allGroups,
                    request.user && request.user.userId,
                    getClientIps(request),
                    request["headers"] && request["headers"]["user-agent"],
                    logAuditLogForUserGroupUpdateCallback(request),
                )
            ),
            authentication: ApplicationToken,
            authorization: AccountAdminParamsOrBody(azContract)
        },
        importCevaUsers: {
            ...appRoutes.importCevaUsers,
            serviceMethod: withService((service, request) =>
                service.importCevaUsers(
                    request.body.users,
                    request.body.accountId,
                    request.body.replaceUsers,
                    request.user?.userId
                )
            ),
            authentication: ApplicationToken,
            authorization: AccountMemberBody(accountService)
        },
        confirmUser: {
            ...appRoutes.confirmUser,
            serviceMethod: withService((service, request) => service.confirmUser(request.body.login)),
        },
        getPreferences: {
            ...appRoutes.getPreferences,
            serviceMethod: withService((service, request) =>
                service.getPreferences(request.params.userId)
            ),
            authentication: ApplicationToken,
            authorization: MultiAuthorization([userMatch, AccountAdminParamsOrBody(azContract)])
        },
        getPreferencesMulti: {
            ...appRoutes.getPreferencesMulti,
            serviceMethod: withService((service, request) =>
                service.getPreferencesMulti(request.body.userIds)
            ),
        },
        getUser: {
            ...appRoutes.getUser,
            serviceMethod: withService((service, request) =>
                service.getUser(request.params.userId)
            ),
            authentication: ApplicationToken,
            authorization: userRecordsFilter.restrictedUserAccess(req => req.params.userId)
        },
        getUsers: {
            ...appRoutes.getUsers,
            serviceMethod: withService((service, request) =>
                service.getUsers(request.body.ids)
                    .then(userRecordsFilter.filterUsers(request))
            ),
            authentication: ApplicationToken,
            authorization: Allow
        },
        listUsers: {
            ...appRoutes.listUsers,
            serviceMethod: withService((service) => service.listUsers()),
        },
        listUserAccess: {
            ...appRoutes.listUserAccess,
            serviceMethod: withService((service, request) =>
                service.listUserAccess(
                    request.params.accountId,
                    request.params.userId,
                ),
            ),
            authentication: ApplicationToken,
            authorization: MultiAuthorization([userMatch, AccountAdminParamsOrBody(azContract)]),
        },
        getUserByLogin: {
            ...appRoutes.getUserByLogin,
            serviceMethod: withService((service, request) => service.getUserByLogin(request.body.login))
        },
        myDetails: {
            ...appRoutes.myDetails,
            serviceMethod: withService((service, request) => service.myDetails(request.user)),
            authentication: ApplicationToken,
            authorization: Allow
        },
        savePreferences: {
            ...appRoutes.savePreferences,
            serviceMethod: withService((service, request) =>
                service.savePreferences(
                    request.params.userId,
                    request.body.preferences
                )
            ),
            authentication: ApplicationToken,
            authorization: MultiAuthorization([
                userMatch,
                AccountAdminParamsOrBody(azContract)
            ])
        },
        updateUser: {
            ...appRoutes.updateUser,
            serviceMethod: withService((service, request) =>
                service.updateUser(
                    request.body.user,
                    request.body.accountId,
                    isBackendSession(request.user) ? "backend" : request.user.userId
                )
            ),
            authentication: ApplicationToken,
            authorization: Allow,
        },
        whoAmI: {
            ...appRoutes.whoAmI,
            serviceMethod: withService((service, request) => service.whoAmI(request.user)),
            authentication: ApplicationToken,
            authorization: Allow
        },
        updateLastOnline: {
            ...appRoutes.updateLastOnline,
            serviceMethod: withService((service, request) => service.updateLastOnline(request.params.userId)),
        },
        findUserDetailsForIds: {
            ...appRoutes.findUserDetailsForIds,
            serviceMethod: withService((service, request) => service.findUserDetailsForIds(
                request.body.userIds,
                request.body.skipDeleted,
                isBackendSession(request.user) ? "backend" : request.user.userId
            )),
            authentication: ApplicationToken,
            authorization: Allow,
        },
        searchUsersBackend: {
            ...appRoutes.searchUsersBackend,
            serviceMethod: withService((service, request) =>
                service.searchUsersBackend(
                    request.body.query,
                    request.body.options,
                )
            ),
        },
        searchUsergroups: {
            ...appRoutes.searchUsergroups,
            serviceMethod: withService((service, request) =>
                service.searchUsergroups(
                    request.body.query,
                    request.body.options,
                )
            ),
        },
        searchUsers: {
            ...appRoutes.searchUsers,
            serviceMethod: withService((service, request) =>
                service.searchUsers(
                    request.body.query,
                    request.body.options,
                    request.body.accountIds,
                    request.user.userId
                ).then(userRecordsFilter.filterUserSearchResult(request))
            ),
            authentication: ApplicationToken,
            authorization: maybeAuth(
                (req) => req.body.accountIds != null,
                AccountsEditorMember(azContract, req => req.body.accountIds)
            )
        },
        searchUsersByTerm: {
            ...appRoutes.searchUsersByTerm,
            serviceMethod: withService((service, request) =>
                service.searchUsersByTerm(
                    request.params.accountId,
                    request.body.query,
                    request.body.options,
                ).then(userRecordsFilter.filterUserSearchResult(request))
            ),
            authentication: ApplicationToken,
            authorization: accountMember
        },
        searchGroups: {
            ...appRoutes.searchGroups,
            serviceMethod: withService((service, request) =>
                service.searchGroups(
                    request.params.accountId,
                    request.body.query,
                    request.body.options,
                )
            ),
            authentication: ApplicationToken,
            authorization: accountMember
        },
        createGroup: {
            ...appRoutes.createGroup,
            serviceMethod: withService((service, request) => service.createGroup(
                request.params.accountId,
                request.body.name,
                request.body.options,
                logAuditLogForUserGroupUpdateCallback(request),
            )),
            authentication: ApplicationToken,
            authorization: AccountAdminParamsOrBody(azContract)
        },
        getGroups: {
            ...appRoutes.getGroups,
            serviceMethod: withService((service, request) => service.getGroups(request.params.accountId)),
        },
        removeGroup: {
            ...appRoutes.removeGroup,
            serviceMethod: withService((service, request) => service.removeGroup(
                request.params.accountId,
                request.params.groupId,
                logAuditLogForUserGroupUpdateCallback(request),
            )),
            authentication: ApplicationToken,
            authorization: AccountAdminParamsOrBody(azContract)
        },
        updateGroupOwners: {
            ...appRoutes.updateGroupOwners,
            serviceMethod: withService((service, request) =>
                service.updateGroupOwners(
                    request.params.accountId,
                    request.params.groupId,
                    request.body.ownerUserIds,
                )
            ),
            authentication: ApplicationToken,
            authorization: MultiAuthorizationAnd([
                AccountAdminParamsOrBody(azContract),
                AccountFeaturesEnabled(accountService, [FEATURE_GROUP_OWNERS])
            ])
        },
        getManageableGroups: {
            ...appRoutes.getManageableGroups,
            serviceMethod: withService((service, request) =>
                service.getManageableGroups(
                    request.params.accountId,
                    request.body.actorUserId || request.user.userId,
                    request.body.options,
                    request.user.isBackend
                )
            ),
            authentication: ApplicationToken,
            authorization: MultiAuthorizationOr([
                AccountAdminParamsOrBody(azContract),
                MultiAuthorizationAnd([
                    AccountMemberParams(accountService),
                    CurrentUserIsActor(req => req?.body?.actorUserId),
                ])
            ]),
        },
        canBeManagedBy: {
            ...appRoutes.canBeManagedBy,
            serviceMethod: withService((service, request) =>
                service.canBeManagedBy(request.body.managedUserAccountId, request.body.managedUserIds, request.body.groupOwnerId)
            ),
        },
        updateGroupName: {
            ...appRoutes.updateGroupName,
            serviceMethod: withService((service, request) =>
                service.updateGroupName(request.params.accountId, request.params.groupId, request.body.name)
            ),
            authentication: ApplicationToken,
            authorization: AccountAdminParamsOrBody(azContract)
        },
        getGroupMembers: {
            ...appRoutes.getGroupMembers,
            serviceMethod: withService((service, request) =>
                service.getGroupMembers(request.params.accountId, request.params.groupId)
            ),
            authentication: ApplicationToken,
            authorization: CanManageUsergroup(azContract, accountService, req => req.user?.userId, req => req.params.groupId),
        },
        multiGetGroupMembers: {
            ...appRoutes.multiGetGroupMembers,
            serviceMethod: withService((service, request) =>
                service.multiGetGroupMembers(
                    request.params.accountId,
                    request.body.groupIds,
                    request.body.options,
                ).then(userRecordsFilter.filterUsergroupDetails(request))
            ),
            authentication: ApplicationToken,
            authorization: MultiAuthorization([
                AccountAdminParamsOrBody(azContract),
                AccountsEditorMember(azContract, req => [req.params.accountId])
            ])
        },
        multiGetGroupMemberIds: {
            ...appRoutes.multiGetGroupMemberIds,
            serviceMethod: withService((service, request) =>
                service.multiGetGroupMemberIds(request.params.accountId, request.body.groupIds)
            ),
        },
        addGroupMember: {
            ...appRoutes.addGroupMember,
            serviceMethod: withService((service, request) => {
                logAuditLogForUserGroupUpdate(request, UserGroupActionType.USER_GROUP_MEMBER_ADDED);
                return service.addGroupMember(request.params.accountId, request.params.groupId, request.body.userId)
            }),
            authentication: ApplicationToken,
            authorization: CanManageUsergroup(azContract, accountService, req => req.user?.userId, req => req.params.groupId),
        },
        multiAddGroupMembers: {
            ...appRoutes.multiAddGroupMembers,
            serviceMethod: withService((service, request) =>
                service.multiAddGroupMembers(
                    request.params.accountId,
                    request.body.userGroupsQuery,
                    request.body.userIds,
                    request.body.options,
                    logAuditLogForUserGroupUpdateCallback(request),
                ),
            ),
            authentication: ApplicationToken,
            authorization: AccountAdminParamsOrBody(azContract)
        },
        removeGroupMember: {
            ...appRoutes.removeGroupMember,
            serviceMethod: withService((service, request) => {
                logAuditLogForUserGroupUpdate(request, UserGroupActionType.USER_GROUP_MEMBER_REMOVED);
                return service.removeGroupMember(
                    request.params.accountId,
                    request.params.groupId,
                    request.body.userId,
                );
            }),
            authentication: ApplicationToken,
            authorization: CanManageUsergroup(azContract, accountService, req => req.user?.userId, req => req.params.groupId),
        },
        removeUserFromAccountUsergroups: {
            ...appRoutes.removeUserFromAccountUsergroups,
            serviceMethod: withService((service, request) =>
                service.removeUserFromAccountUsergroups(
                    request.params.accountId,
                    request.body.userId,
                    logAuditLogForUserGroupUpdateCallback(request),
                )
            ),
            authentication: ApplicationToken,
            authorization: AccountAdminParamsOrBody(azContract)
        },
        inviteUser: {
            ...appRoutes.inviteUser,
            serviceMethod: withService(async (service, request) => {
                const interfaceLanguage = await getRequestUiLanguageOrUseDefault(
                    request,
                    request.body.accountId,
                    request.body.domain,
                );
                return service.inviteUser(
                    request.body.login,
                    request.body.accountId,
                    request.body.domain,
                    interfaceLanguage,
                );
            }),
            authentication: ApplicationToken,
            authorization: AccountAdminParamsOrBody(azContract)
        },
        getBouncedEmails: {
            ...appRoutes.getBouncedEmails,
            serviceMethod: withService((service, request) =>
                service.getBouncedEmails(request.body.lastDate)
            ),
        },
        checkIfEmailBounced: {
            ...appRoutes.checkIfEmailBounced,
            serviceMethod: withService((service, request) =>
                service.checkIfEmailBounced(request.body.address)
            ),
            authentication: ApplicationToken,
            authorization: AccountAdminParamsOrBody(azContract)
        },
        sendPasswordResetLinkTo: {
            ...appRoutes.sendPasswordResetLinkTo,
            serviceMethod: withService(async (service, request) => {
                const interfaceLanguage = await getRequestUiLanguageOrUseDefault(
                    request,
                    request.body.accountId,
                    request.body.domain
                );
                return service.sendPasswordResetLinkTo(
                    request.body.logins,
                    request.body.accountId,
                    request.body.domain,
                    interfaceLanguage,
                );
            }),
            authentication: ApplicationToken,
            authorization: AccountAdminParamsOrBody(azContract)
        },
        sendPasswordResetLink: {
            ...appRoutes.sendPasswordResetLink,
            serviceMethod: withService(async (service, request) => {
                const interfaceLanguage = await getRequestUiLanguageOrUseDefault(
                    request,
                    request.body.accountId
                );
                return service.sendPasswordResetLink(
                    request.body.logins,
                    request.body.accountId,
                    interfaceLanguage,
                );
            }),
            authentication: ApplicationToken,
            authorization: AccountAdminParamsOrBody(azContract)
        },
        sendMePasswordResetLink: {
            ...appRoutes.sendMePasswordResetLink,
            serviceMethod: withService(async (service, request) => {
                const accountId = request.query.accountId as string;
                let domain = request.query.domain as string;
                if (!domain && accountId) {
                    const [filter] = await routingClient.getDomainFiltersForAccounts([accountId]);
                    domain = filter?.domain;
                }
                const interfaceLanguage = await getRequestUiLanguageOrUseDefault(request, accountId, domain);
                return service.sendMePasswordResetLink(
                    request.body.login,
                    request.body.application,
                    domain,
                    interfaceLanguage,
                );
            }),
            authentication: Public,
            authorization: Allow
        },
        listUserImportActions: {
            ...appRoutes.listUserImportActions,
            serviceMethod: withService((service, request) => service.listUserImportActions(request.params.accountId)),
            authentication: ApplicationToken,
            authorization: CanManageCevaImportActions(azContract, accountService, (req) => req.user.userId),
        },
        getGroupsForUser: {
            ...appRoutes.getGroupsForUser,
            serviceMethod: withService((service, request) =>
                service.getGroupsForUser(request.params.userId, request.params.accountId)
            ),
            authentication: ApplicationToken,
            authorization: MultiAuthorizationAnd([
                accountMember,
                userRecordsFilter.restrictedUserAccess(req => req.params.userId),
            ]),
        },
        getGroupsForUserBackend: {
            ...appRoutes.getGroupsForUserBackend,
            serviceMethod: withService((service, request) => service.getGroupsForUserBackend(request.params.userId)),
        },
        getGroupsForUsers: {
            ...appRoutes.getGroupsForUsers,
            serviceMethod: withService((service, request) =>
                service.getGroupsForUsers(request.body.userIds, request.body.accountId)
            ),
            authentication: ApplicationToken,
            authorization: AccountAdminParamsOrBody(azContract),
        },
        listWhitelistedEmails: {
            ...appRoutes.listWhitelistedEmails,
            serviceMethod: withService((service, request) => {
                const filter =
                    request.params.filter &&
                    request.params.filter !== ":filter" &&
                    (JSON.parse(request.params.filter) as IWhitelistedEmailFilter);
                return service.listWhitelistedEmails(request.params.accountId, filter);
            }),
            authentication: ApplicationToken,
            authorization: AccountAdminParamsOrBody(azContract)
        },
        insertWhitelistedEmail: {
            ...appRoutes.insertWhitelistedEmail,
            serviceMethod: withService((service, request) => service.insertWhitelistedEmail(
                request.params.accountId,
                request.body.domain,
                request.body.pattern,
                logAuditLogForWhitelistEmailCallback(request),
            )),
            authentication: ApplicationToken,
            authorization: AccountAdminParamsOrBody(azContract),
        },
        insertScriptRunStat: {
            ...appRoutes.insertScriptRunStat,
            serviceMethod: withService((service, request) => service.insertScriptRunStat(request.body.scriptName, request.body.data)),
        },
        getLatestScriptStats: {
            ...appRoutes.getLatestScriptStats,
            serviceMethod: withService((service, request) => service.getLatestScriptStats(request.params.scriptName)),
        },
        setWhitelistedEmailActive: {
            ...appRoutes.setWhitelistedEmailActive,
            serviceMethod: withService((service, request) => service.setWhitelistedEmailActive(
                request.params.id,
                request.body.active,
                request.body.accountId,
                logAuditLogForWhitelistEmailCallback(request),
            )),
            authentication: ApplicationToken,
            authorization: AccountAdminParamsOrBody(azContract),
        },
        requestInvitation: {
            ...appRoutes.requestInvitation,
            serviceMethod: withService((service, request) => service.requestInvitation(
                request.body.accountId,
                request.body.domain,
                request.body.email,
                request.body.interfaceLanguage,
                request.body.fromUserAgent || request["headers"] && request["headers"]["user-agent"],
                request.body.fromUserId || (request.user && request.user.userId),
                request.body.fromUserIp || getClientIps(request),
            )),
            authentication: Public,
            authorization: Allow
        },
        saveTermsAcceptance: {
            ...appRoutes.saveTermsAcceptance,
            serviceMethod: withService((service, request) => service.saveTermsAcceptance(
                request.body.userId,
                request.body.accountId,
                request.body.version,
            )),
            authentication: ApplicationToken,
            authorization: Allow
        },
        getTermsInfo: {
            ...appRoutes.getTermsInfo,
            serviceMethod: withService((service, request) => service.getTermsInfo(
                request.params.accountId,
            )),
            authentication: ApplicationToken,
            authorization: Allow
        },
        deleteUser: {
            ...appRoutes.deleteUser,
            serviceMethod: withService((service, request) =>
                service.deleteUser(
                    request.params.userId
                )
            ),
        },
        multiGetUsersAndGroups: {
            ...appRoutes.multiGetUsersAndGroups,
            serviceMethod: withService((service, request) =>
                service.multiGetUsersAndGroups(
                    request.body.accountId,
                    request.body.ids,
                    request.body.includeDeleted
                ).then(userRecordsFilter.filterUsersOrUsergroups(request))
            ),
            authentication: ApplicationToken,
            authorization: Allow,
        },
        insertUserTag: {
            ...appRoutes.insertUserTag,
            serviceMethod: withService((service, request) =>
                service.insertUserTag(
                    request.body.userTag,
                    request.body.options,
                )
            ),
        },
        getUserTags: {
            ...appRoutes.getUserTags,
            serviceMethod: withService((service, request) =>
                service.getUserTags(
                    request.params.userId,
                    request.body.filter
                )
            )
        },
        getUsersCreatedPerMonth: {
            ...appRoutes.getUsersCreatedPerMonth,
            serviceMethod: withService((service) =>
                service.getUsersCreatedPerMonth()
            ),
        },
        getAccountIdsForGroups: {
            ...appRoutes.getAccountIdsForGroups,
            serviceMethod: withService((service, request) =>
                service.getAccountIdsForGroups(request.body.groupIds)
            ),
        },
        createUserWithCredentials: {
            ...appRoutes.createUserWithCredentials,
            serviceMethod: withService(
                (service, request) => {
                    const login = request.body.login;
                    const displayName = request.body.displayName;
                    const clearTextPassword = request.body.clearTextPassword;
                    const accountId = `${request.query.accountId}`;
                    return service.createUserWithCredentials(login, displayName, clearTextPassword, accountId);
                }
            ),
            authentication: ApplicationToken,
            authorization: AccountAdminParamsOrBodyOrQuery(azContract),
        },
        createHubspotIdentifyToken: {
            ...appRoutes.createHubspotIdentifyToken,
            serviceMethod: withService((service, request) =>
                service.createHubspotIdentifyToken(request.user.userId)),
            authentication: ApplicationToken,
            authorization: Allow,
        },
        getMockedEmails: {
            ...appRoutes.getMockedEmails,
            serviceMethod: withService(
                (service, request) => {
                    const targetEmail = request.params.targetEmail;
                    return service.getMockedEmails(targetEmail);
                }
            ),
        },
        syncEntraGroupMembers: {
            ...appRoutes.syncEntraGroupMembers,
            serviceMethod: withService(
                (service, request) => {
                    const accountId = request.body.accountId;
                    const options = request.body.options;
                    return service.syncEntraGroupMembers(accountId, options);
                }
            ),
        }
    };
}
