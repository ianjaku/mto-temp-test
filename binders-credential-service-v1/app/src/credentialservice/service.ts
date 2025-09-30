import {
    ADGroupMappingRepository,
    IADGroupMapping,
    MongoADGroupMappingRepositoryFactory
} from "./repositories/ADGroupMapping";
import {
    ADIdentityMappingRepository,
    MongoADIdentityMappingRepositoryFactory
} from "./repositories/ADIdentityMapping";
import {
    ActiveSessionRepository,
    ActiveSessionRepositoryFactory
} from "./repositories/activeSessions";
import {
    AuthenticatedSession,
    IdentityProviderKind,
    Unauthorized
} from "@binders/client/lib/clients/model";
import {
    AzureSSONotConfigured,
    CredentialStatus,
    CredentialStatusForUsers,
    ExpiredSessionError,
    IBrowserInfoReport,
    IFindSessionQuery,
    InvalidPassword,
    InvalidUser,
    TokenType,
    UserIdWithToken
} from "@binders/client/lib/clients/credentialservice/v1/contract";
import {
    CertificateRepository,
    ICertificateDAO,
    MongoCertificateRepositoryFactory
} from "./repositories/ADCertificates";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import {
    CredentialsRepository,
    MongoCredentialRepositoryFactory
} from "./repositories/credentials";
import {
    GenericToken,
    OneTimeLoginToken,
    TokenVerifier,
    UrlToken,
    UserToken
} from "@binders/binders-service-common/lib/tokens";
import { IFailedLoginCircuitBreaker, buildLoginCircuitBreaker } from "./failedLoginCircuitBreaker";
import { InvalidToken, LoginAndPassword, LoginNotFound, UserIdNotFound } from "./model";
import {
    JWTSignConfig,
    buildAccessTokenSignConfig,
    buildBackendSignConfig,
    buildSignConfig,
    buildVerifyConfig,
    buildVerifyConfigFromSecretWithoutIssuer,
    signJWT
} from "@binders/binders-service-common/lib/tokens/jwt";
import { Logger, LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import {
    Login,
    SessionIdentifier,
    UserIdentifier
} from "@binders/binders-service-common/lib/authentication/identity";
import {
    MongoSessionRepository,
    MongoSessionRepositoryFactory,
    MultiSessionRepository
} from "./repositories/sessionRepository";
import { MongoTokenRepositoryFactory, TokenRepository } from "./repositories/tokens";
import {
    MongoUserTokenImpersonatedUserRepositoryFactory,
    UserTokenImpersonatedUserRepository
} from "./repositories/userTokenImpersonatedUsers";
import {
    NotificationServiceContract,
    RoutingKeyType,
    ServiceNotificationType
} from "@binders/client/lib/clients/notificationservice/v1/contract";
import { RedisClient, RedisClientBuilder } from "@binders/binders-service-common/lib/redis/client";
import {
    RedisSessionRepository,
    SessionRepository
} from "@binders/binders-service-common/lib/authentication/sessionrepository";
import { User, UserType } from "@binders/client/lib/clients/userservice/v1/contract";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import {
    AuthorizationServiceClient
} from "@binders/client/lib/clients/authorizationservice/v1/client";
import { BCryptPasswordHash } from "./bcrypthash";
import { Config } from "@binders/client/lib/config/config";
import { MailgunMailer } from "@binders/binders-service-common/lib/mail/mailgun";
import { NodeClientHandler } from "@binders/binders-service-common/lib/apiclient/nodeclient";
import {
    NotificationServiceClient
} from "@binders/client/lib/clients/notificationservice/v1/client";
import { ReaderBranding } from "@binders/client/lib/clients/routingservice/v1/contract";
import { RoutingServiceClient } from "@binders/client/lib/clients/routingservice/v1/client";
import { Session } from "./models/session";
import { TranslationKeys as TK } from "@binders/client/lib/i18n/translations";
import TokenAcl from "@binders/client/lib/clients/authorizationservice/v1/tokenacl";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import autobind from "class-autobind";
import { buildGenericMailMessage } from "@binders/binders-service-common/lib/mail/templates";
import i18next from "@binders/client/lib/react/i18n";
import { intersection } from "ramda";
import { isManualToLogin } from "@binders/client/lib/util/user";
import moment from "moment";
import { validateEmailInput } from "@binders/client/lib/clients/validation";

function isOneTimeLogin(token: GenericToken): token is OneTimeLoginToken {
    return token.type === TokenType.ONE_TIME_LOGIN;
}

export class CredentialService  {

    async anonymizeCredential(userId: string): Promise<void> {
        await this.updateLogin(userId, `${userId}@anonymous.manual.to`);
    }

    async updateLogin(userId: string, login: string): Promise<void> {
        try {
            await this.credentialRepository.updateLogin(userId, login);
            this.endAllSessionsForUser(userId, {});
        } catch (error) {
            if (error instanceof UserIdNotFound) {
                this.logger.warn(`Could not find ${userId}`, "updateLogin");
            } else {
                this.logger.error(`Failed on update credentials for ${userId} to ${login}. Reason ${error.message}`, "updateLogin");
            }
            throw error;
        }
    }

    async resetPassword(
        token: string,
        login: string,
        newPassword: string,
        accountId: string,
        onSuccess?: (userId: string) => Promise<void>
    ): Promise<AuthenticatedSession> {
        const inflatedToken = await this.tokenVerifier.inflate(token);
        if (!isOneTimeLogin(inflatedToken) || !inflatedToken.isValid()) {
            throw new InvalidToken("Invalid token.");
        }
        const userId = inflatedToken.data.userId;
        const userIdObject = new UserIdentifier(userId);
        let userExists = false;
        try {
            await this.credentialRepository.getLoginFromUserId(userIdObject);
            userExists = true;
        } catch (error) {
            if (!error.message.endsWith("not found")) {
                throw error;
            }
        }
        await this.insertCredentialOrUpdatePassword(userId, login, newPassword, userExists, accountId);
        if (onSuccess) {
            onSuccess(userId);
        }

        const consumedToken = inflatedToken.consume();
        await this.tokenRepository.saveToken(consumedToken);
        return this.doLogin(userIdObject, "token", { disableConcurrentLogins: true });
    }

    private async sendPasswordChangedEmail(
        targetUser: User,
        accountId?: string
    ): Promise<void> {
        try {
            let domain: string;
            let readerBranding: ReaderBranding;
            if (accountId) {
                const domainFilters = await this.routingClient.getDomainFiltersForAccounts([ accountId ]);
                domain = domainFilters[0]?.domain;
                readerBranding = await this.routingClient.getBrandingForReaderDomain(domain);
            }
            const message = buildGenericMailMessage(
                targetUser,
                i18next.t(TK.User_PasswordChangedEmailSubject),
                [
                    i18next.t(TK.User_PasswordChangedEmailBody1),
                    i18next.t(TK.User_PasswordChangedEmailBody2),
                ],
                domain,
                readerBranding,
            );
            await this.mailer.sendMessage(message);
        } catch (e) {
            this.logger.error(`Failed to send password change email to ${targetUser.login}`, "password-change-email");
        }
    }

    getToken(token: string): Promise<GenericToken> {
        return this.tokenRepository.getToken(token);
    }

    createOneTimeToken(userId: string, days: number): Promise<string> {
        const now = moment();
        const expirationMoment = now.add(days, "days");
        const repo = this.tokenRepository;
        return OneTimeLoginToken.build(this.jwtConfig, userId, expirationMoment.toDate()).then(token => {
            return repo.saveToken(token).then(() => token.key);
        });
    }

    async createUrlToken(tokenAcl: TokenAcl, days: number): Promise<string> {
        const now = moment();
        const expirationMoment = now.add(days, "days");
        const token = await UrlToken.build(this.jwtConfig, tokenAcl, expirationMoment.toDate());
        return token.key;
    }

    async loginWithToken(token: string): Promise<AuthenticatedSession> {
        const inflatedToken = await this.tokenRepository.getToken(token);
        if (inflatedToken.type !== TokenType.ONE_TIME_LOGIN) {
            throw new InvalidToken("Invalid token type.");
        }
        if (!inflatedToken.isValid()) {
            throw new InvalidToken("Token invalid.");
        }
        const userId = UserIdentifier.from((<OneTimeLoginToken>inflatedToken).data.userId);
        return this.doLogin(userId, "token");
    }

    async getImpersonatedSession(
        targetUserId: string,
        accountId?: string,
        currentUserId?: string,
        currentUserIsDeviceUser?: boolean
    ): Promise<AuthenticatedSession> {
        const isAdmin = await this.authorizationServiceClient.canAccessBackend(currentUserId);

        const options = {
            ...(isAdmin ? {} : { restrictedToAccountIds: [accountId] }),
            ...(currentUserIsDeviceUser ? { deviceUserId: currentUserId } : {})
        }

        return this.doLogin(
            new UserIdentifier(targetUserId),
            "impersonation",
            options
        );
    }

    getUsersTokens(userIds: string[]): Promise<UserIdWithToken[]> {
        return this.tokenRepository.getTokensForUsers(userIds);
    }

    constructor(
        private credentialRepository: CredentialsRepository,
        private accountServiceClient: AccountServiceClient,
        private userServiceClient: UserServiceClient,
        private authorizationServiceClient: AuthorizationServiceClient,
        private tokenRepository: TokenRepository,
        private sessionRepository: SessionRepository,
        private adIdentityMappingRepository: ADIdentityMappingRepository,
        private adGroupMappingRepository: ADGroupMappingRepository,
        private certificateRepository: CertificateRepository,
        private userTokenImpersonatedUserRepository: UserTokenImpersonatedUserRepository,
        private activeSessionsRepository: ActiveSessionRepository,
        private tokenVerifier: TokenVerifier,
        private logger: Logger,
        private jwtConfig: JWTSignConfig,
        private accessTokenJwtConfig: JWTSignConfig,
        private loginCircuitBreaker: IFailedLoginCircuitBreaker,
        private mongoSessionRepo: MongoSessionRepository,
        private notificationServiceClient: NotificationServiceContract,
        private routingClient: RoutingServiceClient,
        private mailer: MailgunMailer
    ) {
        autobind(this);
    }

    async createCredential(
        userId: string,
        login: string,
        clearTextPassword: string,
        onSuccess?: () => Promise<void>
    ): Promise<void> {
        await this.insertCredentialOrUpdatePassword(userId, login, clearTextPassword, false);
        onSuccess();
    }

    private async insertCredentialOrUpdatePassword(
        userId: string,
        login: string,
        clearTextPassword: string,
        isExistingUser?: boolean,
        accountId?: string
    ): Promise<void> {
        const passwordHash = await BCryptPasswordHash.create(clearTextPassword);
        const userIdObject = new UserIdentifier(userId);
        const loginObject = new Login(login);
        const loginAndPassword = new LoginAndPassword(userIdObject, false, loginObject, passwordHash, new Date());
        if (isExistingUser) {
            await this.credentialRepository.updatePassword(loginAndPassword);
        } else {
            await this.credentialRepository.insertLoginAndPassword(loginAndPassword);
        }

        if (isExistingUser) {
            const user = await this.userServiceClient.getUser(userId);
            await this.sendPasswordChangedEmail(user, accountId);
        }
    }

    async getCredentialStatusForUsers(accountId: string, userIds: string[], actorId?: string): Promise<CredentialStatusForUsers> {
        const usersAccessibleToActor = await this.getUsersWithActorAccessStatus(actorId, accountId, userIds);
        const usersThatCanBeManagedByActor = userIds.filter(userId => usersAccessibleToActor[userId] ?? false);
        const userIdsToLogins = await this.credentialRepository.getLoginsFromUserIds(usersThatCanBeManagedByActor);
        const userIdStatusPairs = userIds.map(userId => {
            let status = CredentialStatus.UNKNOWN;
            if (usersAccessibleToActor[userId]) {
                status = userIdsToLogins.has(userId) ? CredentialStatus.PASSWORD_SET : CredentialStatus.NO_PASSWORD;
            }
            return [userId, status];
        });
        return Object.fromEntries(userIdStatusPairs);
    }

    private async getUsersWithActorAccessStatus(actorId: string, accountId: string, userIds: string[]): Promise<{[userId: string]: boolean|null}> {
        if (await this.isActorDeviceUser(actorId)) {
            const deviceUserTargetUserIds = await this.userServiceClient.getDeviceTargetIds(accountId, actorId, true)
            return Object.fromEntries(deviceUserTargetUserIds.map(u => [u, true]));
        }
        return await this.userServiceClient.canBeManagedBy(accountId, userIds, actorId);
    }

    private async isActorDeviceUser(actorId: string): Promise<boolean> {
        const requestingUser = await this.userServiceClient.getUser(actorId);
        const userType = Number.parseInt(requestingUser.type as unknown as string);
        return userType === UserType.Device;
    }

    saveCertificate(tenantId: string, certificate: string, filename: string, accountId: string): Promise<ICertificateDAO> {
        return this.certificateRepository.saveCertificate(tenantId, certificate, filename, accountId);
    }
    updateCertificateAccountId(tenantId: string, certificate: string, filename: string, accountId: string): Promise<ICertificateDAO> {
        return this.certificateRepository.updateCertificateAccountId(tenantId, certificate, filename, accountId);
    }

    getCertificate(accountId: string): Promise<ICertificateDAO|undefined> {
        return this.certificateRepository.getCertificate(accountId);
    }

    updateCertificateTenantId(accountId: string, tenantId: string): Promise<ICertificateDAO> {
        return this.certificateRepository.updateCertificateTenantId(accountId, tenantId);
    }

    getAllCertificates(): Promise<ICertificateDAO[]> {
        return this.certificateRepository.getAllCertificates();
    }

    private async createNewSession(
        userIdObject: UserIdentifier,
        identityProvider: IdentityProviderKind,
        userAgent?: string,
        restrictedToAccountIds?: string[],
        isDeviceUser?: boolean,
        deviceUserId?: string
    ): Promise<AuthenticatedSession> {
        const sessionId = SessionIdentifier.generate().value();
        const userId = userIdObject.value();

        const session = Session.build(
            sessionId,
            userId,
            identityProvider,
            undefined,
            userAgent,
            isDeviceUser,
            undefined,
            restrictedToAccountIds,
            deviceUserId
        );
        return this.sessionRepository.saveSession(session.toClient());
    }



    private async endAllSessionsForUser(userId: string, options: { exclude?: string }): Promise<void> {
        const userIdObject = new UserIdentifier(userId);
        let userSessions = (await this.sessionRepository.getSessions(userIdObject));
        if (options.exclude) {
            userSessions = userSessions.filter(session => session.sessionId !== options.exclude)
        }

        return Promise.all(userSessions.map(us => this.sessionRepository.endSession(us))).then(() => {
            userSessions.map(us => {
                this.notificationServiceClient.dispatch(
                    {
                        type: RoutingKeyType.USER,
                        value: userId,
                    },
                    ServiceNotificationType.USER_LOGGED_OFF,
                    {
                        sessionId: us.sessionId,
                        windowId: "fake",
                    },
                )
            })
        })
    }

    public async endSessionsForUser(query: IFindSessionQuery): Promise<void> {
        if (query.userId) {
            const sessions = await this.sessionRepository.getSessions(new UserIdentifier(query.userId));
            for (const session of sessions) {
                await this.sessionRepository.endSession(session);
            }
        }
    }

    public async createUserAccessToken(
        sessionId: string,
        userId: string,
        accountIds?: string[],
        isDeviceUser?: boolean,
        deviceUserId?: string
    ): Promise<string> {
        const userIdentifier = UserIdentifier.build(userId).caseOf({
            left: err => { throw err },
            right: (userIdObject) => userIdObject
        });
        const sessions = await this.sessionRepository.getSessions(userIdentifier);
        const session = sessions.find(s => s.sessionId === sessionId);
        if (session == null) {
            throw new ExpiredSessionError(sessionId);
        }
        return await signJWT(
            { sessionId, userId, accountIds, isDeviceUser, deviceUserId },
            this.accessTokenJwtConfig
        );
    }

    private withValidPassword<T>(
        login: string,
        clearTextPassword: string,
        f: (resolve, reject, loginAndPassword: LoginAndPassword) => void
    ): Promise<T> {
        // eslint-disable-next-line no-async-promise-executor
        return new Promise<T>(async (resolve, reject) => {
            try {
                await this.loginCircuitBreaker.test(login);
            } catch (ex) {
                this.logger.error(`Circuit breaker tripped for ${login}`, "password-validation");
                reject(ex);
                return;
            }
            const loginObject = new Login(login);
            this.credentialRepository
                .getLoginAndPassword(loginObject)
                .then(async (loginAndPassword) => {
                    const isValid = await loginAndPassword.passwordHash.validate(clearTextPassword);
                    if (isValid) {
                        this.loginCircuitBreaker.reset(login);
                        return f(resolve, reject, loginAndPassword);
                    } else {
                        throw new InvalidPassword(login);
                    }
                }, reject)
                .catch(reject);
        });
    }

    private async doLogin(
        userId: UserIdentifier,
        identityProvider: IdentityProviderKind,
        options?: {
            userAgent?: string,
            disableConcurrentLogins?: boolean,
            restrictedToAccountIds?: string[],
            // The device user id that started the login, if available
            deviceUserId?: string
        }
    ): Promise<AuthenticatedSession> {
        const { userAgent, disableConcurrentLogins, restrictedToAccountIds } = options || {};

        const user = await this.userServiceClient.getUser(userId.value());

        const createNewSessionPromise = this.createNewSession(
            userId,
            identityProvider,
            userAgent,
            restrictedToAccountIds,
            user.type == UserType.Device,
            options?.deviceUserId
        ).catch(error => {
            this.logger.error("Could not create a new session", "login-failure", error);
            throw error;
        })
        const authenticatedSession = await createNewSessionPromise;

        if (disableConcurrentLogins) {
            await this.endAllSessionsForUser(authenticatedSession.userId, { exclude: authenticatedSession.sessionId })

        }
        return authenticatedSession;
    }

    loginWithPassword(login: string, clearTextPassword: string, userAgent?: string, disableConcurrentLogins?: boolean): Promise<AuthenticatedSession> {
        this.validateUserName(login);
        const f = (resolve, reject, loginAndPassword) => {
            const userId = loginAndPassword.userId;
            return this.doLogin(userId, "password", { userAgent, disableConcurrentLogins })
                .then(resolve)
                .catch(reject);
        };
        return this.withValidPassword<AuthenticatedSession>(login, clearTextPassword, f);
    }

    private validateUserName(userName: string) {
        const loginErrors = validateEmailInput(userName);
        if (loginErrors.length > 0) {
            throw new InvalidUser(userName);
        }
    }

    async loginWithUserToken(
        userToken: string,
        accountId: string,
        userAgent?: string,
        clientIp?: string,
    ): Promise<AuthenticatedSession> {
        const accountSettings = await this.accountServiceClient.getAccountSettings(accountId);
        const verifyConfig = buildVerifyConfigFromSecretWithoutIssuer(accountSettings.userTokenSecret);
        let inflatedToken: GenericToken;

        try {
            const tokenVerifier = new TokenVerifier(verifyConfig);
            inflatedToken = await tokenVerifier.inflateUserToken(userToken);
        } catch (e) {
            if (e instanceof Error && e.name === "JsonWebTokenError") {
                throw new Unauthorized(e.message, "Invalid user token");
            }
            throw typeof e === "string" ? new Unauthorized(e) : e;
        }
        if (inflatedToken.isExpired()) {
            throw new Unauthorized("Usertoken expired", "Token is expired");
        }
        if (!inflatedToken.isValid()) {
            throw new Unauthorized("Invalid user token", "Invalid user token");
        }
        const { data: { sub: userId, impersonatedUser: impersonatedUserId } } = inflatedToken as UserToken;
        const user = await this.userServiceClient.getUser(userId);
        if (isManualToLogin(user.login)) {
            throw new Unauthorized("Manual.to users cannot login with a user token");
        }
        await this.userTokenImpersonatedUserRepository.saveImpersonatedUser(impersonatedUserId, userId, userAgent, clientIp);
        return this.doLogin(new UserIdentifier(userId), "token", { userAgent });
    }

    async updatePassword(userId: string, login: string, oldPassword: string, newPassword: string, onSuccess?: () => Promise<void>): Promise<void> {
        const storePassword = this.credentialRepository.updatePassword.bind(this.credentialRepository);
        const f = (resolve, reject, loginAndPassword: LoginAndPassword) => {
            BCryptPasswordHash.create(newPassword)
                .then(passwordHash => {
                    loginAndPassword.passwordHash = passwordHash;
                    return storePassword(loginAndPassword);
                })
                .then(() => {
                    resolve(login)
                    if (onSuccess) {
                        onSuccess();
                    }
                })
                .catch(reject);
        };
        await this.withValidPassword<string>(login, oldPassword, f);
    }

    async createOrUpdateCredentialForUser(
        _accountId: string,
        userId: string,
        login: string,
        plainTextPassword: string,
        actorId?: string,
        onSuccess?: () => Promise<void>,
    ): Promise<void> {
        const loginAndPassword = await CredentialService.toLoginAndPassword(userId, login, plainTextPassword);
        await this.credentialRepository.createOrUpdateCredential(loginAndPassword);
        if (userId !== actorId) {
            this.endAllSessionsForUser(userId, {});
        }
        if (onSuccess) {
            onSuccess();
        }
    }

    private static async toLoginAndPassword(userId: string, login: string, plainTextPassword: string): Promise<LoginAndPassword> {
        const passwordHash = await BCryptPasswordHash.create(plainTextPassword);
        const userIdObject = new UserIdentifier(userId);
        const loginObject = new Login(login);
        return new LoginAndPassword(userIdObject, false, loginObject, passwordHash, new Date());
    }

    async verifyPassword(
        login: string,
        password: string
    ): Promise<boolean> {
        try {
            await this.withValidPassword<string>(login, password, resolve => resolve(true));
            return true;
        } catch (e) {
            if (e.message.includes(i18next.t(TK.User_InvalidPassword, { login }))) {
                return false;
            }
            if (e instanceof LoginNotFound) {
                return false;
            }
            throw e;
        }
    }

    async hasPassword(userId: string): Promise<boolean> {
        try {
            const loginAndPassword = await this.credentialRepository.getLoginFromUserId(UserIdentifier.from(userId));
            return !!loginAndPassword.passwordHash;
        } catch (e) {
            this.logger.warn(`Could not find user with id ${userId}`, "has-password");
            return false;
        }
    }

    async loginByADIdentity(nameID: string, userAgent: string, tenantId: string): Promise<AuthenticatedSession> {
        const accounts = await this.accountServiceClient.getAccountsForADTenant(tenantId);
        if (accounts.length === 0) {
            throw new AzureSSONotConfigured(tenantId);
        }
        const userId = await this.adIdentityMappingRepository.getUserId(nameID);
        if (userId === undefined) {
            return undefined;
        }
        const userIdObject = new UserIdentifier(userId);
        return this.doLogin(userIdObject, "saml-sso", { userAgent });
    }

    async loginByAuthenticatedUserId(userId: string, userAgent?: string): Promise<AuthenticatedSession> {
        const userIdObject = new UserIdentifier(userId);
        return this.doLogin(userIdObject, "backend", { userAgent });
    }

    saveADIdentityMapping(nameID: string, userId: string): Promise<void> {
        return this.adIdentityMappingRepository.saveUserMapping(nameID, userId);
    }
    async getADIdentityMappings(userIds: string[]): Promise<Record<string, string>> {
        return await this.adIdentityMappingRepository.multigetNameIDs(userIds);
    }
    saveADGroupMapping(ADGroupId: string, groupId: string, accountId: string): Promise<void> {
        return this.adGroupMappingRepository.saveGroupMapping(ADGroupId, groupId, accountId);
    }
    async getGroupId(ADGroupId: string, accountId: string): Promise<string> {
        if (typeof ADGroupId !== "string") {
            return undefined;
        }
        const decodedGroup = decodeURI(ADGroupId);
        return this.adGroupMappingRepository.getGroupId(decodedGroup, accountId);
    }
    getAllADGroupMappings(accountId: string): Promise<IADGroupMapping[]> {
        return this.adGroupMappingRepository.getAllADGroupMappings(accountId);
    }

    getBrowserUsageReport(daysAgo?: number): Promise<IBrowserInfoReport> {
        const repository = this.mongoSessionRepo;
        const cutoffDate = daysAgo ?
            moment().subtract(daysAgo, "day").toDate() :
            undefined;
        return repository.getBrowserUsageReport(cutoffDate);
    }

    async updatePasswordByAdmin(
        userId: string,
        newPassword: string,
        accountId: string,
        actorId?: string,
        onSuccess?: () => Promise<void>
    ): Promise<void> {
        const user = await this.userServiceClient.getUser(userId);
        await this.createOrUpdateCredentialForUser(undefined, userId, user.login, newPassword, actorId, onSuccess);
        this.sendPasswordChangedByAdminEmail(user, accountId)
    }

    async extendSession(accountId: string, sessionId: string): Promise<boolean> {
        const settings = await this.accountServiceClient.getAccountSettings(accountId);
        const securitySettings = settings?.security;
        if (!securitySettings || !securitySettings.autoLogout) {
            return true;
        }
        const { autoLogoutPeriodMinutes } = securitySettings;
        return this.activeSessionsRepository.extendSession(accountId, sessionId, autoLogoutPeriodMinutes);
    }

    async hasSessionExpired(accountId: string, sessionId: string, userId: string): Promise<boolean> {
        const hasSessionExpired = await this.activeSessionsRepository.hasSessionExpired(accountId, sessionId);
        if (hasSessionExpired) {
            this.notificationServiceClient.dispatch(
                {
                    type: RoutingKeyType.USER,
                    value: userId,
                },
                ServiceNotificationType.USER_LOGGED_OFF,
                {
                    sessionId,
                    windowId: "fake",
                },
            )
            await this.sessionRepository.endSessionByIds(userId, sessionId);
            return true;
        }
        return false;
    }

    private async sendPasswordChangedByAdminEmail(
        targetUser: User,
        accountId: string,
    ) {
        const domainFilters = await this.routingClient.getDomainFiltersForAccounts([accountId]);
        const domain = domainFilters[0]?.domain;
        const readerBranding = await this.routingClient.getBrandingForReaderDomain(domain);

        const message = buildGenericMailMessage(
            targetUser,
            i18next.t(TK.User_PasswordChangedEmailSubject),
            [
                i18next.t(TK.User_PasswordChangedByAdminEmailBody1),
                i18next.t(TK.User_PasswordChangedByAdminEmailBody2),
            ],
            domain,
            readerBranding,
        );

        await this.mailer.sendMessage(message);
    }

    async deleteADIdentityMappingForUsers(accountId: string, userIds: string[]): Promise<void> {
        if (!userIds.length) {
            this.logger.warn("No users to delete AD identity mapping for", "deleteADIdentityMappingForUsers");
            return;
        }
        const account = await this.accountServiceClient.getAccount(accountId);
        const userIdsToDelete = intersection(userIds, account.members);
        if (userIdsToDelete.length === 0) {
            const errorMsg = `Provided userIds are no members of provided account ${accountId}`;
            this.logger.error(errorMsg, "deleteADIdentityMappingForUsers");
            throw new Unauthorized(errorMsg);
        }
        if (userIdsToDelete.length !== userIds.length) {
            this.logger.warn(`skipped userIds (not in provided account ${accountId}): ${userIds.filter(id => !userIdsToDelete.includes(id)).join(", ")}`, "deleteADIdentityMappingForUsers");
        }
        await this.adIdentityMappingRepository.deleteADIdentityMappingForUsers(userIdsToDelete);
    }
}

export class CredentialServiceFactory {
    private credentialRepoFactory: MongoCredentialRepositoryFactory;
    private tokenRepoFactory: MongoTokenRepositoryFactory;
    private sessionRepoFactory: MongoSessionRepositoryFactory;
    private adIdentityMappingRepoFactory: MongoADIdentityMappingRepositoryFactory;
    private adGroupMappingRepoFactory: MongoADGroupMappingRepositoryFactory;
    private certificateRepoFactory: MongoCertificateRepositoryFactory;
    private userTokenImpersonatedUserRepoFactory: MongoUserTokenImpersonatedUserRepositoryFactory;
    private activeSessionsRepoFactory: ActiveSessionRepositoryFactory;
    private readonly signConfig: JWTSignConfig;
    private readonly accessTokenSignConfig: JWTSignConfig;
    private readonly tokenVerifier: TokenVerifier;
    private readonly redisSessionClient: RedisClient;
    private readonly failedLoginCircuitBreaker: IFailedLoginCircuitBreaker;

    constructor(
        private readonly config: Config,
        private readonly accountServiceClient: AccountServiceClient,
        private readonly userServiceClient: UserServiceClient,
        private readonly authorizationServiceClient: AuthorizationServiceClient,
        credentialCollectionConfig: CollectionConfig,
        tokenCollectionConfig: CollectionConfig,
        authTokenCollectionConfig: CollectionConfig,
        sessionCollectionConfig: CollectionConfig,
        azureMappingCollectionConfig: CollectionConfig,
        adIdentityMappingCollectionConfig: CollectionConfig,
        adGroupMappingCollectionConfig: CollectionConfig,
        certificateCollectionConfig: CollectionConfig,
        userTokenImpersonatedUserCollectionConfig: CollectionConfig,
        activeSessionsCollectionConfig: CollectionConfig,
        private readonly notificationServiceClient: NotificationServiceContract,
        private readonly routingClient: RoutingServiceClient,
        private readonly mailer: MailgunMailer
    ) {
        const topLevelLogger = LoggerBuilder.fromConfig(config);
        this.credentialRepoFactory = new MongoCredentialRepositoryFactory(credentialCollectionConfig, topLevelLogger);
        this.tokenRepoFactory = new MongoTokenRepositoryFactory(tokenCollectionConfig, topLevelLogger);
        this.sessionRepoFactory = new MongoSessionRepositoryFactory(sessionCollectionConfig, topLevelLogger);
        this.activeSessionsRepoFactory = new ActiveSessionRepositoryFactory(activeSessionsCollectionConfig, topLevelLogger);
        this.adIdentityMappingRepoFactory = new MongoADIdentityMappingRepositoryFactory(adIdentityMappingCollectionConfig, topLevelLogger);
        this.adGroupMappingRepoFactory = new MongoADGroupMappingRepositoryFactory(adGroupMappingCollectionConfig, topLevelLogger);
        this.certificateRepoFactory = new MongoCertificateRepositoryFactory(certificateCollectionConfig, topLevelLogger);
        this.userTokenImpersonatedUserRepoFactory = new MongoUserTokenImpersonatedUserRepositoryFactory(userTokenImpersonatedUserCollectionConfig, topLevelLogger);
        this.redisSessionClient = RedisClientBuilder.fromConfig(config, "sessions");
        this.failedLoginCircuitBreaker = buildLoginCircuitBreaker(this.redisSessionClient);
        this.signConfig = buildSignConfig(config);
        this.accessTokenSignConfig = buildAccessTokenSignConfig(config);
        const verifyConfig = buildVerifyConfig(config);
        this.tokenVerifier = new TokenVerifier(verifyConfig);
    }

    forRequest(logger: Logger): CredentialService {
        const credentialRepo = this.credentialRepoFactory.build(logger);
        const tokenRepo = this.tokenRepoFactory.build(logger);
        const redisSessionRepo = new RedisSessionRepository(this.redisSessionClient);
        const mongoSessionRepo = this.sessionRepoFactory.build(logger);
        const sessionRepo = new MultiSessionRepository([redisSessionRepo, mongoSessionRepo]);
        const activeSessionsRepo = this.activeSessionsRepoFactory.build(logger);
        const adIdentityMappingRepo = this.adIdentityMappingRepoFactory.build(logger);
        const adGroupMappingRepo = this.adGroupMappingRepoFactory.build(logger);
        const certificateRepo = this.certificateRepoFactory.build(logger);
        const userTokenImpersonatedUserRepo = this.userTokenImpersonatedUserRepoFactory.build(logger);

        return new CredentialService(
            credentialRepo,
            this.accountServiceClient,
            this.userServiceClient,
            this.authorizationServiceClient,
            tokenRepo,
            sessionRepo,
            adIdentityMappingRepo,
            adGroupMappingRepo,
            certificateRepo,
            userTokenImpersonatedUserRepo,
            activeSessionsRepo,
            this.tokenVerifier,
            logger,
            this.signConfig,
            this.accessTokenSignConfig,
            this.failedLoginCircuitBreaker,
            mongoSessionRepo,
            this.notificationServiceClient,
            this.routingClient,
            this.mailer
        );
    }

    static async fromConfig(config: Config): Promise<CredentialServiceFactory> {
        const loginOption = getMongoLogin("credential_service");
        return Promise.all([
            CollectionConfig.promiseFromConfig(config, "credentials", loginOption),
            CollectionConfig.promiseFromConfig(config, "tokens", loginOption),
            CollectionConfig.promiseFromConfig(config, "authtokens", loginOption),
            CollectionConfig.promiseFromConfig(config, "sessions", loginOption),
            CollectionConfig.promiseFromConfig(config, "azuremapping", loginOption),
            CollectionConfig.promiseFromConfig(config, "adidentitymapping", loginOption),
            CollectionConfig.promiseFromConfig(config, "adgroupmapping", loginOption),
            CollectionConfig.promiseFromConfig(config, "certificates", loginOption),
            CollectionConfig.promiseFromConfig(config, "userTokenImpersonatedUsers", loginOption),
            CollectionConfig.promiseFromConfig(config, "activeSessions", loginOption),
            MailgunMailer.fromConfig(config)
        ]).then(([
            credentialCollectionConfig,
            tokenCollectionConfig,
            authTokenCollectionConfig,
            sessionCollectionConfig,
            azureMappingCollectionConfig,
            adIdentityMappingCollectionConfig,
            adGroupMappingCollectionConfig,
            certificateCollectionConfig,
            userTokenImpersonatedUserCollectionConfig,
            activeSessionsCollectionConfig,
            mailer
        ]) => {
            return NodeClientHandler.forBackend(buildBackendSignConfig(config), "credentials").then(clientHandler => {
                const accountServiceClient = AccountServiceClient.fromConfig(config, "v1", clientHandler);
                const userServiceClient = UserServiceClient.fromConfig(config, "v1", clientHandler);
                const notificationServiceClient = NotificationServiceClient.fromConfig(config, "v1", clientHandler, () => undefined);
                const authorizationServiceClient = AuthorizationServiceClient.fromConfig(config, "v1", clientHandler);
                const routingServiceClient = RoutingServiceClient.fromConfig(config, "v1", clientHandler);

                return new CredentialServiceFactory(
                    config,
                    accountServiceClient,
                    userServiceClient,
                    authorizationServiceClient,
                    credentialCollectionConfig,
                    tokenCollectionConfig,
                    authTokenCollectionConfig,
                    sessionCollectionConfig,
                    azureMappingCollectionConfig,
                    adIdentityMappingCollectionConfig,
                    adGroupMappingCollectionConfig,
                    certificateCollectionConfig,
                    userTokenImpersonatedUserCollectionConfig,
                    activeSessionsCollectionConfig,
                    notificationServiceClient,
                    routingServiceClient,
                    mailer
                );
            });
        });
    }
}
