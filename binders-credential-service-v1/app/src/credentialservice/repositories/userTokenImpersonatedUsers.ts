import * as mongoose from "mongoose";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { MongoRepository, MongoRepositoryFactory } from "@binders/binders-service-common/lib/mongo/repository";
import { Config } from "@binders/client/lib/config/config";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { addTimestampMiddleware } from "@binders/binders-service-common/lib/mongo/schema";

export interface IImpersonatedUser extends mongoose.Document {
    impersonatedUserId: string;
    userId: string;
    userAgent: string;
    clientIp: string;
}

export interface UserTokenImpersonatedUserRepository {
    saveImpersonatedUser(impersonatedUserId: string, userId: string, userAgent: string, clientIp: string): Promise<IImpersonatedUser>;
}

function getUserTokenImpersonatedUserSchema(collectionName): mongoose.Schema {
    const schema = new mongoose.Schema(
        {
            impersonatedUserId: {
                type: String,
                required: true
            },
            userId: {
                type: String,
                required: true
            },
            userAgent: {
                type: String,
                required: true
            },
            clientIp: {
                type: String,
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

export class MongoUserTokenImpersonatedUserRepository extends MongoRepository<IImpersonatedUser> implements UserTokenImpersonatedUserRepository {

    saveImpersonatedUser(impersonatedUserId: string, userId: string, userAgent: string, clientIp: string): Promise<IImpersonatedUser> {
        const impersonatedUser = {
            impersonatedUserId,
            userId,
            userAgent,
            clientIp,
        };
        return this.saveEntity({ impersonatedUserId }, impersonatedUser as IImpersonatedUser);
    }

}

export class MongoUserTokenImpersonatedUserRepositoryFactory extends MongoRepositoryFactory<IImpersonatedUser> {
    build(logger: Logger): MongoUserTokenImpersonatedUserRepository {
        return new MongoUserTokenImpersonatedUserRepository(this.model, this.collection, logger);
    }

    protected updateModel(): void {
        const schema = getUserTokenImpersonatedUserSchema(this.collection.name);
        schema.index({ impersonatedUserId: 1 }, { unique: true });
        this.model = this.collection.connection.model<IImpersonatedUser>("ImpersonatedUserDAO", schema);
    }

    static fromConfig(config: Config, logger: Logger): Promise<MongoUserTokenImpersonatedUserRepositoryFactory> {
        const loginOption = getMongoLogin("credential_service");
        return CollectionConfig.fromConfig(config, "credentials", loginOption)
            .caseOf({
                left: error => Promise.reject(error),
                right: ccfg => Promise.resolve(ccfg)
            })
            .then(collectionConfig => new MongoUserTokenImpersonatedUserRepositoryFactory(collectionConfig, logger));
    }
}