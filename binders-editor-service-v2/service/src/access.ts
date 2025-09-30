import { AuthorizationServiceClient } from "@binders/client/lib/clients/authorizationservice/v1/client";
import { Maybe } from "@binders/client/lib/monad";
import { PassportConfiguration } from "@binders/binders-service-common/lib/authentication/middleware";
import { UiErrorCode } from "@binders/client/lib/errors";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";

export function requestValidation(
    assetsPath: string,
    _azClient: AuthorizationServiceClient
): (pasConfig: PassportConfiguration<string>, req: WebRequest) => Promise<Maybe<UiErrorCode>> {
    return function(pasConfig: PassportConfiguration<UiErrorCode>, req: WebRequest): Promise<Maybe<UiErrorCode>> {
        if (
            req.path === pasConfig.routes.loginRoute ||
            req.path === pasConfig.routes.logoutRoute ||
            req.path === "/clear-cookies" ||
            req.path === "/robots.txt" ||
            req.path === "/reset-password" ||
            req.path === "/reset-resend" ||
            req.path.startsWith("/reset/") ||
            req.path.endsWith("favicon.ico") ||
            req.path.startsWith(assetsPath) ||
            !!req.query.ut
        ) {
            return Promise.resolve(Maybe.nothing<UiErrorCode>());
        }
        if (!req.user) {
            req?.logger?.warn("Expected user information for request", "request-validation");
            return Promise.resolve(Maybe.just(UiErrorCode.loginToAccess));
        }
        return Promise.resolve(Maybe.nothing<UiErrorCode>());
    };
}
