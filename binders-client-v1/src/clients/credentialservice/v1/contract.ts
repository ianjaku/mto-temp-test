import { AuthenticatedSession, IADGroupMapping } from "../../model";
import TokenAcl from "../../authorizationservice/v1/tokenacl";
import { TranslationKeys } from "../../../i18n/translations";
import { getQueryStringVariable } from "../../../util/uri";
import i18next from "../../../i18n";

export interface ICertificateDAO {
    tenantId: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any;
    accountId: string;
    filename?: string;
    expirationDate?: Date;
}

export interface IBrowserInfoReport {
    browsers: Record<string, number>,
    browserVersions: Record<string, Record<string, number>>,
    mobileDevices: Record<string, number>,
    mobileDesktop: { mobile: number, desktop: number };
    os: Record<string, number>,
}

export abstract class Token<T extends TokenType, S extends TokenData<T>> {

    constructor(readonly key: string,
        readonly type: T,
        readonly data: S,
        readonly invalidated: boolean,
        readonly expirationDate: Date) {

    }
}

const getDebouceInterval = () => {
    const qs = getQueryStringVariable("sessionExtensionDebounce");
    if (qs) {
        return Number.parseInt(qs, 10);
    }
    return 60_000;
}
export const SESSION_EXTENSION_DEBOUNCE_INTERVAL = getDebouceInterval();

export enum TokenType {
    ONE_TIME_LOGIN = 0,
    URL = 1,
    PUBLIC_API = 2,
    USER = 3,
}
// eslint-disable-next-line @typescript-eslint/no-empty-interface,@typescript-eslint/no-unused-vars
export interface TokenData<T extends TokenType> {

}
export type GenericToken = Token<TokenType, TokenData<TokenType>>;

export class LoginFailure extends Error {
    static NAME = "LoginFailure";

    public message: string;

    constructor(extraMessage?: string) {
        super();
        let message = i18next.t(TranslationKeys.User_CantLogIn);
        if (extraMessage) {
            message = message + " : " + extraMessage;
        }
        this.message = message;
        this.name = LoginFailure.NAME;
    }

    toString(): string {
        return this.message;
    }
}

export class AzureSSONotConfigured extends Error {
    static NAME = "AzureSSONotConfigured";

    constructor(public readonly tenantId: string) {
        super();
        this.message = i18next.t(TranslationKeys.General_SSONotConfiguredForAzureAccountError);
        this.name = AzureSSONotConfigured.NAME;
    }
}

export class InvalidPassword extends LoginFailure {
    constructor(login: string) {
        super(i18next.t(TranslationKeys.User_InvalidPassword, { login }));
    }
}

export class ExpiredSessionError extends Error {
    static NAME = "ExpiredSession";

    constructor(public readonly sessionId: string) {
        super();
        this.message = i18next.t(TranslationKeys.General_SessionEnd);
        this.name = ExpiredSessionError.NAME;
    }
}

export class InvalidUser extends LoginFailure {
    constructor(login: string) {
        super(i18next.t(TranslationKeys.User_Invalid, { login }));
    }
}

export interface UserIdWithToken {
    userId: string;
    token: string;
}

export interface IFindSessionQuery {
    userId: string;
}

export interface ImpersonationInfo {
    originalUserToken: string;
    isImpersonatedSession: boolean;
    isDeviceUserTarget?: boolean;
    deviceSession?: AuthenticatedSession;
    deviceToken?: string;
}

export enum CredentialStatus {
    PASSWORD_SET = "PASSWORD_SET",
    NO_PASSWORD = "NO_PASSWORD",
    UNKNOWN = "UNKNOWN"
}

export interface CredentialStatusForUsers {
    [userId: string]: CredentialStatus;
}

export interface CredentialServiceContract {
    createCredential(userId: string, login: string, clearTextPassword: string): Promise<void>;
    anonymizeCredential(userId: string): Promise<void>;
    loginWithPassword(login: string, clearTextPassword: string, userAgent?: string, disableConcurrentLogins?: boolean): Promise<AuthenticatedSession>;
    loginWithUserToken(userToken: string, accountId: string, userAgent?: string, clientIp?: string): Promise<AuthenticatedSession>;
    updatePassword(userId: string, login: string, oldPassword: string, newPassword: string): Promise<void>;
    createOrUpdateCredentialForUser(accountId: string, userId: string, login: string, plainTextPassword: string): Promise<void>;
    getCredentialStatusForUsers(accountId: string, userIds: string[]): Promise<CredentialStatusForUsers>;
    verifyPassword(login: string, password: string): Promise<boolean>;
    hasPassword(userId: string): Promise<boolean>;
    createOneTimeToken(userId: string, days: number, accountId?: string): Promise<string>;
    createUrlToken(tokenAcl: TokenAcl, days: number): Promise<string>;
    getUsersTokens(userIds: string[]): Promise<UserIdWithToken[]>;
    getToken(key: string): Promise<GenericToken>;
    loginWithToken(token: string): Promise<AuthenticatedSession>;
    loginByADIdentity(nameID: string, userAgent: string, tenantId: string): Promise<AuthenticatedSession>;
    loginByAuthenticatedUserId(userId: string, userAgent: string): Promise<AuthenticatedSession>;
    saveADIdentityMapping(oid: string, userId: string): Promise<void>;
    getADIdentityMappings(userIds: string[]): Promise<Record<string, string>>;
    getGroupId(ADgroupId: string, accountId: string): Promise<string>;
    getAllADGroupMappings(accountId): Promise<IADGroupMapping[]>;
    saveADGroupMapping(ADGroupId: string, groupId: string, accountId: string): Promise<void>;
    resetPassword(token: string, login: string, newPassword: string, accountId: string): Promise<AuthenticatedSession>;
    saveCertificate(tenantId: string, certificate: string, filename: string, accountId: string): Promise<ICertificateDAO>;
    updateCertificateAccountId(tenantId: string, certificate: string, filename: string, accountId: string): Promise<ICertificateDAO>;
    updateCertificateTenantId(accountId: string, tenantId: string): Promise<ICertificateDAO>;
    getAllCertificates(): Promise<ICertificateDAO[]>;
    getCertificate(accountId: string): Promise<ICertificateDAO|undefined>;
    getImpersonatedSession(userId: string, accountId?: string): Promise<AuthenticatedSession>;
    getBrowserUsageReport(daysAgo?: number): Promise<IBrowserInfoReport>;
    updateLogin(userId: string, login: string): Promise<void>;
    createUserAccessToken(
        sessionId: string,
        userId: string,
        accountIds?: string[],
        isDeviceUser?: boolean,
        // If the session was created by a device, then the deviceUserId is the userId of that device
        deviceUserId?: string
    ): Promise<string>;
    endSessionsForUser(query: IFindSessionQuery): Promise<void>;
    updatePasswordByAdmin(userId: string, newPassword: string, accountId: string): Promise<void>;

    extendSession(accountId: string): Promise<boolean>;
    hasSessionExpired(accountId: string): Promise<boolean>;
    deleteADIdentityMappingForUsers(accountId: string, userIds: string[]): Promise<void>;
}
