import * as mongoose from "mongoose";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { GenericToken, TokenFactory } from "@binders/binders-service-common/lib/tokens";
import { MongoRepository, MongoRepositoryFactory } from "@binders/binders-service-common/lib/mongo/repository";
import { TokenType, UserIdWithToken } from "@binders/client/lib/clients/credentialservice/v1/contract";
import { Config } from "@binders/client/lib/config/config";
import { EntityNotFound } from "@binders/client/lib/clients/model";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { addTimestampMiddleware } from "@binders/binders-service-common/lib/mongo/schema";

export interface TokenRepository {
    saveToken(token: GenericToken): Promise<GenericToken>;
    getToken(key: string): Promise<GenericToken>;
    getTokenCount(): Promise<number>;
    getTokensForUsers(userIds: string[]): Promise<UserIdWithToken[]>;
}

export class TokenNotFound extends EntityNotFound {
    constructor(key: string) {
        super(`Token with key ${key} not found`);
    }
}

export interface CredentialData {
    userId: string;
    consumed?: Date;
}

export interface ITokenDAO extends mongoose.Document {
    key: string;
    type: TokenType;
    data: CredentialData;
    invalidated: boolean;
    expirationDate: Date;
}

function getTokenSchema(collectionName): mongoose.Schema {
    const schema = new mongoose.Schema(
        {
            key: {
                type: String,
                required: true
            },
            type: {
                type: Number,
                required: true
            },
            data: {
                type: {
                    userId: {
                        type: String,
                        required: true,
                    },
                    consumed: Date,
                },
                required: true
            },
            invalidated: {
                type: Boolean,
                required: true
            },
            expirationDate: {
                type: Date,
                required: true
            },
            created: {
                type: Date,
                default: Date.now
            },
            updated: {
                type: Date,
                default: Date.now
            }
        },
        { collection: collectionName }
    );
    return addTimestampMiddleware(schema, "updated");
}

function daoToModel(dao: ITokenDAO): GenericToken {
    return TokenFactory.getToken(dao.key, dao.type, dao.data, dao.invalidated, dao.expirationDate);
}

function modelToDao(model: GenericToken): ITokenDAO {
    return <ITokenDAO>{
        key: model.key,
        type: model.type,
        data: model.data,
        invalidated: model.invalidated,
        expirationDate: model.expirationDate
    };
}

export class MongoTokenRepository extends MongoRepository<ITokenDAO> implements TokenRepository {
    saveToken(token: GenericToken): Promise<GenericToken> {
        const dao = modelToDao(token);
        return this.saveEntity({ key: dao.key }, dao).then(daoToModel);
    }

    getToken(key: string): Promise<GenericToken> {
        return this.fetchOne({ key }).then(daoOption => {
            if (daoOption.isJust()) {
                return daoToModel(daoOption.get());
            }
            throw new TokenNotFound(key);
        });
    }

    getTokenCount(): Promise<number> {
        return this.model.countDocuments({}).exec();
    }

    getTokensForUsers(userIds: string[]): Promise<UserIdWithToken[]> {
        const queryUserIds = { "data.userId": mongoose.trusted({ $in: userIds.map(String) }) };
        const options = {
            batchSize: userIds.length + 1
        };
        return this.findEntities(queryUserIds, options).then(results => {
            return results.map(result => ({
                userId: result.data.userId,
                token: result.key,
            }));
        });
    }
}

export class MongoTokenRepositoryFactory extends MongoRepositoryFactory<ITokenDAO> {
    build(logger: Logger): MongoTokenRepository {
        return new MongoTokenRepository(this.model, this.collection, logger);
    }

    protected updateModel(): void {
        const schema = getTokenSchema(this.collection.name);
        schema.index({ key: 1 }, { unique: true });
        this.model = this.collection.connection.model<ITokenDAO>("TokenDAO", schema);
    }

    static fromConfig(config: Config, logger: Logger): Promise<MongoTokenRepositoryFactory> {
        const loginOption = getMongoLogin("credential_service");
        return CollectionConfig.fromConfig(config, "tokens", loginOption)
            .caseOf({
                left: error => Promise.reject(error),
                right: ccfg => Promise.resolve(ccfg)
            })
            .then(collectionConfig => new MongoTokenRepositoryFactory(collectionConfig, logger));
    }
}
