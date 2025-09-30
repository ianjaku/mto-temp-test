import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import { BinderRepositoryServiceClient } from "@binders/client/lib/clients/repositoryservice/v3/client";
import { CommentServiceClient } from "@binders/client/lib/clients/commentservice/v1/client";
import { Config } from "@binders/client/lib/config/config";
import { ContentServiceClient } from "@binders/client/lib/clients/contentservice/v1/client";
import { CredentialServiceClient } from "@binders/client/lib/clients/credentialservice/v1/client";
import { ICacheOptions } from "../cache";
import { ImageServiceClient } from "@binders/client/lib/clients/imageservice/v1/client";
import { NodeClientHandler } from "./nodeclient";
import { NotificationServiceClient } from "@binders/client/lib/clients/notificationservice/v1/client";
import { RedisDatabase } from "../redis/client";
import { RoutingServiceClient } from "@binders/client/lib/clients/routingservice/v1/client";
import { ServiceNotification } from "@binders/client/lib/clients/notificationservice/v1/contract";
import { TrackingServiceClient } from "@binders/client/lib/clients/trackingservice/v1/client";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import { buildBackendSignConfig } from "../tokens/jwt";

function withBackendHandler<T>(config: Config, serviceName: string, builder: (handler: NodeClientHandler) => T): Promise<T> {
    return NodeClientHandler.forBackend(buildBackendSignConfig(config), serviceName)
        .then(nodeRequestHandler => builder(nodeRequestHandler));
}

async function withAPIHandler<T>(builder: (handler: NodeClientHandler) => T, token: string): Promise<T> {
    const handler = new NodeClientHandler(token);
    return builder(handler);
}

export class BackendRoutingServiceClient {
    static fromConfig(config: Config, serviceName: string): Promise<RoutingServiceClient> {
        return withBackendHandler(config, serviceName, nodeRequestHandler => RoutingServiceClient.fromConfig(config, "v1", nodeRequestHandler));
    }
}

export type CacheOptions = {
    databaseName: RedisDatabase,
    options: ICacheOptions
}
export const ACCOUNT_SERVICE_CACHE_OPTIONS: CacheOptions = {
    databaseName: "accountsettings",
    options: {
        keyPrefix: "accounts-v1-client",
        cacheVersion: 1,
        ttl: 1000 * 3600 * 24 // 24h
    }
}
export class BackendAccountServiceClient {
    static fromConfig(config: Config, serviceName: string): Promise<AccountServiceClient> {
        return withBackendHandler(config, serviceName, nodeRequestHandler => AccountServiceClient.fromConfig(config, "v1", nodeRequestHandler));
    }
}

function getClient<T>(config: Config, serviceName: string, builder, tokenOverride?: string): Promise<T> {
    if (tokenOverride) {
        return withAPIHandler(builder, tokenOverride);
    }
    return withBackendHandler(config, serviceName, builder);
}

export class BackendRepoServiceClient {
    static fromConfig(config: Config, serviceName: string, tokenOverride?: string, accountIdProvider?: () => string): Promise<BinderRepositoryServiceClient> {
        const builder = nodeRequestHandler => BinderRepositoryServiceClient.fromConfig(config, "v3", nodeRequestHandler, accountIdProvider);
        return getClient(config, serviceName, builder, tokenOverride);
    }
}

export class BackendCommentServiceClient {
    static fromConfig(config: Config, serviceName: string, tokenOverride?: string, accountIdProvider?: () => string): Promise<CommentServiceClient> {
        const builder = nodeRequestHandler => CommentServiceClient.fromConfig(config, "v1", nodeRequestHandler, accountIdProvider);
        return getClient(config, serviceName, builder, tokenOverride);
    }
}

export class BackendCredentialServiceClient {
    static fromConfig(config: Config, serviceName: string): Promise<CredentialServiceClient> {
        return withBackendHandler(config, serviceName, nodeRequestHandler => CredentialServiceClient.fromConfig(config, "v1", nodeRequestHandler));
    }
}

export class BackendUserServiceClient {
    static fromConfig(config: Config, serviceName: string): Promise<UserServiceClient> {
        return withBackendHandler(config, serviceName, nodeRequestHandler => UserServiceClient.fromConfig(config, "v1", nodeRequestHandler));
    }
}

export class BackendImageServiceClient {
    static fromConfig(config: Config, serviceName: string, tokenOverride?: string): Promise<ImageServiceClient> {
        const builder = nodeRequestHandler => ImageServiceClient.fromConfig(config, nodeRequestHandler);
        return getClient(config, serviceName, builder, tokenOverride);
    }
}

export class BackendTrackingServiceClient {
    static fromConfig(config: Config, serviceName: string): Promise<TrackingServiceClient> {
        return withBackendHandler(config, serviceName, nodeRequestHandler => TrackingServiceClient.fromConfig(config, "v1", nodeRequestHandler));
    }
}

export class BackendNotificationServiceClient {
    static fromConfig(config: Config, serviceName: string, onServiceNotification: (serviceNotification: ServiceNotification) => void): Promise<NotificationServiceClient> {
        return withBackendHandler(config, serviceName, nodeRequestHandler => NotificationServiceClient.fromConfig(config, "v1", nodeRequestHandler, onServiceNotification));
    }
}

export class BackendContentServiceClient {
    static fromConfig(config: Config, serviceName: string): Promise<ContentServiceClient> {
        return withBackendHandler(config, serviceName, nodeRequestHandler => ContentServiceClient.fromConfig(config, nodeRequestHandler));
    }
}
