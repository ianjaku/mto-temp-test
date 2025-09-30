import * as HTTPStatusCode from "http-status-codes";
import { AppRoute, HTTPVerb, validateRule } from "@binders/client/lib/clients/routes";
import { BackendToken, MultiAuthentication } from "./authentication";
import { BackendUser, MultiAuthorization } from "./authorization";
import { BlockReason, RequestBlocker, getRedisClient } from "./block_requests/request_blocker";
import type { ErrorRequestHandler, NextFunction, RequestHandler, Response, Router } from "express";
import { RateLimitRequestHandler, rateLimit } from "express-rate-limit";
import { RedisClient, RedisClientBuilder } from "../redis/client";
import RedisStore, { RedisReply } from "rate-limit-redis";
import { WebRequest, finishRequestTimings, startRequestTimings } from "./request";
import {
    formatResponse,
    getContentTypeHeaderForFormat,
    rawFormatToResponseFormat
} from "./response/response";
import { getSharedRoutes, isSilentSharedEndpoint } from "../sharedroutes";
import { BackendRoutingServiceClient } from "../apiclient/backendclient";
import { BindersConfig } from "../bindersconfig/binders";
import { ClientError } from "@binders/client/lib/clients/client";
import { Config } from "@binders/client/lib/config/config";
import { LoggerBuilder } from "../util/logging";
import { ServiceRoute } from "./app";
import { Unauthorized } from "@binders/client/lib/clients/model";
import { getRequestKey } from "./rateLimiter";
import {
    incrementTooManyRequestsOnRouteCounter
} from "../monitoring/prometheus/tooManyRequestOnRoute";
import { logUncaughtError } from "../monitoring/apm";
import { omit } from "ramda";
import { updateRoutesCounter } from "../monitoring/prometheus/appRouteMetrics";

const getRateLimitRedisClient = (config: Config): RedisClient => RedisClientBuilder.fromConfig(config, "rateLimiter");
export type RateLimit = {
    name: string,
    windowMs: number,
    maxRequests: number,
}

function createRateLimiter(name: string, windowMs: number, maxRequests: number): RateLimitRequestHandler {
    const client = getRateLimitRedisClient(BindersConfig.get(60));
    return rateLimit({
        windowMs,
        limit: maxRequests,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: getRequestKey,
        skipFailedRequests: true,  // Were not really skipping them, we're setting it to true, so `requestWasSuccessful` is invoked
        requestWasSuccessful: (_req, res) => {
            if (res.statusCode === 429) {
                incrementTooManyRequestsOnRouteCounter(name);
            }
            return true;
        },
        store: new RedisStore({
            prefix: `api-rl:${name}:`,
            sendCommand: (command: string, ...args: string[]) =>
                client.call(command, ...args) as Promise<RedisReply>,
        })
    });
}

/**
 * Marks the end of a request by setting the correct response fields
 * and stops the tracking of the request duration
 */
export function finishRequest(
    req: WebRequest,
    res: Response,
    statusCode: number,
    responseBody: unknown,
    logBody = false,
    contentType = "application/json"
): void {
    // If the headers have already been sent, there's no
    // way to configure anything anymore, so we can skip it
    if (!res.headersSent) {
        res.status(statusCode);
        if (responseBody !== undefined) {
            res.set("Content-Type", contentType);
            // Disallow all caching of request results
            // IE sometimes caches API GET calls (?!!?)
            res.set("Cache-Control", "no-cache,no-store");
            res.set("Pragma", "no-cache");
            res.send(responseBody);
        } else {
            if (statusCode >= 200 && statusCode < 300) {
                res.set("Content-Type", contentType);
            }
        }
    }
    res.end();
    finishRequestTimings(req);
    if (!isSilentSharedEndpoint(req) && req.logger) {
        req.logger.info(
            "Request finished",
            "request",
            {
                body: (logBody ? responseBody : undefined),
                url: req.url,
                method: req.method,
                status: statusCode,
                timings: req.timings,
            }
        );
    }
}

function getHandler(
    route: ServiceRoute,
    errorHandler: ErrorRequestHandler,
    wsHandler = false,
    requestBlocker?: RequestBlocker,
    returnValidationErrors = false
): RequestHandler {
    return wsHandler ?
        getWsHandler(route, errorHandler) as unknown as RequestHandler :
        getHttpHandler(route, errorHandler, requestBlocker, returnValidationErrors);
}

function addRouteToRequest(req: WebRequest, route: AppRoute) {
    req.appRoute = route;
    req.logger?.setExtraFields({
        requestVerb: route.verb,
        requestPath: route.path
    });
}

/**
 * Returns an HTTP route handler
 */
function getHttpHandler(
    route: ServiceRoute,
    errorHandler: ErrorRequestHandler,
    requestBlocker?: RequestBlocker,
    returnValidationErrors = false,
): RequestHandler {
    return (req: WebRequest, res, next) => {
        addRouteToRequest(req, route);
        startRequestTimings(req);
        updateRoutesCounter(req);
        return handleAccessControl(route, req, res, next, errorHandler, requestBlocker, returnValidationErrors);
    };
}

/**
 * Returns a WebSocket route handler
 */
function getWsHandler(route: ServiceRoute, errorHandler: ErrorRequestHandler) {
    return (_ws: unknown, req: WebRequest, next: NextFunction) => {
        startRequestTimings(req);
        const token = req.headers["sec-websocket-protocol"];
        req.headers.authorization = `JWT ${token}`;
        return handleAccessControl(route, req, req.res, next, errorHandler);
    };
}

/**
 * Performs authentication, authorization, request blocking & validation
 * Once all pass, it calls the service method or handler.
 */
async function handleAccessControl(
    route: ServiceRoute,
    req: WebRequest,
    res: Response,
    next: NextFunction,
    errorHandler: ErrorRequestHandler,
    requestBlocker?: RequestBlocker,
    returnValidationErrors = false
): Promise<void> {
    // access control, either public or logged in, if logged in add roles
    const authentication = route.authentication ?
        MultiAuthentication([ BackendToken, route.authentication ]) :
        BackendToken;
    try {
        const maybeUser = await authentication(req);
        if (maybeUser.isJust()) {
            req.user = maybeUser.get();
        }
    } catch (ex) {
        if (ex.name === Unauthorized.NAME) {
            return finishRequest(req, res, HTTPStatusCode.UNAUTHORIZED, JSON.stringify({ error: "authentication issue" }))
        }
    }
    const blockReason = requestBlocker ? await requestBlocker.shouldBlockRequest(req) : undefined;
    if (blockReason) {
        const statusCode = blockReason === BlockReason.INVALID_SESSION ?
            HTTPStatusCode.FORBIDDEN :
            HTTPStatusCode.UNAUTHORIZED;
        return finishRequest(req, res, statusCode, JSON.stringify({ error: "Request was blocked" }));
    }
    if (req.logger && req.user) {
        req.logger.setExtraFields({ requestedBy: req.user.userId });
    }

    const authorization = route.authorization ?
        MultiAuthorization([ BackendUser, route.authorization ]) :
        BackendUser;
    try {
        await authorization(req);
    } catch (ex) {
        req.logger?.logException(ex, "authorization");
        if (ex.name === Unauthorized.NAME) {
            return finishRequest(req, res, HTTPStatusCode.UNAUTHORIZED, JSON.stringify({ error: "authorization issue" }))
        }
        if (ex instanceof ClientError) {
            if (ex.statusCode === 404) {
                return finishRequest(req, res, HTTPStatusCode.NOT_FOUND, JSON.stringify({ error: "not found" }))
            }
        }
        return finishRequest(req, res, HTTPStatusCode.INTERNAL_SERVER_ERROR, JSON.stringify({ error: "unhandled error during authorization" }))
    }

    const validationErrors = route.validationRules.flatMap(rule => validateRule(req, rule));
    if (validationErrors.length !== 0) {
        if (req.logger) {
            req.logger.warn("Request validation error", "validation", validationErrors);
        }
        const errorResponseBody = returnValidationErrors ?
            validationErrors :
            "Request validation error";
        return finishRequest(req, res, HTTPStatusCode.BAD_REQUEST, JSON.stringify({ error: errorResponseBody }), true);
    }
    if (route.serviceMethod) {
        try {
            const rawResponseFormat = (req.query?.format ?? req.headers?.accept) as string;
            const responseFormat = rawFormatToResponseFormat(rawResponseFormat);
            if (req.query?.format !== "null") {
                // Remove format, so we don't accidentally pass it to the next service
                req.query = omit(["format"], req.query);
            }
            const result = await route.serviceMethod(req);
            const responseContent = formatResponse(result, {
                format: responseFormat,
                csvFormattingOrder: route.csvFormattingOrder,
            })
            finishRequest(req, res, route.successStatus, responseContent, false, getContentTypeHeaderForFormat(responseFormat));
        }
        catch (error) {
            logUncaughtError(error, req);
            errorHandler(error, req, res, next);
        }
    } else {
        try {
            await route.serviceHandler(req, res, next);
        } catch (error) {
            logUncaughtError(error, req);
            if (error.name === Unauthorized.NAME) {
                if (req.logger) {
                    req.logger.error("Access control check failed: " + error.message, "authorization");
                }
                const suffix = error.publicMessage ? `: ${error.publicMessage}` : "";
                const message = `Request authorization failed${suffix}`;
                finishRequest(req, res, HTTPStatusCode.UNAUTHORIZED, JSON.stringify({ error: message }));
            } else {
                errorHandler(error, req, res, next);
            }
        }
    }
}

export function configureRouter(
    router: Router,
    routes: ServiceRoute[],
    errorHandler: ErrorRequestHandler,
    config: Config,
    returnValidationErrors: boolean
): void {
    const usedRouteIds: string[] = [];
    const requestBlockersRedisClient = getRedisClient(config);
    const clients = {
        requestBlockers: requestBlockersRedisClient,
        sessions: requestBlockersRedisClient
    }
    const logger = LoggerBuilder.fromConfig(config, "request-blocker");
    const routingServiceClientPromise = BackendRoutingServiceClient.fromConfig(config, "middleware-router");
    const requestBlocker = new RequestBlocker(
        logger,
        clients,
        { crossAccountHelpers: { routingServiceClientPromise } },
    );

    const configureRoute = (route: ServiceRoute) => {
        const { verb, path, webSocket, rateLimit } = route;
        const routeId = `${verb}${path}${webSocket}`;
        if (usedRouteIds.includes(routeId)) {
            // eslint-disable-next-line no-console
            console.error(`Error: non-unique route detected in route definitions: ${verb} to ${path}${webSocket ? " (websocket)" : ""}`);
            process.exit(1);
        }
        const addToRouter = webSocket ?
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (router as any).ws.bind(router) :
            verbToMethod(verb, router);
        const serviceHandler = getHandler(route, errorHandler, webSocket, requestBlocker, returnValidationErrors);
        const routeHandlers = rateLimit ?
            [ createRateLimiter(rateLimit.name, rateLimit.windowMs, rateLimit.maxRequests), serviceHandler ] :
            [ serviceHandler ];
        addToRouter(path, ...routeHandlers);
        usedRouteIds.push(routeId);
    }
    routes.forEach(route => configureRoute(route));
}

const DEFAULT_ERROR_HANDLER: ErrorRequestHandler = (err, _req, _res, next) => next(err);

/**
 * The shared routes are the routes common to all our services
 */
export const setupSharedRoutes = (router: Router): void => {
    const sharedRoutes = getSharedRoutes();
    for (const route of Object.values(sharedRoutes)) {
        const { verb, path } = route;
        const addToRouter = verbToMethod(verb, router);
        addToRouter(path, getHandler(route, DEFAULT_ERROR_HANDLER));
    }
}

function verbToMethod(verb: string, router: Router) {
    switch (verb) {
        case HTTPVerb.GET:
            return router.get.bind(router);
        case HTTPVerb.POST:
            return router.post.bind(router);
        case HTTPVerb.DELETE:
            return router.delete.bind(router);
        case HTTPVerb.PUT:
            return router.put.bind(router);
        case HTTPVerb.OPTIONS:
            return router.options.bind(router);
        case HTTPVerb.HEAD:
            return router.head.bind(router);
        case HTTPVerb.PATCH:
            return router.patch.bind(router);
    }
    throw new Error(`Invalid HTTP Verb: ${verb}`);
}
