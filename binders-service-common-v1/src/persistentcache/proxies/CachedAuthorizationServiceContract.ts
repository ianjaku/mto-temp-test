import {
    Acl,
    PermissionMap,
    PermissionName,
    ResourceGroup,
    ResourceType
} from  "@binders/client/lib/clients/authorizationservice/v1/contract";
import { Logger, LoggerBuilder } from "../../util/logging";
import {
    createInvalidAuthorizationCacheCounter,
    incrementInvalidAuthorizationCacheCounter
} from  "../../monitoring/prometheus/CacheMetrics";
import { AclsCache } from "../caches/acls";
import {
    AuthorizationServiceClient
} from  "@binders/client/lib/clients/authorizationservice/v1/client";
import { BindersServiceClientConfig } from "@binders/client/lib/clients/config";
import { CachingAuthorizationServiceClient } from "../../authorization/backendclient";
import { Config } from "@binders/client/lib/config/config";
import { InvalidatorManager } from "../../cache";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import LaunchDarklyService from "../../launchdarkly/server";
import { RequestHandler } from "@binders/client/lib/clients/client";
import { equals } from "ramda";
import { getOrCreateLaunchDarklyService } from "../helpers/singletonDependencies";

enum CacheMode {
    Cached = "cached", // Run only the cached version
    CachedWithVerification = "cached-with-verification", // Run the cached version, return the response, and then, asynchronously, run the live version to verify, logging if it fails
    UnCachedWithVerification = "uncached-with-verification", // Run both versions and return the live version, logging any differences
    UnCached = "uncached", // Run only the live version, as if the wrapper did not exist
}

export class CachedAuthorizationService extends AuthorizationServiceClient {

    private invalidator = new InvalidatorManager();

    constructor(
        versionedPath: string,
        requestHandler: RequestHandler,
        private readonly aclsCache: AclsCache,
        private readonly logger: Logger,
        private readonly cachingClient: CachingAuthorizationServiceClient,
        private readonly launchDarkly: LaunchDarklyService,
    ) {
        super(versionedPath, requestHandler);
    }

    findAllowedResourceGroups(
        userId: string,
        resourceType: ResourceType,
        permission: PermissionName,
        skipPublic: boolean,
        accountId: string,
        skipCache = false,
    ): Promise<ResourceGroup[]> {
        return this.cachingClient.findAllowedResourceGroups(
            userId,
            resourceType,
            permission,
            skipPublic,
            accountId,
            skipCache
        );
    }

    findPublicResourceGroups(
        resourceType: ResourceType,
        permissions: PermissionName[],
        accountIds?: string[],
        skipCache = false,
    ): Promise<PermissionMap[]> {
        return this.cachingClient.findPublicResourceGroups(
            resourceType,
            permissions,
            accountIds,
            skipCache
        )
    }

    async findResourcePermissionsWithRestrictions(
        userId: string,
        resourceType: ResourceType,
        resourceId: string,
        accountId?: string
    ): Promise<Acl[]> {
        if (accountId == null) {
            if (accountId == null) {
                this.logger.warn(
                    "No accountId provided to findResourcePermissionsWithRestrictions",
                    "caching"
                );
            }
            return super.findResourcePermissionsWithRestrictions(
                userId,
                resourceType,
                resourceId
            );
        }

        return this.run(
            "findResourcePermissionsWithRestrictions",
            () => this.aclsCache.findResourcePermissionsWithRestrictions(
                accountId,
                userId,
                resourceType,
                resourceId
            ),
            () => super.findResourcePermissionsWithRestrictions(
                userId,
                resourceType,
                resourceId,
                accountId,
            ),
            (a, b) => !equals(a, b),
            { userId, resourceType, resourceId, accountId }
        )
    }

    async findResourcePermissions(
        userId: string,
        resourceType: ResourceType,
        resourceId: string,
        accountId?: string
    ): Promise<PermissionName[]> {
        return this.run(
            "findResourcePermissions",
            () => this.aclsCache.findResourcePermissions(
                accountId,
                userId,
                resourceType,
                resourceId
            ),
            () => super.findResourcePermissions(
                userId,
                resourceType,
                resourceId,
                accountId
            ),
            (a, b) => !equals(a, b),
            { userId, resourceType, resourceId, accountId }
        )
    }

    private async getCacheMode(): Promise<CacheMode> {
        return await this.launchDarkly.getFlag<CacheMode>(LDFlags.AUTHORIZATION_CACHE_MODE);
    }

    private async run<T>(
        methodName: string,
        fetchCached: () => Promise<T>,
        fetchLive: () => Promise<T>,
        isDifferent: (cached: T, live: T) => boolean,
        extraLogData: { [key: string]: unknown; accountId: string }
    ): Promise<T> {
        const cacheMode = await this.getCacheMode() ?? CacheMode.CachedWithVerification;
        if (cacheMode === CacheMode.Cached) {
            return fetchCached();
        }
        if (cacheMode === CacheMode.UnCached) {
            return fetchLive();
        }
        if (cacheMode === CacheMode.UnCachedWithVerification) {
            const cachedPromise = this.timeExecution(fetchCached);
            const livePromise = this.timeExecution(fetchLive);
            const [
                [cached, cacheTimeMs],
                [live, liveTimeMs]
            ] = await Promise.all([cachedPromise, livePromise]);

            this.logCacheTimeTaken(methodName, cacheTimeMs, liveTimeMs);
            if (isDifferent(cached, live)) {
                this.logInconsistency(methodName, cached, live, extraLogData);
                // Invalidate the cache for this account, when an inconsistency is found
                this.invalidator.onDelete([{ name: "account", accountId: extraLogData.accountId }]);
            }

            return live;
        }
        if (cacheMode === CacheMode.CachedWithVerification) {
            const [cached, cacheTimeMs] = await this.timeExecution(fetchCached);
            // Validate the cached response, without slowing down the response time
            (async () => {
                const [live, liveTimeMs] = await this.timeExecution(fetchLive);
                this.logCacheTimeTaken(methodName, cacheTimeMs, liveTimeMs);
                if (isDifferent(cached, live)) {
                    incrementInvalidAuthorizationCacheCounter();
                    this.logInconsistency(methodName, cached, live, extraLogData);
                    // Invalidate the cache for this account, when an inconsistency is found
                    this.invalidator.onDelete([{ name: "account", accountId: extraLogData.accountId }]);
                }
            })();
            return cached;
        }
        throw new Error(`Unknown cache mode: ${cacheMode}`);
    }

    private logInconsistency(
        methodName: string,
        cached: unknown,
        live: unknown,
        extraLogData: unknown
    ) {
        this.logger.error(
            `Inconsistency between cache & live version in ${methodName}`,
            "caching",
            { methodName, cached, live, extra: extraLogData }
        );
    }

    private async logCacheTimeTaken(
        methodName: string,
        cacheTimeMs: number,
        liveTimeMs: number
    ) {
        this.logger.info(
            "Permanent cache timing",
            "caching",
            { methodName, cacheTimeMs, liveTimeMs }
        );
    }

    private async timeExecution<T>(
        func: () => Promise<T>
    ): Promise<[T, number]> {
        const startTime = Date.now();
        const result = await func();
        const endTime = Date.now();
        return [
            result,
            endTime - startTime
        ]
    }

    static async createBuilder(
        config: Config,
        requestHandler: RequestHandler
    ): Promise<(logger: Logger) => AuthorizationServiceClient> {
        createInvalidAuthorizationCacheCounter();
        const versionedPath = BindersServiceClientConfig.getVersionedPath(config, "authorization", "v1");
        const aclCache = await AclsCache.fromConfig(config);
        const parent = CachingAuthorizationServiceClient.build(
            requestHandler,
            config
        );
        const launchDarklyService = await getOrCreateLaunchDarklyService(config)
        return (logger) => {
            return new CachedAuthorizationService(
                versionedPath,
                requestHandler,
                aclCache,
                logger ? logger : LoggerBuilder.fromConfig(config),
                parent,
                launchDarklyService
            );
        }
    }

    static async build(
        config: Config,
        requestHandler: RequestHandler,
        requestLogger?: Logger
    ): Promise<AuthorizationServiceClient> {
        createInvalidAuthorizationCacheCounter();
        const versionedPath = BindersServiceClientConfig.getVersionedPath(config, "authorization", "v1");

        const logger = requestLogger ? requestLogger : LoggerBuilder.fromConfig(config);

        return new CachedAuthorizationService(
            versionedPath,
            requestHandler,
            await AclsCache.fromConfig(config),
            logger,
            CachingAuthorizationServiceClient.build(
                requestHandler,
                config
            ),
            await getOrCreateLaunchDarklyService(config)
        );
    }
}
