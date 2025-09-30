import * as mongoose from "mongoose";
import { MongoRepository, MongoRepositoryFactory } from "@binders/binders-service-common/lib/mongo/repository";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { Maybe } from "@binders/client/lib/monad";
import { UserIdentifier } from "@binders/binders-service-common/lib/authentication/identity";
import { UserPreferences } from "@binders/client/lib/clients/userservice/v1/contract";
import { addTimestampMiddleware } from "@binders/binders-service-common/lib/mongo/schema";

export interface UserPreferenceRepository {
    getPreferences(userId: UserIdentifier): Promise<UserPreferences>;
    getPreferencesMulti(userIds: Array<UserIdentifier>): Promise<Array<UserPreferences>>;
    savePreferences(userId: UserIdentifier, preferences: UserPreferences): Promise<UserPreferences>;
    insertPreferences(preferences: Array<UserPreferences>): Promise<Array<UserPreferences>>;
}

export interface IUserPreferences extends mongoose.Document, UserPreferences {
    userId: string;
}


const DEFAULT_PREFERENCES: UserPreferences = {
    userId: undefined,
    readerLanguages: [],
    interfaceLanguage: undefined,
    acknowledgementCookies: undefined,
    defaultAnalyticsRange: undefined,
};

function modelToDAO(userPreferences: UserPreferences, userId: UserIdentifier) {
    return <IUserPreferences>Object.assign({ userId: userId.value() }, userPreferences);
}

function daoToModel(dao: IUserPreferences): UserPreferences {
    return {
        userId: dao.userId,
        readerLanguages: dao.readerLanguages,
        interfaceLanguage: dao.interfaceLanguage,
        acknowledgementCookies: dao.acknowledgementCookies,
        defaultAnalyticsRange: dao.defaultAnalyticsRange,
    };
}

function getUserPreferencesSchema(collectionName): mongoose.Schema {
    const schema = new mongoose.Schema({
        userId: {
            type: String,
            unique: true,
            require: true
        },
        readerLanguages: {
            type: [String],
            require: true
        },
        interfaceLanguage: {
            type: String,
            require: false
        },
        acknowledgementCookies: {
            type: Boolean,
            default: null
        },
        defaultAnalyticsRange: {
            type: String
        },
        created: {
            type: Date,
            default: Date.now
        },
        updated: {
            type: Date,
            default: Date.now
        }
    }, { collection: collectionName });
    return addTimestampMiddleware(schema, "updated");
}

export class MongoPreferenceRepositoryFactory extends MongoRepositoryFactory<IUserPreferences> {

    build(logger: Logger): MongoPreferenceRepository {
        return new MongoPreferenceRepository(this.model, this.collection, logger);
    }

    updateModel(): void {
        const schema = getUserPreferencesSchema(this.collection.name);
        this.model = this.collection.connection.model<IUserPreferences>("UserPreferencesDAO", schema);
    }
}

export class MongoPreferenceRepository extends MongoRepository<IUserPreferences> implements UserPreferenceRepository {
    getPreferences(userId: UserIdentifier): Promise<UserPreferences> {
        return this.fetchOne({ userId: userId.value() })
            .then((preferenceOption: Maybe<UserPreferences>) => preferenceOption
                .lift(daoToModel)
                .getOrElse(DEFAULT_PREFERENCES)
            );
    }

    async getPreferencesMulti(userIds: UserIdentifier[]): Promise<UserPreferences[]> {
        const daos = await this.findEntities({ userId: mongoose.trusted({ $in: userIds.map(id => id.value()) }) });
        return daos.map(daoToModel);
    }

    savePreferences(userId: UserIdentifier, preferences: UserPreferences): Promise<UserPreferences> {
        return this.saveEntity({ userId: userId.value() }, modelToDAO(preferences, userId));
    }

    insertPreferences(preferences: Array<UserPreferences>): Promise<Array<UserPreferences>> {
        return this.insertMany(preferences.map(modelPreference => {
            return modelToDAO(modelPreference, new UserIdentifier(modelPreference.userId));
        })).then(storedUserPreferences => storedUserPreferences.map(daoToModel));
    }

}
