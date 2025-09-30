import { RedisClient, RedisClientBuilder } from "../redis/client";
import RedisStore, { RedisReply } from "rate-limit-redis";
import {
    createTooManyRequestsCounter,
    incrementTooManyRequestsCounter
} from "../monitoring/prometheus/tooManyRequests";
import { Config } from "@binders/client/lib/config/config";
import { Request } from "express";
import { createHash } from "crypto";
import { minutesToMilliseconds } from "date-fns";
import { rateLimit } from "express-rate-limit";

const ONE_MINUTE_AS_MS = minutesToMilliseconds(1);

const getRedisClient = (config: Config): RedisClient => RedisClientBuilder.fromConfig(config, "rateLimiter");

const extractBearerHeader = (req: Request) => {
    const authHeader = req.header("authorization");
    if (!authHeader) {
        return null;
    }
    return "BEARER:" + createHash("sha256").update(authHeader).digest("hex");
};

const extractTokenFromQuery = (req: Request) => {
    const authorization = req.query.authorization as string;
    if (!authorization) {
        return null;
    }
    return "QUERY_TOKEN:" + authorization;
};

// See: https://express-rate-limit.mintlify.app/guides/troubleshooting-proxy-issues#port-numbers-in-ip-addresses
const appGwIpExtractor = (req: Request) => {
    if (!req.ip) {
        // eslint-disable-next-line no-console
        console.error("Warning: request.ip is missing!");
        return req.socket.remoteAddress;
    }
    return req.ip.replace(/:\d+[^:]*$/, "");
};

const extractIp = (req: Request) => {
    return `IP:${appGwIpExtractor(req)}`;
};

export const getRequestKey = (req) =>
    extractBearerHeader(req) || extractTokenFromQuery(req) || extractIp(req);

export const getRateLimiter = (limit: number | undefined, config: Config, serviceName: string) => {
    if (typeof limit !== "number" || Number.isNaN(limit) || limit <= 0) {
        return undefined;
    }
    const client = getRedisClient(config);
    createTooManyRequestsCounter(serviceName);
    return rateLimit({
        windowMs: ONE_MINUTE_AS_MS,
        limit,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: getRequestKey,
        skipFailedRequests: true,  // Were not really skipping them, we're setting it to true, so `requestWasSuccessful` is invoked
        requestWasSuccessful: (req, res) => {
            if (res.statusCode === 429) {
                incrementTooManyRequestsCounter(req.path);
            }
            return true;
        },
        store: new RedisStore({
            sendCommand: (command: string, ...args: string[]) =>
                client.call(command, ...args) as Promise<RedisReply>,
        })
    });
};
