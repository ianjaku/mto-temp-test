import { AuthorizationServiceClient } from "@binders/client/lib/clients/authorizationservice/v1/client";
import { Maybe } from "@binders/client/lib/monad";
import { PassportConfiguration } from "@binders/binders-service-common/lib/authentication/middleware";
import { UiErrorCode } from "@binders/client/lib/errors";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";

export function requireProductionAccount(azClient: AuthorizationServiceClient, options: { publicPath: string }) {
    return async function(passportConfig: PassportConfiguration<string>, req: WebRequest): Promise<Maybe<UiErrorCode>> {
        if (req.path === passportConfig.routes.loginRoute ||
            req.path === passportConfig.routes.logoutRoute ||
            req.path === "/favicon.ico" ||
            (options?.publicPath && req.path.startsWith(options.publicPath))) {
            return Maybe.nothing<UiErrorCode>();
        }

        // must be logged in
        if (!req.user) {
            return Maybe.just(UiErrorCode.loginToAccess);
        }
        const allowed = await azClient.canAccessBackend(req.user.userId)
        return allowed ?
            Maybe.nothing<UiErrorCode>() :
            Maybe.just(UiErrorCode.noAccessManage);
    };
}
