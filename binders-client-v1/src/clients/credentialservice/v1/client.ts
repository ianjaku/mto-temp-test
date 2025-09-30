import { AuthenticatedSession, IADGroupMapping } from "../../model";
import { BindersServiceClient, RequestHandler } from "../../client";
import {
    CredentialServiceContract,
    CredentialStatusForUsers,
    GenericToken,
    IBrowserInfoReport,
    ICertificateDAO,
    IFindSessionQuery,
    UserIdWithToken
} from "./contract";
import { BindersServiceClientConfig } from "../../config";
import { Config } from "../../../config";
import TokenAcl from "../../authorizationservice/v1/tokenacl";
import { getRoutes } from "./routes";

export class CredentialServiceClient extends BindersServiceClient implements CredentialServiceContract {
    resetPassword(token: string, login: string, newPassword: string, accountId: string): Promise<AuthenticatedSession> {
        const options = {
            body: {
                token,
                newPassword,
                login,
                accountId
            }
        };
        return this.handleRequest("resetPassword", options);
    }

    createOneTimeToken(userId: string, days: number, accountId: string): Promise<string> {
        const options = {
            body: {
                userId,
                days,
                accountId,
            }
        };
        return this.handleRequest("createOneTimeToken", options);
    }

    createUrlToken(tokenAcl: TokenAcl, days: number): Promise<string> {
        const options = {
            body: {
                tokenAcl,
                days,
            }
        };
        return this.handleRequest("createUrlToken", options);
    }

    loginWithToken(token: string): Promise<AuthenticatedSession> {
        const options = {
            body: {
                token
            }
        };
        return this.handleRequest("loginWithToken", options);
    }

    getUsersTokens(userIds: string[]): Promise<UserIdWithToken[]> {
        const options = {
            body: {
                userIds
            }
        };
        return this.handleRequest("getUsersTokens", options);
    }

    getToken(key: string): Promise<GenericToken> {
        const options = {
            body: {
                key
            }
        };
        return this.handleRequest("getToken", options);
    }

    constructor(endpointPrefix: string, requestHandler: RequestHandler) {
        super(endpointPrefix, getRoutes(), requestHandler);
    }

    static fromConfig(
        config: Config,
        version: string,
        requestHandler: RequestHandler
    ): CredentialServiceClient {
        const versionedPath = BindersServiceClientConfig.getVersionedPath(config, "credential", version);
        return new CredentialServiceClient(versionedPath, requestHandler);
    }

    createCredential(userId: string, login: string, clearTextPassword: string): Promise<void> {
        const options = {
            pathParams: {
                userId
            },
            body: {
                login,
                password: clearTextPassword,
            }
        };
        return this.handleRequest<void>("createCredential", options);
    }

    loginWithPassword(login: string, clearTextPassword: string, userAgent?: string, disableConcurrentLogins?: boolean): Promise<AuthenticatedSession> {
        const options = {
            body: {
                login,
                password: clearTextPassword,
                disableConcurrentLogins,
                userAgent
            }
        };
        return this.handleRequest("loginWithPassword", options);
    }

    loginWithUserToken(userToken: string, accountId: string, userAgent?: string, clientIp?: string): Promise<AuthenticatedSession> {
        const options = {
            body: {
                userToken,
                userAgent,
                accountId,
                clientIp,
            }
        };
        return this.handleRequest("loginWithUserToken", options);
    }

    updatePassword(userId: string, login: string, oldPassword: string, newPassword: string): Promise<void> {
        const options = {
            pathParams: {
                userId
            },
            body: {
                login,
                oldPassword,
                newPassword
            }
        };
        return this.handleRequest<void>("updatePassword", options);
    }

    createOrUpdateCredentialForUser(accountId: string, userId: string, login: string, plainTextPassword: string): Promise<void> {
        const options = {
            body: {
                accountId,
                userId,
                login,
                plainTextPassword
            }
        };
        return this.handleRequest("createOrUpdateCredentialForUser", options);
    }

    getCredentialStatusForUsers(accountId: string, userIds: string[]): Promise<CredentialStatusForUsers> {
        const options = {
            body: {
                accountId,
                userIds,
            }
        };
        return this.handleRequest("getCredentialStatusForUsers", options);
    }

    verifyPassword(login: string, password: string): Promise<boolean> {
        const options = {
            body: {
                login,
                password,
            }
        };
        return this.handleRequest<boolean>("verifyPassword", options);
    }

    hasPassword(userId: string): Promise<boolean> {
        return this.handleRequest<boolean>("hasPassword", { body: { userId }});
    }

    loginByADIdentity(nameID: string, userAgent: string, tenantId: string): Promise<AuthenticatedSession> {
        const options = {
            body: {
                nameID,
                userAgent,
                tenantId
            }
        };
        return this.handleRequest("loginByADIdentity", options);
    }

    loginByAuthenticatedUserId(userId: string, userAgent: string): Promise<AuthenticatedSession> {
        const options = {
            body: {
                userId,
                userAgent,
            }
        };
        return this.handleRequest("loginByAuthenticatedUserId", options);
    }

    saveADIdentityMapping(nameID: string, userId: string): Promise<void> {
        const options = {
            body: {
                nameID,
                userId
            }
        };
        return this.handleRequest<void>("saveADIdentityMapping", options);
    }
    getADIdentityMappings(userIds: string[]): Promise<Record<string, string>> {
        const options = {
            body: {
                userIds,
            }
        };
        return this.handleRequest("getADIdentityMappings", options);
    }
    saveADGroupMapping(ADGroupId: string, groupId: string, accountId: string): Promise<void> {
        const options = {
            body: {
                ADGroupId,
                groupId,
                accountId,
            }
        };
        return this.handleRequest<void>("saveADGroupMapping", options);
    }
    getGroupId(ADGroupId: string, accountId: string): Promise<string> {
        // AWL is using user groups like "AWL Technische Coördinator"
        // What we get from the claims is URL encoded but not completely
        // Eg. the spaces are encoded (%20) but the "ö" is not
        // This causes problems with the AWS load balancers
        // since they expect all URLs to be properly encoded.
        // Sending to a URL with ö in the URI will trigger a HTTP400 on the load balancers
        // To fix we first decode and then encode
        const encoded = encodeURI(decodeURI(ADGroupId));
        const options = {
            pathParams: {
                ADGroupId: encoded,
                accountId
            }
        };
        return this.handleRequest<string>("getGroupId", options);
    }
    getAllADGroupMappings(accountId: string): Promise<IADGroupMapping[]> {
        const options = {
            pathParams: {
                accountId
            }
        };
        return this.handleRequest<IADGroupMapping[]>("getAllADGroupMappings", options);
    }

    saveCertificate(tenantId: string, certificate: string, filename: string, accountId: string): Promise<ICertificateDAO> {
        const options = {
            body: {
                tenantId,
                certificate,
                filename,
                accountId,
            }
        };
        return this.handleRequest("saveCertificate", options);
    }

    updateCertificateTenantId(accountId: string, tenantId: string): Promise<ICertificateDAO> {
        const options = {
            body: {
                accountId,
                tenantId,
            }
        };
        return this.handleRequest("updateCertificateTenantId", options);
    }

    updateCertificateAccountId(tenantId: string, certificate: string, filename: string, accountId: string): Promise<ICertificateDAO> {
        const options = {
            body: {
                tenantId,
                certificate,
                filename,
                accountId,
            }
        };
        return this.handleRequest("updateCertificateAccountId", options);
    }

    getAllCertificates(): Promise<ICertificateDAO[]> {
        return this.handleRequest("getAllCertificates", {});
    }

    getCertificate(accountId: string): Promise<ICertificateDAO|undefined> {
        const options = {
            pathParams: {
                accountId
            }
        };
        return this.handleRequest("getCertificate", options);
    }

    getImpersonatedSession(
        userId: string,
        accountId?: string,
        password?: string
    ): Promise<AuthenticatedSession> {
        const options = {
            body: {
                userId,
                accountId,
                password
            },
        };
        return this.handleRequest("getImpersonatedSession", options);
    }

    getBrowserUsageReport(daysAgo?: number): Promise<IBrowserInfoReport> {
        const options = {
            queryParams: {
                daysAgo
            }
        }
        return this.handleRequest("getBrowserUsageReport", options);
    }

    anonymizeCredential(userId: string): Promise<void> {
        return this.handleRequest("anonymizeCredential", { pathParams: { userId } });
    }

    updateLogin(userId: string, login: string): Promise<void> {
        return this.handleRequest("updateLogin", { pathParams: { userId }, body: { login }});
    }

    createUserAccessToken(
        sessionId: string,
        userId: string,
        accountIds?: string[],
        isDeviceUser?: boolean,
        deviceUserId?: string
    ): Promise<string> {
        return this.handleRequest(
            "createUserAccessToken",
            {
                body: {
                    sessionId,
                    userId,
                    accountIds,
                    isDeviceUser,
                    deviceUserId,
                }
            }
        );
    }

    endSessionsForUser(query: IFindSessionQuery): Promise<void> {
        return this.handleRequest(
            "endSessionsForUser",
            {
                body: {
                    query,
                }
            }
        );
    }

    updatePasswordByAdmin(
        userId: string,
        newPassword: string,
        accountId: string
    ): Promise<void> {
        return this.handleRequest("updatePasswordByAdmin", {
            body: { userId, newPassword, accountId },
        })
    }

    extendSession(accountId: string): Promise<boolean> {
        return this.handleRequest("extendSession", {
            body: { accountId }
        });
    }

    hasSessionExpired(accountId: string): Promise<boolean> {
        return this.handleRequest("hasSessionExpired", {
            body: { accountId }
        });
    }

    deleteADIdentityMappingForUsers(accountId: string, userIds: string[]): Promise<void> {
        return this.handleRequest("deleteADIdentityMappingForUsers", {
            body: { accountId, userIds },
        });
    }
}
