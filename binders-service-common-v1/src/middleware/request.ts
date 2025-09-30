import { AppRoute } from "@binders/client/lib/clients/routes";
import { AuthenticatedSession } from "@binders/client/lib/clients/model";
import { IProxyDomainConfigWithDomain } from "./config";
import { JWTVerifyConfig } from "../tokens/jwt";
import { Logger } from "../util/logging";
import { Request } from "express";
import { updateRoutesDuration } from "../monitoring/prometheus/appRouteMetrics";

export interface WebRequest extends Request {
    id?: string;
    appRoute?: AppRoute;
    logger?: Logger;
    user?: AuthenticatedSession;
    jwtConfig?: JWTVerifyConfig;
    backendJwtConfig?: JWTVerifyConfig;
    timings?: {
        start: Date;
        stop: Date;
        duration?: number;
    };
    proxyConfig?: IProxyDomainConfigWithDomain;
    serviceName?: string;
    isSessionValid?: () => Promise<boolean>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    session: any;
    loggedFatalError?: boolean;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const startRequestTimings = (req: WebRequest) => {
    req.timings = {
        start: new Date(),
        stop: undefined
    };
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const finishRequestTimings = (req: WebRequest, includingInRouteTimings = true) => {
    if (!req.timings) {
        return;
    }
    req.timings.stop = new Date();
    req.timings.duration = req.timings.stop.getTime() - req.timings.start.getTime();
    if (includingInRouteTimings) {
        updateRoutesDuration(req);
    }
};


// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function prepareRedirectUrl(url: string, params: any): string {
    if(url) {
        const queryParamsToPass = Object.keys(params).map(
            (p) => `${p}=${params[p]}`);
        if(queryParamsToPass.length > 0) {
            return `${url}?${queryParamsToPass.join("&")}`;
        }
        return url;
    }
    return undefined;
}