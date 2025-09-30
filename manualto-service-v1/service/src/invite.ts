import * as ejs from "ejs";
import * as express from "express";
import * as fs from "fs";
import {
    BackendAccountServiceClient,
    BackendRoutingServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { JWTTokenExpiredError, TokenVerifier } from "@binders/binders-service-common/lib/tokens";
import {
    ServerEvent,
    captureServerEvent
} from "@binders/binders-service-common/lib/tracking/capture";
import { User, UserServiceContract } from "@binders/client/lib/clients/userservice/v1/contract";
import {
    getDomainFromRequest,
    getHostnameForRequest
} from "@binders/binders-service-common/lib/util/domains";
import { Application } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import {
    CredentialServiceContract
} from "@binders/client/lib/clients/credentialservice/v1/contract";
import { IProxyConfig } from "@binders/binders-service-common/lib/middleware/config";
import { OneTimeLoginToken } from "@binders/binders-service-common/lib/tokens";
import { RoutingServiceClient } from "@binders/client/lib/clients/routingservice/v1/client";
import { TokenType } from "@binders/client/lib/clients/credentialservice/v1/contract";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import {
    extractInterfaceLanguageFromRequest
} from "@binders/binders-service-common/lib/util/i18n";
import { finishRequest } from "@binders/binders-service-common/lib/middleware/routes";
import {
    getAccountIdFromRequestContext
} from "@binders/binders-service-common/lib/middleware/requestContext";
import { isProduction } from "@binders/client/lib/util/environment";

const config = BindersConfig.get(60);
let memoizedInviteFileContents = undefined;
const inviteTemplateFile = () => fs.realpathSync("./public/invite.html");
const inviteFileContents = () => {
    if (!memoizedInviteFileContents) {
        memoizedInviteFileContents = fs.readFileSync(inviteTemplateFile(), "utf8");
    }
    return memoizedInviteFileContents;
};

const getServiceLocations = (req: WebRequest) => {
    return config.getObject("services").caseOf({
        nothing: () => {
            return {};
        },
        just: services => {
            const serviceLocations = {};
            for (const serviceName in services) {
                let serviceLocation = services[serviceName].externalLocation;
                if (req.proxyConfig) {
                    const { protocol, proxyDomain, apiPath } = req.proxyConfig;
                    serviceLocation = `${protocol}://${proxyDomain}${apiPath}`;
                }
                serviceLocations[serviceName] = serviceLocation;
            }
            return serviceLocations;
        }
    });
};

async function renderInviteTemplate(
    request,
    userId: string,
    login: string,
    displayName: string,
    firstName: string,
    lastName: string,
    token: string,
    language: string,
    proxyConfig: IProxyConfig,
    isConsumed: boolean,
    isExpired: boolean
) {
    const hostname = getHostnameForRequest(request, Application.READER);
    // TODO MT-4121 domain will be probably rewritten
    // see invite.html <% var domain = JSON.parse(bindersConfig).domain %>
    const domain = getDomainFromRequest(request, Application.READER, { returnOnlySubdomain: false });
    const contents = isProduction() ?
        inviteFileContents() :
        fs.readFileSync(inviteTemplateFile(), "utf8");

    const [routingBackendClient, accountBackendClient] = await Promise.all([
        BackendRoutingServiceClient.fromConfig(config, "reader"),
        BackendAccountServiceClient.fromConfig(config, "reader")
    ]);

    const [branding, accountId, interfaceLang] = await Promise.all([
        routingBackendClient.getBrandingForReaderDomain(domain),
        getAccountIdFromRequestContext(domain, routingBackendClient),
        extractInterfaceLanguageFromRequest(request, { domain })
    ]);

    const accountSettings = await accountBackendClient.getAccountSettings(accountId);

    const templateData = {
        bindersConfig: JSON.stringify({
            api: {
                locations: getServiceLocations(request)
            }
        }),
        branding: JSON.stringify(branding.stylusOverrideProps),
        brandingOverride: domain,
        domain,
        language,
        userData: JSON.stringify({
            userId,
            login,
            displayName,
            firstName,
            lastName,
            token,
            isConsumed,
            isExpired,
            accountId,
            interfaceLang,
        }),
        hostname,
        htmlHeadContent: accountSettings?.htmlHeadContent,
    };
    return ejs.render(contents, templateData, {});
}

export function inviteGet(
    verifier: TokenVerifier,
    userServiceClient: UserServiceContract,
    credentialServiceClient: CredentialServiceContract,
    proxyConfig: IProxyConfig,
    routingClient: RoutingServiceClient
) {
    return async function(request: WebRequest, response: express.Response, next: express.NextFunction): Promise<void> {
        try {
            const token = request.params.token;

            const inflatedDBToken = await credentialServiceClient.getToken(token);
            let inflatedToken;
            let JWTExpired = false;
            try {
                inflatedToken = await verifier.inflate(token);
            } catch (error) {
                if (error instanceof JWTTokenExpiredError) {
                    inflatedToken = inflatedDBToken;
                    JWTExpired = true;
                }
                else throw new Error("Invalid token provided");
            }
            if (inflatedToken.type !== TokenType.ONE_TIME_LOGIN) {
                throw new Error("Invalid token type");
            }
            const userId = (<OneTimeLoginToken>inflatedToken).data.userId;
            return userServiceClient.getUser(userId).then(async (user: User) => {
                if (!user.lastOnline || (<OneTimeLoginToken>inflatedDBToken).data.consumed !== undefined) {
                    response.send(await renderInviteTemplate(
                        request,
                        user.id,
                        user.login,
                        user.displayName,
                        user.firstName,
                        user.lastName,
                        token,
                        request.query["l"] as string,
                        proxyConfig,
                        !!((<OneTimeLoginToken>inflatedDBToken).data.consumed),
                        JWTExpired ? true : (<OneTimeLoginToken>inflatedToken).isExpired()
                    ));

                    try {
                        const domain = getDomainFromRequest(request, Application.READER, { returnOnlySubdomain: false });
                        const accountId = await getAccountIdFromRequestContext(domain, routingClient);
                        captureServerEvent(ServerEvent.InviteFormView, {
                            userId: user.id as string,
                            accountId,
                        }, {
                            domain
                        });
                    } catch (error) {
                        if (request.logger) {
                            request.logger.warn("Failed to capture invite form view", error);
                        }
                    }
                }
                else {
                    response.redirect("/");
                }
            })
                .catch(error => {
                    return next(error);
                });
        } catch (err) {
            next(err)
        }
    };
}

export function invitePost(
    verifier: TokenVerifier,
    userServiceClient: UserServiceContract,
    credentialClient: CredentialServiceContract,
    routingClient: RoutingServiceClient
) {
    return async function(request: WebRequest, response: express.Response, next: express.NextFunction): Promise<void> {
        try {
            const token = request.params.token;
            const { displayName, newPassword, interfaceLanguage } = request.body;
            if (!(displayName?.trim().length ?? 0)) {
                return next(new Error("Display name is required"));
            }
            const domain = getDomainFromRequest(request, Application.READER, { returnOnlySubdomain: false });
            const accountId = await getAccountIdFromRequestContext(domain, routingClient);

            return credentialClient
                .loginWithToken(token)
                .then(session => {
                    const userId = session.userId;
                    return userServiceClient
                        .getUser(userId)
                        .then(async user => {
                            return userServiceClient.updateUser(
                                Object.assign({}, user, { displayName }),
                                accountId
                            );
                        })
                        .then(user => credentialClient.resetPassword(token, user.login, newPassword, accountId))
                        .then(async user => {
                            if (interfaceLanguage) {
                                userServiceClient.savePreferences(userId, { interfaceLanguage });
                            }
                            return user
                        })
                        .then(user => {
                            captureServerEvent(ServerEvent.InviteAcceptSuccess, {
                                userId: user.userId,
                                accountId,
                            }, {
                                sessionId: user.sessionId,
                            });
                            return user;
                        })
                })
                .then(session => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (request as any).login(session, function(error) {
                        if (error) {
                            return next(error);
                        }
                        return finishRequest(request, response, 200, JSON.stringify(session));
                    });
                })
                .catch(next);
        } catch (err) {
            next(err)
        }
    };
}

export function resendInvitePost(
    userServiceClient: UserServiceContract,
) {
    return function(request: WebRequest, response: express.Response, next: express.NextFunction): Promise<void> {
        const { login, domain, accountId } = request.body;
        return userServiceClient
            .inviteUser(login, accountId, domain)
            .then(() => {
                return finishRequest(request, response, 200, {});
            })
            .catch(next);
    };
}
