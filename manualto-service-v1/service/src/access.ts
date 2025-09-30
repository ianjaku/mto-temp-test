import {
    IUserAccessedUrlData,
    IUserAction
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { NextFunction, Response } from "express";
import {
    ServerEvent,
    captureServerEvent
} from "@binders/binders-service-common/lib/tracking/capture";
import { Application } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { Maybe } from "@binders/client/lib/monad";
import {
    PassportConfiguration
} from "@binders/binders-service-common/lib/authentication/middleware";
import { RoutingServiceClient } from "@binders/client/lib/clients/routingservice/v1/client";
import { TrackingServiceClient } from "@binders/client/lib/clients/trackingservice/v1/client";
import { UiErrorCode } from "@binders/client/lib/errors";
import { UserActionType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import {
    getAccountIdFromRequestContext
} from "@binders/binders-service-common/lib/middleware/requestContext";
import { getClientIps } from "@binders/binders-service-common/lib/util/ip";
import { getDomainFromRequest } from "@binders/binders-service-common/lib/util/domains";

export function buildShouldBlockAccess () {
    return function (pasConfig: PassportConfiguration<string>, req: WebRequest): Promise<Maybe<UiErrorCode>> {
        if (!req.user && req.path.startsWith("/usersettings")) {
            return Promise.resolve(Maybe.just(UiErrorCode.loginToAccess));
        }
        return Promise.resolve(Maybe.nothing());
    };
}

export type LogUrlAccessOptions = {
    excludePrefixes?: string[];
}
export function logUrlAccess(
    routingServiceClient: RoutingServiceClient,
    trackingServiceClient: TrackingServiceClient,
    { excludePrefixes }: LogUrlAccessOptions = {},
) {
    return async (req: WebRequest, res: Response, next: NextFunction): Promise<void> => {
        const { url, method, headers, user } = req;
        const { host, referer } = headers || {};
        const userId = user?.userId;

        if (excludePrefixes && excludePrefixes.some(prefix => url.startsWith(prefix))) {
            next();
            return;
        }

        try {
            const domain = getDomainFromRequest(req, Application.READER, { returnOnlySubdomain: false });
            const accountId = await getAccountIdFromRequestContext(domain, routingServiceClient);
            const ips = getClientIps(req);

            let data: IUserAccessedUrlData = {
                host,
                method,
                referer,
                url,
                domain,
                ips,
            };
            const urlObj = new URL(`https://${host}${url}`);
            data = {
                ...data,
                hash: urlObj.hash,
                host: urlObj.host,
                hostname: urlObj.hostname,
                href: urlObj.href,
                origin: urlObj.origin,
                pathname: urlObj.pathname,
                port: urlObj.port,
                search: urlObj.search,
            }

            const userActions = [{
                accountId,
                data,
                userActionType: UserActionType.URL_ACCESSED,
                userId,
            } as IUserAction<IUserAccessedUrlData>];

            trackingServiceClient.multiInsertUserAction(userActions, accountId, { refresh: false });

            captureServerEvent(ServerEvent.ReaderPageLoad, {
                userId,
                accountId,
            }, {
                domain,
                ...data
            });
        } catch (err) {
            if (req.logger) {
                req.logger.error(err.message, "index-handler");
            }
        } finally {
            next();
        }
    }
}
