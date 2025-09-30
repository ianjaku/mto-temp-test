import { AuthorizationServiceClient } from "@binders/client/lib/clients/authorizationservice/v1/client";
import { Maybe } from "@binders/client/lib/monad";
import { PassportConfiguration } from "@binders/binders-service-common/lib/authentication/middleware";
import { UiErrorCode } from "@binders/client/lib/errors";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";

export function requestValidation(azClient: AuthorizationServiceClient, options: { publicPath: string }) {
    return async function(passportConfig: PassportConfiguration<string>, req: WebRequest): Promise<Maybe<UiErrorCode>> {
        if (req.path === passportConfig.routes.loginRoute ||
            req.path === passportConfig.routes.logoutRoute ||
            req.path === "/clear-cookies" ||
            req.path.endsWith("favicon.ico") ||
            req.path.startsWith(options.publicPath)
        ) {
            return Maybe.nothing<UiErrorCode>();
        }

        if (!req.user) {
            return Maybe.just(UiErrorCode.loginToAccess);
        }

        const allowed = await azClient.canAccessBackend(req.user.userId);
        return allowed ?
            Maybe.nothing<UiErrorCode>() :
            Maybe.just(UiErrorCode.noAccessDashboard);
    };
}
