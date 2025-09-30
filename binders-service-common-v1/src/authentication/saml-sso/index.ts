import * as HTTPStatusCodes from "http-status-codes";
import * as passport from "passport";
import * as passportSaml from "passport-saml";
import {
    Application,
    ErrorRequestHandler,
    NextFunction,
    RequestHandler,
    Response
} from "express";
import {
    BackendAccountServiceClient,
    BackendUserServiceClient
} from "../../apiclient/backendclient";
import { Claim, UserData, transformClaimProperties } from "./profile";
import {
    getAccountIdFromRelayState,
    getAddressForRedirect,
    getDomainForSAMLResponse,
    getDomainForSSOSettings,
    getRedirectFromRelayState
} from "./domains";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import { AuthenticatedSession } from "@binders/client/lib/clients/model";
import { Config } from "@binders/client/lib/config/config";
import { ISAMLSSOConfig } from "./config";
import { RequestWithUser } from "passport-saml/lib/passport-saml/types";
import { UiErrorCode } from "@binders/client/lib/errors";
import { WebRequest } from "../../middleware/request";
import { finishRequest } from "../../middleware/routes";
import { hoursToMilliseconds } from "date-fns";

/**
 * In contrast to the default 8 days for regular login cookie, we're reducing
 * the SSO login one to 12 in order to force the user groups sync at login.
 * This ensures that the correct user permission are synced from the customer's AD sooner.
 */
const MAX_AGE_SSO_LOGIN_COOKIE = hoursToMilliseconds(12);

export const getStrategyConfig = (
    settings: { accountId: string, entryPoint: string, issuer: string, certificate: string, logout: string },
    domainForSAMLResponse: string,
    domainForSSOSettings: string,
    redirectAddress: string,
    config: ISAMLSSOConfig
): passportSaml.SamlConfig => {
    const relayState = JSON.stringify({ redirectAddress, domainForSSOSettings, accountId: settings.accountId });
    return {
        callbackUrl: `https://${domainForSAMLResponse}${config.pathPrefix}/response`,
        entryPoint: settings.entryPoint,
        issuer: settings.issuer,
        cert: settings.certificate,
        signatureAlgorithm: "sha256",
        additionalParams: { RelayState: relayState },
        passReqToCallback: true,
        acceptedClockSkewMs: 300000,
        // authnContext: "http://schemas.microsoft.com/ws/2008/06/identity/authenticationmethod/windows",
        disableRequestedAuthnContext: true,
        identifierFormat: null,
        logoutUrl: settings.logout
    };
};

async function getSamlStrategy(
    request: WebRequest,
    config: ISAMLSSOConfig,
    accountServiceClient?: AccountServiceClient
) {
    const domainWithSSOSettings = getDomainForSSOSettings(request);
    const name = `saml-${domainWithSSOSettings}`;
    const settings = await config.getConfiguration(domainWithSSOSettings);
    if (!settings.enabled) {
        return undefined;
    }
    const domainForSamlResponse = getDomainForSAMLResponse(request);
    const addressForRedirect = getAddressForRedirect(request);

    const strategy = new passportSaml.Strategy(
        getStrategyConfig(settings, domainForSamlResponse, domainWithSSOSettings, addressForRedirect, config),
        async (req, profile, done) => {
            const user = await transformClaimProperties(<Claim>profile, settings.accountId, accountServiceClient, req.logger);
            if (!user.nameID || !user.email || !user.tenantId) {
                req.logger.error(`Incomplete user ${JSON.stringify(user)}`, "saml-sso");
                return done(new Error("Missing identifier, tenantId or email in SAML claim"), undefined);
            }
            return done(null, user as unknown as Record<string, unknown>);
        }
    );
    return { name, strategy, settings };
}


export const setupSAMLSSO = (app: Application, config: ISAMLSSOConfig, bindersConfig: Config): void => {
    const callback = (request: WebRequest, response: Response, next: NextFunction) => {
        return async (error: unknown, user: UserData, _info: unknown): Promise<void> => {
            if (error) {
                request.logger.error("Encountered an error in the sso flow", "saml-sso", { error });
                return next(error);
            }
            if (user) {
                const accountId = getAccountIdFromRelayState(request);
                request.logger.info(`Using accountId: ${accountId}`, "saml-sso");
                let properUser: AuthenticatedSession;
                try {
                    const userAgent = request.header("user-agent");
                    const existingSession = await config.getAuthenticatedSessionByADIdentity(user.nameID, userAgent, user.tenantId);
                    if (existingSession) {
                        properUser = existingSession;
                        await config.setupAccount(user.tenantId, accountId, properUser.userId);
                    } else {
                        await config.registerNewUser(user.nameID, user.email, user.displayName, user.tenantId, accountId);
                        properUser = await config.getAuthenticatedSessionByADIdentity(user.nameID, userAgent, user.tenantId);
                    }
                    await config.refreshGroupMemberships(accountId, properUser.userId, user.groups, request.logger);
                } catch (error) {
                    request.logger.error(`Could not log in and refresh group membership for user ${user.nameID}`, "saml-sso", { error });
                    return next(error);
                }
                return request.logIn(properUser, err => {
                    if (err) {
                        return next(err);
                    }
                    request.session.cookie.maxAge = MAX_AGE_SSO_LOGIN_COOKIE;
                    return response.redirect(getRedirectFromRelayState(request));
                });

            }
            return response.redirect(`/login?reason=${UiErrorCode.loginFailUserEmpty}`);
        };
    };

    const handler: RequestHandler = async (req: WebRequest, res, next) => {
        const accountServiceClient = await BackendAccountServiceClient.fromConfig(bindersConfig, req.serviceName || "saml-sso");
        const namedStrategy = await getSamlStrategy(req, config, accountServiceClient);
        if (namedStrategy) {
            const { name, strategy } = namedStrategy;
            passport.use(name, strategy as unknown as passport.Strategy);
            passport.authenticate(name, {},  callback(req, res, next))(req, res, next);
        } else {
            return res.redirect(`/login?reason=${UiErrorCode.loginFailNoSso}`);
        }
    };

    const logoutHandler: RequestHandler = async (req: WebRequest, res, next) => {
        const userServiceClient = await BackendUserServiceClient.fromConfig(bindersConfig, req.serviceName || "saml-sso");
        const namedStrategy = await getSamlStrategy(req, config);
        if (!namedStrategy?.settings?.enabled || !namedStrategy?.settings?.logout) {
            return next();
        }
        try {
            if (!req.user || req.user.identityProvider !== "saml-sso") {
                return next();
            }
            const user = await userServiceClient.getUser(req.user.userId);
            req.user["nameID"] = user.login;
            req.user["nameIDFormat"] = "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress";
            namedStrategy.strategy.logout(req as unknown as RequestWithUser, (err, logoutUri) => {
                req.logout((logoutErr) => {
                    if (err) {
                        finishRequest(req, res, 500, err);
                    } else if (logoutErr) {
                        finishRequest(req, res, 500, logoutErr);
                    } else {
                        res.redirect(logoutUri);
                    }
                });
            });
        } catch (error) {
            req.logger.error("Error during logout", "sso-logout", { error });
            return next();
        }
    }

    const errorHandler: ErrorRequestHandler = (error, req: WebRequest, res, next) => {
        if (error) {
            req.logger.error("SAML Login Failure", "saml-sso", { error });
            const reason = error.statusCode === HTTPStatusCodes.PRECONDITION_FAILED ?
                UiErrorCode.activeDirectoryNotLinked :
                UiErrorCode.loginFail;
            return res.redirect(`/login?reason=${reason}`);
        }
        return next();
    }

    // Configures /sso/saml/request, /sso/saml/response and /logout routes
    app.get(config.getLoginRoute(), handler, errorHandler);
    app.post(config.getResponseRoute(), handler, errorHandler, config.responseHandler);
    app.get(config.getLogoutRoute(), logoutHandler);
};

const BYPASS_REDIRECT_QUERY_PARAM = "local";

export function shouldBypassSSORedirect(request: WebRequest): boolean {
    const queryParams = request.query || {};
    return queryParams[BYPASS_REDIRECT_QUERY_PARAM] === "1";
}
