import * as mongoose from "mongoose";
import { MongoTokenRepository, MongoTokenRepositoryFactory } from "../../../src/credentialservice/repositories/tokens";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { ObjectConfig } from "@binders/client/lib/config/config";
import { OneTimeLoginToken } from "@binders/binders-service-common/lib/tokens";
import { TokenBuilder } from "@binders/binders-service-common/lib/tokens";
import { TokenType } from "@binders/client/lib/clients/credentialservice/v1/contract";
import UUID from "@binders/client/lib/util/uuid";
import { buildSignConfig } from "@binders/binders-service-common/lib/tokens/jwt";
import moment from "moment";

const now = moment();
const oneWeekFromNow = now.add(7, "days").toDate();

const collectionName = "componenttest-" + UUID.random().toString();

const config = new ObjectConfig({
    mongo: {
        clusters: {
            main: {
                instances: [{ host: "127.0.0.1", port: 27017 }]
            }
        },
        collections: {
            tokens: {
                cluster: "main",
                database: "test",
                collection: collectionName
            }
        }
    },
    session: {
        secret: "fake"
    },
    logging: {
        default: {
            level: "TRACE"
        }
    }
});
const signConfig = buildSignConfig(config);
const builder = new TokenBuilder(signConfig);

function getToken(): Promise<OneTimeLoginToken> {
    const data = { userId: "uid-123" };
    return builder.build(TokenType.ONE_TIME_LOGIN, data, false, oneWeekFromNow) as Promise<OneTimeLoginToken>;
}

interface Context {
    factory: MongoTokenRepositoryFactory;
    repository: MongoTokenRepository;
    cleanup(): Promise<void>;
}

async function getContext(): Promise<Context> {
    const logger = LoggerBuilder.fromConfig(config);
    const factory = await MongoTokenRepositoryFactory.fromConfig(config, logger);
    const cleanup = async () => {
        await factory.drop();
        await mongoose.disconnect();
    }
    return {
        factory,
        repository: factory.build(logger),
        cleanup
    };
}

describe("token repository", () => {
    it("should save and fetch tokens", () => {
        return Promise.all([getContext(), getToken()]).then(([context, token]) => {
            const repo = context.repository;
            return repo
                .saveToken(token)
                .then(() => repo.getToken(token.key))
                .then(retrievedToken => {
                    expect(retrievedToken).toEqual(token);
                    const consumedToken = token.consume();
                    return repo.saveToken(consumedToken);
                })
                .then(() => repo.getTokenCount())
                .then(tokenCount => expect(tokenCount).toEqual(1))
                .then(() => repo.getToken(token.key))
                .then(retrievedToken => expect(retrievedToken).toEqual(token))
                .then(context.cleanup)
                .catch(error => {
                    return context.cleanup().then(() => {
                        throw error;
                    });
                });
        });
    });
});
