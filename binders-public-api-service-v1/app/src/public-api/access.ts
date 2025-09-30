import { ApiTokenRepository, ApiTokenRepositoryFactory } from "./repositories/apiTokensRepository";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { buildSignConfig, signJWT } from "@binders/binders-service-common/lib/tokens/jwt";
import { Allow } from "@binders/binders-service-common/lib/middleware/authorization";
import { ApiTokenModel } from "./repositories/models/apiTokenModel";
import { AuthenticatedSession } from "@binders/client/lib/clients/model";
import { Authentication } from "@binders/binders-service-common/lib/middleware/authentication";
import { Config } from "@binders/client/lib/config/config";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { Maybe } from "@binders/client/lib/monad";
import {
    RedisSessionRepository
} from  "@binders/binders-service-common/lib/authentication/sessionrepository";
import { Unauthorized } from "@binders/client/lib/clients/model";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";


const getBearerTokenFromRequest = (request: WebRequest): string | null => {
    const azHeader = request.header("authorization");
    if (azHeader == null) return null;
    const headerPattern = /\s*[Bb]earer\s*(\S+)/;
    const match = azHeader.match(headerPattern);
    if (!match) {
        const message = "Invalid authorization header (no Bearer)"
        throw new Unauthorized(message, message);
    }
    return match[1];
}

const getQueryTokenFromRequest = (request: WebRequest): string | null => {
    const token = request.query?.authorization;
    if (typeof token !== "string") return null;
    return token;
}

let _apiTokenRepo: ApiTokenRepository = null;
const getApiTokenRepo = async (config: Config, logger: Logger) => {
    if (_apiTokenRepo == null) {
        const mongoLogin = getMongoLogin("public_api");
        const mongoConfig = await CollectionConfig.promiseFromConfig(config, "apitokens", mongoLogin);
        const apiTokenRepoFactory = new ApiTokenRepositoryFactory(mongoConfig, logger);
        _apiTokenRepo = apiTokenRepoFactory.build(logger);
    }
    return _apiTokenRepo;
}

let _redisSessionRepository: RedisSessionRepository = null;
const getRedisSessionRepository = (config: Config) => {
    if (_redisSessionRepository == null) {
        _redisSessionRepository = RedisSessionRepository.fromConfig(config);
    }
    return _redisSessionRepository;
}

async function getApiTokenFromRequest(config: Config, request: WebRequest): Promise<ApiTokenModel> {
    const headerToken = getBearerTokenFromRequest(request);
    const queryToken = getQueryTokenFromRequest(request);
    const tokenUuid = queryToken ?? headerToken;
    if (tokenUuid == null) {
        throw new Unauthorized("No authorization method provided.");
    }
    const apiTokenRepo = await getApiTokenRepo(config, request.logger);
    const apiToken = await apiTokenRepo.getByUuid(tokenUuid);
    if (apiToken == null) {
        throw new Unauthorized("Invalid authorization token.");
    }
    return apiToken;
}

export function PublicApiAuthentication(config: Config): Authentication {
    const signConfig = buildSignConfig(config);

    return async (request: WebRequest) => {
        const apiToken = await getApiTokenFromRequest(config, request);
        const jwtData = {
            userId: apiToken.userId,
            sessionId: apiToken.uuid,
            origin: "public-api"
        };
        const jwt = await signJWT(jwtData, signConfig);
        const session: AuthenticatedSession = {
            userId: apiToken.userId,
            sessionId: apiToken.uuid,
            identityProvider: "public-api",
            accountIds: [apiToken.accountId],
            jwt,
        }

        const sessionRepo = getRedisSessionRepository(config);
        if (!await sessionRepo.validateSession(session)) {
            await sessionRepo.saveSession({
                userId: apiToken.userId,
                sessionId: apiToken.uuid,
                identityProvider: "public-api",
            });
        }
        
        request.headers["accountid"] = apiToken.accountId;

        return Maybe.just(session);
    }
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const PublicApi = (config: Config) => ({
    authentication: PublicApiAuthentication(config),
    authorization: Allow,
})
