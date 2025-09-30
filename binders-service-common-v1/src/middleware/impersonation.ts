import * as express from "express";
import {
    CredentialServiceContract,
    ImpersonationInfo
} from  "@binders/client/lib/clients/credentialservice/v1/contract";
import { getCookieDomain, isDev } from "@binders/client/lib/util/environment";
import { AuthenticatedSession } from "@binders/client/lib/clients/model";
import { Config } from "@binders/client/lib/config/config";
import { WebRequest } from "./request";
import { fetchAccessTokenWithSession } from "./authentication";
import { finishRequest } from "./routes";

const SIX_HOURS = 21600000;

export const impersonate = (config: Config): express.RequestHandler => {
    return async function (request: WebRequest, response, next): Promise<void> {
        try {
            const { impersonatedSession, originalUserToken, isDeviceUserTarget } = request.body;
            const cookieOptions: express.CookieOptions = {
                maxAge: SIX_HOURS,
                domain: getCookieDomain(),
                httpOnly: true,
                secure: !isDev(),
            }
            let deviceSession: AuthenticatedSession | undefined;
            let deviceToken: string | undefined;
            if (isDeviceUserTarget) {
                deviceSession = request.user;
                deviceToken = await fetchAccessTokenWithSession(config, deviceSession);
            }
            const impersonationInfo: ImpersonationInfo = {
                originalUserToken,
                isImpersonatedSession: true,
                isDeviceUserTarget,
                deviceSession,
                deviceToken
            };
            response.cookie(
                "impersonation",
                JSON.stringify(impersonationInfo),
                cookieOptions,
            );
            request.login(impersonatedSession, function (error) {
                if (error) {
                    return next(error);
                }
                return finishRequest(request, response, 200, JSON.stringify(impersonatedSession));
            });
        } catch (err) {
            next(err)
        }
    };
}

export const stopImpersonation = (credentialClient: CredentialServiceContract): express.RequestHandler => {
    return async function (request: WebRequest, response, next) {
        try {
            const impersonationStr = request.cookies["impersonation"];
            if (!impersonationStr) { // typically impersonation has been stopped already in another window
                response.redirect("/");
                return finishRequest(request, response, 200, {});
            }
            const { originalUserToken } = JSON.parse(impersonationStr);
            const session = await credentialClient.loginWithToken(originalUserToken);
            response.cookie("impersonation", "", { maxAge: 0, domain: getCookieDomain() });
            request.login(session, function (error) {
                if (error) {
                    return next(error);
                }
                const domainFromQuery = request.query.domain;
                // Validated safe for redirect
                // Redirects to "/" with or without a domain query parameter
                response.redirect(domainFromQuery ? `/?domain=${domainFromQuery}` : "/");
                return finishRequest(request, response, 200, JSON.stringify(session));
            });
        }
        catch (err) {
            next(err);
        }
    };
}
