import {
    AuthType,
    BrowserRequestHandler,
    buildJWTAuthHeader
} from "@binders/client/lib/clients/browserClient";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import { BinderRepositoryServiceClient } from "@binders/client/lib/clients/repositoryservice/v3/client";
import { CredentialServiceClient } from "@binders/client/lib/clients/credentialservice/v1/client";
import { TrackingServiceClient } from "@binders/client/lib/clients/trackingservice/v1/client";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import config from "../../../config";
import { getBackendRequestHandler } from "../../../modules/api";

const backendCredentialServiceClient = CredentialServiceClient.fromConfig(config, "v1", getBackendRequestHandler());

const JWTTokens = {};
async function getJWTToken(userId: string) {
    if (userId in JWTTokens) {
        return JWTTokens[userId];
    }
    const { sessionId } = await backendCredentialServiceClient.getImpersonatedSession(userId);
    const token = await backendCredentialServiceClient.createUserAccessToken(sessionId, userId);
    JWTTokens[userId] = token;
    return token;
}

function getRequestHandler(token: string) {
    const extraHeaders = buildJWTAuthHeader(token);
    return new BrowserRequestHandler(AuthType.NoAuth, extraHeaders);
}

async function getClientHandler(userId: string) {
    const token = await getJWTToken(userId);
    return getRequestHandler(token);
}

export async function getRepoServiceClient(userId: string, accountId: string): Promise<BinderRepositoryServiceClient> {
    const handler = await getClientHandler(userId);
    return BinderRepositoryServiceClient.fromConfig(config, "v3", handler, () => accountId)
}

export async function getUserServiceClient(userId: string): Promise<UserServiceClient> {
    const handler = await getClientHandler(userId);
    return UserServiceClient.fromConfig(config, "v1", handler);
}

export async function getAccountServiceClient(userId: string): Promise<AccountServiceClient> {
    const handler = await getClientHandler(userId);
    return AccountServiceClient.fromConfig(config, "v1", handler);
}

export async function getTrackingServiceClient(userId: string): Promise<TrackingServiceClient> {
    const handler = await getClientHandler(userId);
    return TrackingServiceClient.fromConfig(config, "v1", handler);
}