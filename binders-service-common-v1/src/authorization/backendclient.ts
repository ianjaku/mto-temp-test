import { ONE_MINUTE, TEN_SECONDS } from "@binders/client/lib/util/time";
import {
    PermissionMap,
    PermissionName,
    ResourceGroup,
    ResourceType
} from  "@binders/client/lib/clients/authorizationservice/v1/contract";
import {
    AuthorizationServiceClient
} from  "@binders/client/lib/clients/authorizationservice/v1/client";
import { BindersServiceClientConfig } from "@binders/client/lib/clients/config";
import { Cache } from "memory-cache";
import {
    CachedAuthorizationService
} from  "../persistentcache/proxies/CachedAuthorizationServiceContract";
import { Config } from "@binders/client/lib/config/config";
import { Logger } from "../util/logging";
import { NodeClientHandler } from "../apiclient/nodeclient";
import { RequestHandler } from "@binders/client/lib/clients/client";
import { buildBackendSignConfig } from "../tokens/jwt";

class RequestCacher {

    private memoryCache;

    constructor(private TTL: number) {
        this.memoryCache = new Cache();
    }

    private get<T>(key: string): T {
        return this.memoryCache.get(key);
    }

    private set<T>(key: string, value: T, ttl?: number): void {
        this.memoryCache.put(key, value, ttl || this.TTL);
    }

    getCachedRequest<T>(requestKey: string, onMiss: () => Promise<T>, ttl?: number): Promise<T> {
        const cachedValue = this.get<T>(requestKey);
        if (cachedValue !== null) {
            return Promise.resolve(cachedValue);
        }
        return onMiss()
            .then(calculatedValue => {
                this.set(requestKey, calculatedValue, ttl);
                return calculatedValue;
            });
    }
}
export class CachingAuthorizationServiceClient extends AuthorizationServiceClient {

    private static readonly CACHE_VERSION = 1;
    private cache: RequestCacher;

    constructor(endpointPrefix: string, handler: RequestHandler) {
        super(endpointPrefix, handler);
        this.cache = new RequestCacher(TEN_SECONDS);
    }

    static build(requestHandler: RequestHandler, config: Config): CachingAuthorizationServiceClient {
        const versionedPath = BindersServiceClientConfig.getVersionedPath(config, "authorization", "v1");
        return new CachingAuthorizationServiceClient(versionedPath, requestHandler);
    }

    private getKey(name: string, params: string[]) {
        return `${CachingAuthorizationServiceClient.CACHE_VERSION}-${name}-${params.join("-")}`;
    }

    findAllowedResourceGroups(
        userId: string,
        resourceType: ResourceType,
        permission: PermissionName,
        skipPublic: boolean,
        accountId: string,
        skipCache = false,
    ): Promise<ResourceGroup[]> {

        const findFunction = () => super.findAllowedResourceGroups(userId, resourceType, permission, skipPublic, accountId);

        if (skipCache) {
            return findFunction();
        }

        const key = this.getKey("findAllowedResourceGroups", [
            userId,
            resourceType.toString(),
            permission.toString(),
            `${skipPublic}`,
            accountId
        ]);
        return this.cache.getCachedRequest(key, findFunction);
    }

    findPublicResourceGroups(
        resourceType: ResourceType,
        permissions: PermissionName[],
        accountIds?: string[],
        skipCache = false,
    ): Promise<PermissionMap[]> {

        const findFunction = () => super.findPublicResourceGroups(resourceType, permissions, accountIds);

        if (skipCache) {
            return findFunction();
        }

        const key = this.getKey("findPublicResourcGroups", [
            resourceType.toString(),
            ...permissions.map(p => p.toString()),
            (accountIds || []).join(",")
        ]);
        return this.cache.getCachedRequest(
            key,
            findFunction,
            ONE_MINUTE
        );
    }
}

export interface BackendAuthorizationOptions {
    skipCache: boolean;
}

export class BackendAuthorizationServiceClient {
    static async createBuilderFromConfig(
        config: Config,
        serviceName: string
    ): Promise<(logger?: Logger) => AuthorizationServiceClient> {
        const nodeHandler = await NodeClientHandler.forBackend(
            buildBackendSignConfig(config),
            serviceName
        );
        const buildServiceClient = await CachedAuthorizationService.createBuilder(config, nodeHandler);
        return (logger) => {
            return buildServiceClient(logger);
        }
    }

    static async fromConfig(
        config: Config,
        serviceName: string,
        options: Partial<BackendAuthorizationOptions> = {}
    ): Promise<AuthorizationServiceClient> {
        if (options.skipCache) {
            return UnCachedBackendAuthorizationServiceClient.fromConfig(config, serviceName);
        }
        const nodeRequestHandler = await NodeClientHandler.forBackend(
            buildBackendSignConfig(config),
            serviceName
        );
        return CachedAuthorizationService.build(config, nodeRequestHandler);
    }
}

export class UnCachedBackendAuthorizationServiceClient {
    static async fromConfig(
        config: Config,
        serviceName: string
    ): Promise<AuthorizationServiceClient> {
        const nodeRequestHandler = await NodeClientHandler.forBackend(buildBackendSignConfig(config), serviceName);
        return AuthorizationServiceClient.fromConfig(config, "v1", nodeRequestHandler);
    }
}
