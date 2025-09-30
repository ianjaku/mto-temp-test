import {
    AccountAdminBody,
    AccountAdminParams,
    AccountMemberBody,
    Allow,
    Authorization,
    BindersMediaAdmin,
    MultiAuthorizationAnd,
    MultiAuthorizationOr,
    UserIdFromBody,
    UserIdFromRequest,
    verifyActorIsAdminOnAllChangedUserAccounts
} from "@binders/binders-service-common/lib/middleware/authorization";
import {
    ApplicationToken,
    Public
} from "@binders/binders-service-common/lib/middleware/authentication";
import {
    AuditLogType,
    PasswordChangeAuditLogData,
    PasswordChangeTrigger,
    TrackingServiceContract
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { CredentialService, CredentialServiceFactory } from "./service";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import {
    AuthorizationServiceContract
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import {
    CredentialServiceContract
} from "@binders/client/lib/clients/credentialservice/v1/contract";
import {
    FEATURE_DEVICE_LOGIN_PASSWORD
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { ServiceRoute } from "@binders/binders-service-common/lib/middleware/app";
import { Unauthorized } from "@binders/client/lib/clients/model";
import { UserServiceContract } from "@binders/client/lib/clients/userservice/v1/contract";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import {
    getRoutes as getAppRoutes
} from "@binders/client/lib/clients/credentialservice/v1/routes";
import { getClientIps } from "@binders/binders-service-common/lib/util/ip";
import { isManualToLogin } from "@binders/client/lib/util/user";

export function getServiceRoutes(
    credentialServiceFactory: CredentialServiceFactory,
    azClient: AuthorizationServiceContract,
    userServiceClient: UserServiceContract,
    accountClient: AccountServiceClient,
    trackingServiceClient: TrackingServiceContract
): { [name in keyof CredentialServiceContract]: ServiceRoute } {
    function withService<T>(
        f: (service: CredentialService, request: WebRequest) => Promise<T>
    ): (request: WebRequest) => Promise<T> {
        return function(request: WebRequest) {
            const service = credentialServiceFactory.forRequest(request.logger);
            return f(service, request);
        };
    }

    async function savePasswordChangeToAuditLog(
        trigger: PasswordChangeTrigger,
        actorId: string,
        subjectId: string,
        request: WebRequest,
        accountId?: string
    ) {
        const data: PasswordChangeAuditLogData = {
            trigger,
            requestedByUserId: actorId,
        }

        trackingServiceClient.logAuditLog(
            AuditLogType.PASSWORD_CHANGE,
            subjectId,
            accountId,
            request.body.fromUserAgent || request?.["headers"]?.["user-agent"],
            data,
            request.body.fromUserIp || getClientIps(request),

        );
    }

    const validateUserId: Authorization = (request) => {
        if (request.user && (request.user.userId === request.params.userId)) {
            return Promise.resolve();
        }
        throw new Unauthorized("Can only change your password when logged in.");
    };

    const UserIsDevice: Authorization = async (request: WebRequest) => {
        if (!(request.user.isDeviceUser)) {
            return Promise.reject(`${JSON.stringify(request.user)} is not a device user`);
        }
        return Promise.resolve();
    }

    const CEVAChangeOtherUserPassword: Authorization = async (request) => {
        if (!request.body.accountId) {
            throw new Unauthorized("No accountId found");
        }
        if (request.user?.userId == null) {
            throw new Unauthorized("No user session found.");
        }
        const deviceUserTargetId = request.body.userId;

        const employeeIdTags = await userServiceClient.getUserTags(deviceUserTargetId, { context: "ceva", name: "employeeId" });
        if (employeeIdTags.length === 0) {
            throw new Unauthorized(`User ${deviceUserTargetId} is not a CEVA user, because it does not have an employeeId`);
        }

        // Actor is Device User with user (or its group) as target
        const deviceUserTargets = await userServiceClient.getDeviceTargetIds(request.body.accountId, request.user.userId, true);
        if (deviceUserTargets.includes(deviceUserTargetId)) {
            return;
        }

        // Actor is Group Owner
        const canBeManagedByResponse = await userServiceClient.canBeManagedBy(
            request.body.accountId,
            [deviceUserTargetId],
            request.user.userId
        );
        if (!canBeManagedByResponse[deviceUserTargetId]) {
            throw new Unauthorized(`User ${request.user.userId} is not allowed to manage user with id: ${deviceUserTargetId}`);
        }
    }

    const DeviceTargetUserPasswordValid: Authorization = async (request: WebRequest) => {
        const features = await accountClient.getAccountFeatures(request.body.accountId);
        if (!features.includes(FEATURE_DEVICE_LOGIN_PASSWORD)) return;
        if (request.body.password == null) throw new Unauthorized("Password is required");
        const user = await userServiceClient.getUser(request.body.userId);
        if (user == null) throw new Unauthorized(`User ${request.user.userId} does not exist`);
        const service = credentialServiceFactory.forRequest(request.logger);
        const passwordValid = await service.verifyPassword(user.login, request.body.password);
        if (!passwordValid) throw new Unauthorized("Invalid password");
    }

    const IsDeviceAndBodyUserEqualsSessionUser: Authorization = (request: WebRequest) => {
        if (!request.user.isDeviceUser) {
            return Promise.reject(`${JSON.stringify(request.user)} is not a device user`);
        }
        if (!request.user.userId || !request.body.userId) {
            return Promise.reject(`Either user.userId ${request.user.userId} or body.userId ${request.body.userId} are not defined`);
        }
        if (request.user.userId != request.body.userId) {
            throw new Unauthorized(`user.userId ${request.user.userId} and body.userId ${request.user.userId} do not match`)
        }
        return Promise.resolve();
    }

    async function deviceUserContainsTargetUser(
        accountId: string,
        deviceUserId: string,
        requestedTargetId: string,
    ): Promise<void> {
        const targetUserIds = await userServiceClient.getDeviceTargetIds(accountId, deviceUserId, true);
        if (!(targetUserIds.includes(requestedTargetId))) {
            throw new Unauthorized(`User ${deviceUserId} is not allowed to impersonate ${requestedTargetId} because it is not in the list of its targets ${JSON.stringify(targetUserIds)}`);
        }
    }

    async function targetUserIsNotManualTo(
        requestedTargetId: string,
    ): Promise<void> {
        const users = await userServiceClient.findUserDetailsForIds([requestedTargetId]);
        if (!users.length) {
            throw new Error(`User ${requestedTargetId} not found`);
        }
        if (isManualToLogin(users[0].login)) {
            throw new Unauthorized("Manual.to users cannot be impersonated");
        }
    }

    function deviceCanImpersonateTarget(targetUserIdResolver: (req: WebRequest) => string): Authorization {
        return async (request: WebRequest) => {
            const accountId = request.body.accountId || request.params.accountId || request.query.accountId;
            const deviceUserId = request.user.userId;
            const requestedTargetId = targetUserIdResolver(request);
            try {
                await deviceUserContainsTargetUser(accountId, deviceUserId, requestedTargetId);
                await targetUserIsNotManualTo(requestedTargetId);
            } catch (e) {
                return Promise.reject(e.message);
            }
            return Promise.resolve();
        };
    }

    async function mustBeAdminOnAllUserAccounts(request: WebRequest): Promise<void> {
        return verifyActorIsAdminOnAllChangedUserAccounts(
            accountClient,
            request.body.userId,
            request.user?.userId
        )
    }

    const appRoutes = getAppRoutes();

    return {
        createCredential: {
            ...appRoutes.createCredential,
            serviceMethod: withService((service, request) => {
                const onSuccess = () => savePasswordChangeToAuditLog(
                    PasswordChangeTrigger.INITIAL_CREATION,
                    request.user.userId || request.params.userId,
                    request.params.userId,
                    request
                );
                return service.createCredential(
                    request.params.userId,
                    request.body.login,
                    request.body.password,
                    onSuccess
                );
            }),
            authentication: ApplicationToken,
            authorization: validateUserId
        },
        createOneTimeToken: {
            ...appRoutes.createOneTimeToken,
            serviceMethod: withService((service, request) =>
                service.createOneTimeToken(request.body.userId, request.body.days)),
            authentication: ApplicationToken,
            authorization: MultiAuthorizationOr([
                BindersMediaAdmin(azClient),
                MultiAuthorizationAnd([
                    IsDeviceAndBodyUserEqualsSessionUser,
                    AccountMemberBody(accountClient),
                ])
            ])
        },
        createUrlToken: {
            ...appRoutes.createUrlToken,
            serviceMethod: withService((service, request) => service.createUrlToken(request.body.tokenAcl, request.body.days)),
        },
        loginWithToken: {
            ...appRoutes.loginWithToken,
            serviceMethod: withService((service, request) => service.loginWithToken(request.body.token)),
        },
        getUsersTokens: {
            ...appRoutes.getUsersTokens,
            serviceMethod: withService((service, request) => service.getUsersTokens(request.body.userIds)),
        },
        getToken: {
            ...appRoutes.getToken,
            serviceMethod: withService((service, request) => service.getToken(request.body.key)),
        },
        loginWithPassword: {
            ...appRoutes.loginWithPassword,
            serviceMethod: withService((service, request) => {
                return service.loginWithPassword(request.body.login, request.body.password, request.body.userAgent, request.body.disableConcurrentLogins);
            }),
            authentication: Public,
            authorization: Allow
        },
        loginWithUserToken: {
            ...appRoutes.loginWithUserToken,
            serviceMethod: withService((service, request) => {
                return service.loginWithUserToken(
                    request.body.userToken,
                    request.body.accountId,
                    request.body.userAgent,
                    request.body.clientIp,
                );
            }),
            authentication: Public,
            authorization: Allow
        },
        updatePassword: {
            ...appRoutes.updatePassword,
            serviceMethod: withService((service, request) => {
                const body = request.body;
                const onSuccess = () => savePasswordChangeToAuditLog(
                    PasswordChangeTrigger.WITH_OLD_PASSWORD,
                    request.user.userId || request.params.userId,
                    request.params.userId,
                    request
                );
                return service.updatePassword(
                    request.params.userId,
                    body.login,
                    body.oldPassword,
                    body.newPassword,
                    onSuccess
                );
            }),
            authentication: ApplicationToken,
            authorization: validateUserId
        },
        createOrUpdateCredentialForUser: {
            ...appRoutes.createOrUpdateCredentialForUser,
            serviceMethod: withService((service, request) => {
                const onSuccess = () => (
                    savePasswordChangeToAuditLog(
                        PasswordChangeTrigger.BY_GROUP_OWNER,
                        request.user.userId,
                        request.body.userId,
                        request,
                        request.body.accountId
                    )
                );
                return service.createOrUpdateCredentialForUser(
                    request.body.accountId,
                    request.body.userId,
                    request.body.login,
                    request.body.plainTextPassword,
                    request.user?.userId,
                    onSuccess,
                );
            }),
            authentication: ApplicationToken,
            authorization: CEVAChangeOtherUserPassword,
        },
        getCredentialStatusForUsers: {
            ...appRoutes.getCredentialStatusForUsers,
            serviceMethod: withService((service, request) => {
                return service.getCredentialStatusForUsers(
                    request.body.accountId,
                    request.body.userIds,
                    request.user.userId);
            }),
            authentication: ApplicationToken,
            authorization: Allow,
        },
        verifyPassword: {
            ...appRoutes.verifyPassword,
            serviceMethod: withService((service, request) => {
                return service.verifyPassword(
                    request.body.login,
                    request.body.password
                );
            }),
            authentication: ApplicationToken,
            authorization: Allow,
        },
        hasPassword: {
            ...appRoutes.hasPassword,
            serviceMethod: withService((service, request) => {
                return service.hasPassword(request.body.userId);
            }),
        },
        resetPassword: {
            ...appRoutes.resetPassword,
            serviceMethod: withService((service, request) => {
                const onSuccess = (userId: string) => savePasswordChangeToAuditLog(
                    PasswordChangeTrigger.WITH_TOKEN,
                    userId,
                    userId,
                    request
                );
                return service.resetPassword(
                    request.body.token,
                    request.body.login,
                    request.body.newPassword,
                    request.body.accountId,
                    onSuccess
                );
            }),
        },
        loginByADIdentity: {
            ...appRoutes.loginByADIdentity,
            serviceMethod: withService((service, request) =>
                service.loginByADIdentity(request.body.nameID, request.body.userAgent, request.body.tenantId)
            ),
        },
        loginByAuthenticatedUserId: {
            ...appRoutes.loginByAuthenticatedUserId,
            serviceMethod: withService((service, request) =>
                service.loginByAuthenticatedUserId(request.body.userId, request.body.userAgent)
            ),
        },
        saveADIdentityMapping: {
            ...appRoutes.saveADIdentityMapping,
            serviceMethod: withService((service, request) =>
                service.saveADIdentityMapping(request.body.nameID, request.body.userId)
            ),
        },
        getADIdentityMappings: {
            ...appRoutes.getADIdentityMappings,
            serviceMethod: withService((service, request) =>
                service.getADIdentityMappings(request.body.userIds),
            ),
        },
        saveADGroupMapping: {
            ...appRoutes.saveADGroupMapping,
            serviceMethod: withService((service, request) =>
                service.saveADGroupMapping(request.body.ADGroupId, request.body.groupId, request.body.accountId)
            ),
            authentication: ApplicationToken,
            authorization: AccountAdminBody(azClient)
        },
        getGroupId: {
            ...appRoutes.getGroupId,
            serviceMethod: withService((service, request) =>
                service.getGroupId(request.params.ADGroupId, request.params.accountId)
            ),
        },
        getAllADGroupMappings: {
            ...appRoutes.getAllADGroupMappings,
            serviceMethod: withService((service, request) =>
                service.getAllADGroupMappings(request.params.accountId)
            ),
            authentication: ApplicationToken,
            authorization: AccountAdminParams(azClient)
        },
        saveCertificate: {
            ...appRoutes.saveCertificate,
            serviceMethod: withService((service, request) =>
                service.saveCertificate(
                    request.body.tenantId,
                    request.body.certificate,
                    request.body.filename,
                    request.body.accountId
                )
            ),
            authentication: ApplicationToken,
            authorization: AccountAdminBody(azClient)
        },
        updateCertificateAccountId: {
            ...appRoutes.updateCertificateAccountId,
            serviceMethod: withService((service, request) =>
                service.updateCertificateAccountId(
                    request.body.tenantId,
                    request.body.certificate,
                    request.body.filename,
                    request.body.accountId
                )
            ),
        },
        getAllCertificates: {
            ...appRoutes.getAllCertificates,
            serviceMethod: withService((service) =>
                service.getAllCertificates()
            ),
        },
        getCertificate: {
            ...appRoutes.getCertificate,
            serviceMethod: withService((service, request) =>
                service.getCertificate(request.params.accountId)
            ),
            authentication: ApplicationToken,
            authorization: AccountAdminParams(azClient)
        },
        updateCertificateTenantId: {
            ...appRoutes.updateCertificateTenantId,
            serviceMethod: withService((service, request) =>
                service.updateCertificateTenantId(
                    request.body.accountId,
                    request.body.tenantId,
                )
            ),
            authentication: ApplicationToken,
            authorization: AccountAdminBody(azClient)
        },
        getImpersonatedSession: {
            ...appRoutes.getImpersonatedSession,
            serviceMethod: withService((service, request) =>
                service.getImpersonatedSession(
                    request.body.userId,
                    request.body.accountId,
                    request.user.userId,
                    request.user.isDeviceUser
                )
            ),
            authentication: ApplicationToken,
            authorization: MultiAuthorizationOr([
                BindersMediaAdmin(azClient),
                MultiAuthorizationAnd([
                    UserIsDevice,
                    deviceCanImpersonateTarget(req => req.body.userId),
                    // Impersonated user must be in the same account as requester
                    AccountMemberBody(accountClient, UserIdFromRequest),
                    AccountMemberBody(accountClient, UserIdFromBody),
                    DeviceTargetUserPasswordValid
                ]),
            ])
        },
        getBrowserUsageReport: {
            ...appRoutes.getBrowserUsageReport,
            serviceMethod: withService((service, request) =>
                service.getBrowserUsageReport(
                    request.query.daysAgo && parseInt(request.query.daysAgo as string, 10)
                )
            ),
        },
        anonymizeCredential: {
            ...appRoutes.anonymizeCredential,
            serviceMethod: withService((service, request) =>
                service.anonymizeCredential(request.params.userId)
            ),
        },
        updateLogin: {
            ...appRoutes.updateLogin,
            serviceMethod: withService((service, request) =>
                service.updateLogin(request.params.userId, request.body.login)),
        },
        createUserAccessToken: {
            ...appRoutes.createUserAccessToken,
            serviceMethod: withService((service, request) =>
                service.createUserAccessToken(
                    request.body.sessionId,
                    request.body.userId,
                    request.body.accountIds,
                    request.body.isDeviceUser,
                    request.body.deviceUserId,
                )
            ),
        },
        endSessionsForUser: {
            ...appRoutes.endSessionsForUser,
            serviceMethod: withService((service, request) =>
                service.endSessionsForUser(request.body.query)
            ),
        },
        updatePasswordByAdmin: {
            ...appRoutes.updatePasswordByAdmin,
            serviceMethod: withService(
                (service, request) => {
                    const actorId = request.user.userId;
                    const userId = request.body.userId;
                    const newPassword = request.body.newPassword;
                    const onSuccess = () => savePasswordChangeToAuditLog(
                        PasswordChangeTrigger.BY_ADMIN,
                        actorId,
                        userId,
                        request
                    );
                    return service.updatePasswordByAdmin(
                        userId,
                        newPassword,
                        request.body.accountId,
                        request.user.userId,
                        onSuccess
                    );
                }
            ),
            authentication: ApplicationToken,
            authorization: mustBeAdminOnAllUserAccounts
        },
        extendSession: {
            ...appRoutes.extendSession,
            serviceMethod: withService(
                (service, request) => {
                    return service.extendSession(
                        request.body.accountId,
                        request.user.sessionId
                    );
                }
            ),
            authentication: ApplicationToken,
            authorization: Allow
        },
        hasSessionExpired: {
            ...appRoutes.hasSessionExpired,
            serviceMethod: withService(
                (service, request) => {
                    return service.hasSessionExpired(
                        request.body.accountId,
                        request.user.sessionId,
                        request.user.userId
                    );
                }
            ),
            authentication: ApplicationToken,
            authorization: Allow
        },
        deleteADIdentityMappingForUsers: {
            ...appRoutes.deleteADIdentityMappingForUsers,
            serviceMethod: withService(
                (service, request) => {
                    const accountId = request.body.accountId;
                    const userIds = request.body.userIds;
                    return service.deleteADIdentityMappingForUsers(accountId, userIds);
                }
            ),
        }
    };
}
