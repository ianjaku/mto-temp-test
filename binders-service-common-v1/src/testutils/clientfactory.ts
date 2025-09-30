import { BindersServiceClient, RequestHandler } from "@binders/client/lib/clients/client";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import {
    AuthorizationServiceClient
} from "@binders/client/lib/clients/authorizationservice/v1/client";
import { BackendCredentialServiceClient } from "../apiclient/backendclient";
import {
    BinderRepositoryServiceClient
} from "@binders/client/lib/clients/repositoryservice/v3/client";
import { CommentServiceClient } from "@binders/client/lib/clients/commentservice/v1/client";
import { Config } from "@binders/client/lib/config/config";
import { CredentialServiceClient } from "@binders/client/lib/clients/credentialservice/v1/client";
import { ImageServiceClient } from "@binders/client/lib/clients/imageservice/v1/client";
import { NodeClientHandler } from "../apiclient/nodeclient";
import {
    NotificationServiceClient
} from "@binders/client/lib/clients/notificationservice/v1/client";
import { PublicApiServiceClient } from "@binders/client/lib/clients/publicapiservice/v1/client";
import { ResponseFormat } from "../middleware/response/response";
import { RoutingServiceClient } from "@binders/client/lib/clients/routingservice/v1/client";
import { TestRequestHandler } from "./testrequesthandler";
import { TrackingServiceClient } from "@binders/client/lib/clients/trackingservice/v1/client";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import { buildBackendSignConfig } from "../tokens/jwt";

export type AccountIdProvider = () => string;

export class ClientFactory<T extends BindersServiceClient> {

    private readonly creators = new Map<
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        any,
        (version: string, handler: RequestHandler, accountIdProvider?: AccountIdProvider) => BindersServiceClient
    >();


    constructor(
        private readonly config: Config,
        private readonly clientClass: { new(...args: unknown[]): T },
        private readonly version: string
    ) {
        this.creators.set(
            NotificationServiceClient,
            (version, handler, accountIdProvider?) => (
                NotificationServiceClient.fromConfig(
                    config,
                    version,
                    handler,
                    null,
                    accountIdProvider,
                )
            )
        );
        this.creators.set(
            ImageServiceClient,
            (_version, handler, accountIdProvider?) => (
                ImageServiceClient.fromConfig(
                    config,
                    handler,
                    accountIdProvider,
                )
            )
        );
        this.creators.set(
            BinderRepositoryServiceClient,
            (version, handler, accountIdProvider?) => (
                BinderRepositoryServiceClient.fromConfig(
                    config,
                    version,
                    handler,
                    accountIdProvider,
                )
            )
        );
        this.addGenericService(RoutingServiceClient);
        this.addGenericService(AccountServiceClient);
        this.addGenericService(AuthorizationServiceClient);
        this.addGenericService(CredentialServiceClient);
        this.addGenericService(TrackingServiceClient);
        this.addGenericService(UserServiceClient);
        this.addGenericService(PublicApiServiceClient);
        this.addGenericService(CommentServiceClient);
    }

    async createForPublicApi(
        userId: string,
        accountId: string,
        options: { format?: ResponseFormat } = {},
        accountIdProvider?: AccountIdProvider,
    ): Promise<T> {
        const creator = this.getCreatorOrThrow();
        const userAccessToken = await this.createAccessTokenForUser(this.config, userId);
        const userClientHandler = new TestRequestHandler(userAccessToken, "JWT", accountId);
        const userClient = PublicApiServiceClient.fromConfig(this.config, "v1", userClientHandler);
        const publicApiToken = await userClient.generateApiToken(accountId);

        const publicApiHandler = new TestRequestHandler(
            publicApiToken,
            "Bearer",
            accountId,
            options?.format ?? ResponseFormat.JSON
        );
        return creator(this.version, publicApiHandler, accountIdProvider) as T;
    }

    async createForFrontend(userId?: string, accountIdProvider?: AccountIdProvider): Promise<T> {
        const creator = this.getCreatorOrThrow();
        const token = userId ?
            await this.createAccessTokenForUser(this.config, userId) :
            undefined;
        const handler = new TestRequestHandler(token);
        return creator(this.version, handler, accountIdProvider) as T;
    }

    /**
     * Will create a client, that uses a session with the given targetUserId as userId, and includes the deviceUserId in the session.
     * This is useful to test scenarios where a device user is used for authorization, but the target user needs to be set as author/creator/...
     */
    async createAsDeviceTarget(deviceUserId: string, targetUserId: string, accountId: string): Promise<T> {
        const creator = this.getCreatorOrThrow();
        const credentialClientFactory = new ClientFactory(this.config, CredentialServiceClient, "v1");
        const credentialClient = await credentialClientFactory.createForFrontend(deviceUserId);
        const session = await credentialClient.getImpersonatedSession(targetUserId, accountId);
        const credentialBackendClient = await credentialClientFactory.createBackend();
        const token = await credentialBackendClient.createUserAccessToken(session.sessionId, targetUserId, undefined, session.isDeviceUser, session.deviceUserId);
        const handler = new TestRequestHandler(token);
        return creator(this.version, handler, () => accountId) as T;
    }

    async createBackend(accountIdProvider?: AccountIdProvider): Promise<T> {
        const creator = this.getCreatorOrThrow();
        const handler = await NodeClientHandler.forBackend(
            buildBackendSignConfig(this.config),
            "testing"
        );
        return creator(this.version, handler, accountIdProvider) as T;
    }

    private getCreatorOrThrow() {
        const creator = this.creators.get(this.clientClass);
        if (creator == null) {
            throw new Error(`Unable to resolve ${this.clientClass}`);
        }
        return creator;
    }

    private async createAccessTokenForUser(
        config: Config,
        userId: string
    ): Promise<string> {
        const client = await BackendCredentialServiceClient.fromConfig(config, "testing");
        const session = await client.getImpersonatedSession(userId);
        return await client.createUserAccessToken(session.sessionId, userId, undefined, session.isDeviceUser, session.deviceUserId);
    }

    private addGenericService<T>(
        t: {
            new(...args: unknown[]): T,
            fromConfig: (
                config: Config,
                version: string,
                handler: RequestHandler,
                accountIdProvider?: AccountIdProvider
            ) => BindersServiceClient
        }
    ): void {
        this.creators.set(
            t,
            (version, handler, accountIdProvider?) => (
                t.fromConfig(
                    this.config,
                    version,
                    handler,
                    accountIdProvider,
                )
            )
        );
    }
}
