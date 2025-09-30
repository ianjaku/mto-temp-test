import {
    Application,
    EventPayload,
    EventType,
    IUserAgentLogFormat
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import {
    BackendRoutingServiceClient,
    BackendTrackingServiceClient
} from "../apiclient/backendclient";
import { LoggerBuilder, LoggerConfigBuilder } from "../util/logging";
import { AuthenticatedSession } from "@binders/client/lib/clients/model";
import { BindersConfig } from "../bindersconfig/binders";
import { Config } from "@binders/client/lib/config/config";
import { RequestHandler } from "express";
import { WebRequest } from "./request";
import { getAccountIdFromRequestContext } from "./requestContext";
import { isSilentSharedEndpoint } from "../sharedroutes";
import { parseUserAgent } from "./useragent";

export function hookInRequestLogger(config: Config, serviceName: string): RequestHandler {
    const loggerConfig = LoggerConfigBuilder.fromConfig(config, serviceName);
    return async (req: WebRequest, _res, next) => {
        req.serviceName = serviceName;
        req.logger = await LoggerBuilder.forExpressRequest(loggerConfig, req);
        next();
    };
}

export function logIncomingRequest(): RequestHandler {
    return (req: WebRequest, _res, next) => {
        if (isSilentSharedEndpoint(req)) {
            next();
            return;
        }
        req.logger.info(
            "Incoming request",
            "request",
            {
                "url": req.url,
                "method": req.method
            }
        );
        next();
    };
}

export const buildUserAgentLogFormat = (ua?: string): IUserAgentLogFormat => {
    const { deviceType, browser, major, minor, patch, os, device } = ua ?
        parseUserAgent(ua) :
        {
            deviceType: undefined,
            browser: undefined,
            major: undefined,
            minor: undefined,
            patch: undefined,
            os: undefined,
            device: undefined,
        };
    return {
        string: ua,
        isMobile: deviceType === "mobile",
        browser,
        browserVersion: {
            major,
            minor,
            patch,
        },
        os,
        device,
    };
};

export const logLoginSuccess = async (user: AuthenticatedSession, domain: string, application: Application): Promise<void> => {
    const { accountIds, userId, userAgent } = user;
    const event: EventPayload = {
        eventType: EventType.USER_LOGGED_IN_SUCCESS,
        accountId: await getAccountIdForDomain(domain),
        userId,
        data: {
            accountIds,
            userAgent: buildUserAgentLogFormat(userAgent),
            application,
        }
    };
    await logEvent(event, userId);
};

export const logLoginFailure = async (login: string, domain: string, message: string, application: Application): Promise<void> => {
    const event: EventPayload = {
        eventType: EventType.USER_LOGGED_IN_FAILURE,
        accountId: await getAccountIdForDomain(domain),
        data: {
            login,
            message,
            application
        }
    };
    await logEvent(event);
};

const getAccountIdForDomain = async (domain: string): Promise<string | undefined> => {
    if (domain.endsWith("binders.media")) {
        // No point searching, we won't find an account id for it
        return undefined;
    }
    try {
        const routingClient = await BackendRoutingServiceClient.fromConfig(BindersConfig.get(60), "common");
        return await getAccountIdFromRequestContext(domain, routingClient);
    } catch (e) {
        return undefined;
    }
};

const logEvent = async (event: EventPayload, userId?: string): Promise<void> => {
    const trackingClient = await BackendTrackingServiceClient.fromConfig(BindersConfig.get(60), "common");
    trackingClient.log([event], userId);
}
