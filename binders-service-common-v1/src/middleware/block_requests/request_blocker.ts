import { RedisClient, RedisClientBuilder } from "../../redis/client";
import { RedisSessionRepository, SessionRepository } from "../../authentication/sessionrepository";
import { Application } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { CachedRedisSet } from "../../redis/cached_set";
import { Config } from "@binders/client/lib/config/config";
import { Logger } from "../../util/logging";
import { MemoryCache } from "../../cache";
import { RoutingServiceClient } from "@binders/client/lib/clients/routingservice/v1/client";
import { WebRequest } from "../request";
import { getAccountIdFromRequestContext } from "../requestContext";
import { getCachingProxy } from "../../cache/proxy";
import { getClientIps } from "../../util/ip";
import { getDomainFromRequest } from "../../util/domains";
import { isBackendSession } from "../authentication";

const REDIS_RELOAD_INTERVAL = 1000 * 60; // Reload once every minute
const CACHE_VERSION = "v1";

export const BLOCK_USER_REPO_OPTIONS = {
    key: `rb-${CACHE_VERSION}-user`,
    refreshInterval: REDIS_RELOAD_INTERVAL
};

export const BLOCK_IP_REPO_OPTIONS = {
    key: `rb-${CACHE_VERSION}-ip`,
    refreshInterval: REDIS_RELOAD_INTERVAL
};

export function getRedisClient(config: Config): RedisClient {
    return RedisClientBuilder.fromConfig(config, "requestBlockers");
}

export interface RequestBlockerRedisClients {
    requestBlockers: RedisClient;
    sessions?: RedisClient;
}

export interface RequestBlockerOptions {
    crossAccountHelpers?: {
        application?: Application,
        routingServiceClientPromise?: Promise<RoutingServiceClient>,
    },
    assetsPath?: string,
    debug?: boolean
}

export enum BlockReason {
    INVALID_SESSION = "INVALID_SESSION",
    BLOCKED_USER = "BLOCKED_USER",
    BLOCKED_IP = "BLOCKED_IP",
    UNKNOWN = "UNKNOWN",
}

export class RequestBlocker {

    private ipRepo: CachedRedisSet;
    private userRepo: CachedRedisSet;
    private sessionRepo?: SessionRepository;

    constructor(
        private logger: Logger,
        clients: RequestBlockerRedisClients,
        private options: RequestBlockerOptions = { debug: false }
    ) {
        const { debug } = options || {};
        this.ipRepo = new CachedRedisSet(
            clients.requestBlockers,
            { ...BLOCK_IP_REPO_OPTIONS, debug, logger }
        );
        this.userRepo = new CachedRedisSet(
            clients.requestBlockers,
            { ...BLOCK_USER_REPO_OPTIONS, debug, logger }
        );
        if (clients.sessions) {
            const redisSessionRepo = new RedisSessionRepository(clients.sessions);
            this.sessionRepo = getCachingProxy(
                redisSessionRepo,
                new MemoryCache({
                    keyPrefix: "sessions-",
                    cacheVersion: 1,
                    ttl: 1000 * 60
                })
            );
        }
    }

    async shouldBlockRequest(request: WebRequest): Promise<BlockReason | undefined> {
        try {
            if (!(await this.isSessionValid(request))) {
                return BlockReason.INVALID_SESSION;
            }
            if (await this.shouldBlockRequestByUser(request)) {
                return BlockReason.BLOCKED_USER;
            }
            const isIpBlocked = await this.shouldBlockRequestByIp(request);
            if (isIpBlocked) {
                return BlockReason.BLOCKED_IP;
            }
            return undefined;
        } catch (error) {
            this.logger.logException(error, "request-blocker");
            return BlockReason.UNKNOWN;
        }
    }

    private async isCrossAccountRequest(request: WebRequest): Promise<boolean> {
        const { application, routingServiceClientPromise } = this.options.crossAccountHelpers || {};
        const restrictedToAccountIds = request.user?.accountIds;

        if (!restrictedToAccountIds || request.path.startsWith("/assets")) {
            return false;
        }

        let requestingAccountId = request.query.accountId || request.params.accountId || request.body.accountId || request.headers.accountid;

        if (!requestingAccountId) {
            const domain = getDomainFromRequest(request, application, { returnOnlySubdomain: false });
            const routingService = await routingServiceClientPromise;
            requestingAccountId = await getAccountIdFromRequestContext(domain, routingService);
        }
        if (restrictedToAccountIds.includes(requestingAccountId)) {
            return false;
        }
        const currentUserId = this.extractUserIdFromRequest(request);
        this.log(`Blocking ${request.method} ${request.path} request for user ${currentUserId}; session is restricted to accountIds ${restrictedToAccountIds.join()}, while requestingAccountId is ${requestingAccountId}`);
        return true;
    }

    private async isSessionValid(request: WebRequest): Promise<boolean> {
        // MT-3639: Shortcircuit session checking when it's a login/logout path
        // This is to avoid the cases when a user gets blocked to access the login
        // page when all it's sessions get expired, requiring a manual cookie delete
        if (request.path === "/logout" || request.path === "/login") {
            return true;
        }

        if (this.options.assetsPath && request.path.startsWith(this.options.assetsPath)) {
            return true;
        }

        if (request.path === "/favicon.ico") {
            return true;
        }

        if (!this.sessionRepo) {
            return true;
        }
        if (!request.user) {
            // public request, will be blocked by authorization if needed
            return true;
        }
        if (isBackendSession(request.user)) {
            return true;
        }
        if (await this.isCrossAccountRequest(request)) {
            return false;
        }
        const isValid = await this.sessionRepo.validateSession(request.user);
        if (!isValid) {
            this.log(`Blocking request: invalid session ${request.user?.sessionId}`)
        }
        return isValid;
    }

    private async shouldBlockRequestByUser(request: WebRequest): Promise<boolean> {
        const blockedUserIds = await this.getBlockedUsers();
        const currentUserId = this.extractUserIdFromRequest(request);
        const { debug } = this.options || {};
        if (debug) {
            this.log(`Blocked users: ${JSON.stringify(Array.from(blockedUserIds))}`);
            this.log(`Current userId: ${currentUserId}`);
        }
        if (currentUserId && blockedUserIds.has(currentUserId)) {
            this.log(`Blocking request for user with id ${currentUserId}`);
            return true;
        }
        return false;
    }

    private async shouldBlockRequestByIp(request: WebRequest): Promise<boolean> {
        const blockedIps = await this.getBlockedIps();
        const currentIps = getClientIps(request);
        const { debug } = this.options || {};
        if (debug) {
            this.log(`Blocked ips: ${JSON.stringify(Array.from(blockedIps))}`);
            this.log(`Current ips: ${JSON.stringify(currentIps)}`);
        }
        const invalidIps = currentIps.filter(ip => blockedIps.has(ip));
        if (invalidIps.length > 0) {
            this.log(`Blocking request coming from ips [${invalidIps.join(",")}]`);
            return true;
        }
        return false;
    }

    private async getBlockedIps(): Promise<Set<string>> {
        return this.ipRepo.getSet();
    }

    private async getBlockedUsers(): Promise<Set<string>> {
        return this.userRepo.getSet();
    }

    private extractUserIdFromRequest(request: WebRequest): string | undefined {
        if (request.user) {
            return request.user.userId;
        }
        return undefined;
    }

    private log(message: string) {
        this.logger.info(message, "request-blocking-middleware");
    }
}
