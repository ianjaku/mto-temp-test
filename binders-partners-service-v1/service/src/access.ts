/* eslint-disable @typescript-eslint/no-unused-vars */
import { AuthorizationServiceClient } from "@binders/client/lib/clients/authorizationservice/v1/client";
import { Maybe } from "@binders/client/lib/monad";
import { PassportConfiguration } from "@binders/binders-service-common/lib/authentication/middleware";
import { UiErrorCode } from "@binders/client/lib/errors";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";

export function requestValidation(
    assetsPath: string,
    azClient: AuthorizationServiceClient
): (pasConfig: PassportConfiguration<string>, req: WebRequest) => Promise<Maybe<UiErrorCode>> {
    return function(pasConfig: PassportConfiguration<string>, req: WebRequest) {
        return Promise.resolve(Maybe.nothing<UiErrorCode>());
    };
}