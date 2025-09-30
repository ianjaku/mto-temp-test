import * as mongoose from "mongoose";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { InvalidCredential, LoginAndPassword, LoginNotFound, UserIdNotFound } from "../model";
import {
    Login,
    UserIdentifier
} from "@binders/binders-service-common/lib/authentication/identity";
import {
    MongoRepository,
    MongoRepositoryFactory
} from "@binders/binders-service-common/lib/mongo/repository";
import { Config } from "@binders/client/lib/config/config";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { PasswordHashDeserializer } from "../deserializer";
import { addTimestampMiddleware } from "@binders/binders-service-common/lib/mongo/schema";

export interface CredentialsRepository {
    getLoginFromUserId(userId: UserIdentifier): Promise<LoginAndPassword>;
    getLoginsFromUserIds(userIds: string[]): Promise<Map<string, LoginAndPassword>>;
    updateLogin(userId: string, login: string): Promise<LoginAndPassword>;
    insertLoginAndPassword(loginAndPassword: LoginAndPassword): Promise<LoginAndPassword>;
    getLoginAndPassword(login: Login): Promise<LoginAndPassword>;
    updatePassword(login: LoginAndPassword): Promise<LoginAndPassword>;
    createOrUpdateCredential(loginAndPassword: LoginAndPassword): Promise<void>;
}

export interface ILoginAndPasswordDAO extends mongoose.Document {
    userId: string;
    login: string;
    password: string;
    lastPasswordChange: Date;
    blocked: boolean;
}

function getLoginAndPasswordSchema(collectionName: string): mongoose.Schema {
    const schema = new mongoose.Schema(
        {
            userId: {
                type: String,
                required: true
            },
            login: {
                type: String,
                required: true
            },
            password: {
                type: String,
                required: true
            },
            lastPasswordChange: {
                type: Date,
                required: true
            },
            blocked: {
                type: Boolean,
                required: true
            },
            deleted: Boolean,
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

function daoToModel(dao: ILoginAndPasswordDAO): LoginAndPassword {
    const blocked = dao.blocked;
    const lastPasswordChange = dao.lastPasswordChange;
    const userId = new UserIdentifier(dao.userId);
    const login = new Login(dao.login);
    const password = PasswordHashDeserializer.deserialize(dao.password);
    return new LoginAndPassword(userId, blocked, login, password, lastPasswordChange);
}

function modelToDao(loginAndPassword: LoginAndPassword) {
    return {
        userId: loginAndPassword.userId.value(),
        login: loginAndPassword.login.value().toLowerCase(),
        password: loginAndPassword.passwordHash.serialize(),
        lastPasswordChange: loginAndPassword.lastPasswordChange,
        blocked: loginAndPassword.blocked
    };
}

export class MongoCredentialRepository extends MongoRepository<ILoginAndPasswordDAO> implements CredentialsRepository {
    async getLoginFromUserId(userId: UserIdentifier): Promise<LoginAndPassword> {
        const result = await this.findOne({ userId: userId.value() });
        if (result == null) {
            throw new UserIdNotFound(`UserId ${userId.value()} not found`);
        }
        return daoToModel(result);
    }

    async getLoginsFromUserIds(userIds: string[]): Promise<Map<string, LoginAndPassword>> {
        const results = await this.findEntities({ userId: mongoose.trusted({ $in: userIds.map(String) }) });
        const loginsAndPassword = results.map(daoToModel);
        return new Map(loginsAndPassword.map(l => [l.userId.value(), l]));
    }

    async updateLogin(userId: string, login: string): Promise<LoginAndPassword> {
        try {
            const updatedUser = await this.findOneAndUpdate({ userId }, { login }, { new: true });
            return daoToModel(updatedUser);
        } catch (error) {
            throw new UserIdNotFound(`UserId ${userId} not found`);
        }
    }

    getLoginAndPassword(login: Login): Promise<LoginAndPassword> {
        return this.fetchOne(this.queryByLogin(login)).then(storedOption => {
            if (storedOption.isJust()) {
                return daoToModel(storedOption.get());
            } else {
                throw new LoginNotFound(login.value().toLowerCase());
            }
        });
    }

    insertLoginAndPassword(loginAndPassword: LoginAndPassword): Promise<LoginAndPassword> {
        const dao = modelToDao(loginAndPassword);
        return this.insertEntity(<ILoginAndPasswordDAO>dao).then(daoToModel);
    }

    private queryByLogin(login: Login) {
        return { login: login.value().trim().toLowerCase(), deleted: mongoose.trusted({ $ne: true }) };
    }

    async updatePassword(loginAndPassword: LoginAndPassword): Promise<LoginAndPassword> {
        const query = {
            login: loginAndPassword.login.value().trim().toLowerCase(),
            userId: loginAndPassword.userId.value(),
            deleted: mongoose.trusted({ $ne: true })
        };
        try {
            const result = await this.findOneAndUpdate(query, {
                password: loginAndPassword.passwordHash.serialize(),
                lastPasswordChange: new Date(),
            }, { new: true });
            return daoToModel(result);
        } catch (e) {
            throw new LoginNotFound(loginAndPassword.login.value().toLowerCase());
        }
    }

    async deleteCredentialByUserId(userId: string): Promise<void> {
        await this.deleteOne({ userId })
    }

    async createOrUpdateCredential(loginAndPassword: LoginAndPassword): Promise<void> {
        const dao = modelToDao(loginAndPassword);
        const results = await this.findEntities({
            $or: [
                { userId: dao.userId },
                { login: dao.login }
            ]
        });
        if (results.length > 1) {
            throw new InvalidCredential();
        }
        if (results.length === 1 && (results[0].userId !== dao.userId || results[0].login !== dao.login)) {
            throw new InvalidCredential();
        }
        await this.upsert({
            userId: dao.userId
        }, dao as ILoginAndPasswordDAO);
    }
}

export class MongoCredentialRepositoryFactory extends MongoRepositoryFactory<ILoginAndPasswordDAO> {
    build(logger: Logger): MongoCredentialRepository {
        return new MongoCredentialRepository(this.model, this.collection, logger);
    }

    protected updateModel(): void {
        const schema = getLoginAndPasswordSchema(this.collection.name);
        schema.index({ login: 1 }, { unique: true });
        this.model = this.collection.connection.model<ILoginAndPasswordDAO>("LoginAndPasswordDAO", schema);
    }

    static fromConfig(config: Config, logger: Logger): Promise<MongoCredentialRepositoryFactory> {
        const loginOption = getMongoLogin("credential_service");
        return CollectionConfig.fromConfig(config, "credentials", loginOption)
            .caseOf({
                left: error => Promise.reject(error),
                right: ccfg => Promise.resolve(ccfg)
            })
            .then(collectionConfig => new MongoCredentialRepositoryFactory(collectionConfig, logger));
    }
}
