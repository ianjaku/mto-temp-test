/* eslint-disable no-console */
import {
    MongoSessionRepository,
    MongoSessionRepositoryFactory,
    MultiSessionRepository
} from  "../credentialservice/repositories/sessionRepository";
import {
    buildAccessTokenSignConfig,
    signJWT
} from  "@binders/binders-service-common/lib/tokens/jwt";
import { AuthenticatedSession } from "@binders/client/lib/clients/model";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { RedisClientBuilder } from "@binders/binders-service-common/lib/redis/client";
import {
    RedisSessionRepository
} from  "@binders/binders-service-common/lib/authentication/sessionrepository";
import { Session } from "../credentialservice/models/session";
import { SessionIdentifier, } from "@binders/binders-service-common/lib/authentication/identity";

const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config, "createUserAccessToken");

function getOptions() {
    if (process.argv.length !== 5) {
        console.error(`Usage: node ${__filename} <ACCOUNTID> <USERID> <DAYSVALID>`);
        process.exit(1);
    }
    return {
        accountId: process.argv[2],
        userId: process.argv[3],
        daysValid: process.argv[4],
    };
}

async function createUserAccessToken(
    userId: string,
    accountId: string,
    daysValid: string,
): Promise<{ authenticatedSession: AuthenticatedSession, token: string }> {
    const sessionId = SessionIdentifier.generate().value();
    const session = Session.build(
        sessionId,
        userId,
        "backend",
        undefined,
        undefined,
        undefined,
        undefined,
        [accountId],
    );

    const mongoSessionRepoFactory = await MongoSessionRepositoryFactory.fromConfig(config, logger);
    const redisSessionClient = RedisClientBuilder.fromConfig(config, "sessions");
    const redisSessionRepo = new RedisSessionRepository(redisSessionClient);
    const mongoSessionRepo: MongoSessionRepository = mongoSessionRepoFactory.build(logger);

    const sessionRepo = new MultiSessionRepository([redisSessionRepo, mongoSessionRepo]);

    const authenticatedSession = await sessionRepo.saveSession(session.toClient());

    const jwtConfig = buildAccessTokenSignConfig(config);
    jwtConfig.options.expiresIn = `${daysValid}d`;

    const token = await signJWT(
        {
            sessionId: authenticatedSession.sessionId,
            userId,
            accountIds: [accountId],
        },
        jwtConfig,
    );
    return { authenticatedSession, token };
}

(async function () {

    const {
        userId,
        accountId,
        daysValid,
    } = getOptions();

    const { authenticatedSession, token } = await createUserAccessToken(
        userId,
        accountId,
        daysValid,
    );
    console.log("authenticatedSession", JSON.stringify(authenticatedSession, null, 2));
    console.log("token", token);

    process.exit(0);
})();