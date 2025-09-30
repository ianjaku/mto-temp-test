import { finishRequestTimings, startRequestTimings } from "./request";
import { isDev, isStaging } from "@binders/client/lib/util/environment";
import { IProxyConfig } from "./config";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const cors = require("cors");

const getAllowedOrigins = (proxyConfig) => {
    const allowedOrigins: Array<string | RegExp> = [
        /^https?:\/\/(?:.*\.)?manual\.to$/,
        /.*\.binders\.media$/
    ];
    if (isDev() || isStaging()) {
        allowedOrigins.push(
            /http:\/\/localhost:[0-9]+/,
            /http:\/\/dockerhost:[0-9]+/,
            /http:\/\/192\.168\.[0-9]+\.[0-9]+:[0-9]+/,
            /http:\/\/10\.[0-9]+\.[0-9]+\.[0-9]+:[0-9]+/,
            /http:\/\/172\.17\.[0-9]+\.[0-9]+:[0-9]+/,
            /http:\/\/.*\.lambdatest\.com:[0-9]+/,
        );
    }
    if (proxyConfig) {
        const proxyDomains = Object.keys(proxyConfig)
            .map(proxyDomain => `${proxyConfig[proxyDomain].protocol}://${proxyDomain}`);
        allowedOrigins.push(...proxyDomains);
    }
    return allowedOrigins;
}

const libCors = (proxyConfig) => {
    return cors({
        origin: getAllowedOrigins(proxyConfig),
        credentials: true,
        preflightContinue: true,
    });
}

const logPreflightMessage = (request, next) => {
    if (!request.logger) {
        next(new Error("No logger attached to request."));
        return;
    }
    finishRequestTimings(request, false);
    request.logger.info(
        "CORS Request finished",
        "cors",
        {
            url: request.url,
            method: request.method,
            timings: request.timings,
        }
    );
}

const finishPreflight = (response) => {
    response.statusCode = 204;
    response.setHeader("Content-Length", "0");
    response.end();
}

const getWrappedNext = (request, response, next, logPreflight) => {
    return (err) => {
        if (err || !isPreflightRequest(request)) {
            return next(err);
        }
        finishPreflight(response);
        if (logPreflight) {
            logPreflightMessage(request, next);
        }
    }
}
const getMethod = (request) => request.method && request.method.toUpperCase && request.method.toUpperCase();
const isPreflightRequest = (request) => getMethod(request) === "OPTIONS";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const customCors = (proxyConfig: IProxyConfig, shouldLogPreflight?: boolean) => {
    const standardCors = libCors(proxyConfig);
    return (request, response, next) => {
        const logPreflight = shouldLogPreflight && isPreflightRequest(request);
        if (logPreflight) {
            startRequestTimings(request);
        }
        if ( request?.query?.skipCors ) {
            if (request.logger) {
                request.logger.info("Skipping CORS by query param", "cors");
            }
            next();
        } else {
            const wrappedNext = getWrappedNext(request, response, next, logPreflight);
            standardCors(request, response, wrappedNext);
        }
    }
}

export default customCors;