import * as mongoose from "mongoose";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import {
    MongoRepository,
    MongoRepositoryFactory
} from "@binders/binders-service-common/lib/mongo/repository";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Logger } from "@binders/binders-service-common/lib/util/logging";

export const MONGOOSE_SCHEMA = {
    accountId: { type: String, required: true },
    sessionId: { type: String, required: true },
    createdOn: { type: Date, required: true, default: Date.now },
    expirationDate: { type: Date, required: true },
};


interface IActiveSession extends mongoose.Document {
    accountId: string;
    sessionId: string;
    expirationDate: Date;
}

export interface ActiveSessionRepository {
    extendSession(accountId: string, sessionId: string, maxInactiveMinutes: number): Promise<boolean>;
    hasSessionExpired(accountId: string, sessionId: string): Promise<boolean>;
}


export class MongoActiveSessionRepository extends MongoRepository<IActiveSession> implements ActiveSessionRepository {

    async extendSession(accountId: string, sessionId: string, maxInactiveMinutes: number): Promise<boolean> {
        const hasExpired = await this.hasSessionExpired(accountId, sessionId);
        if (hasExpired) {
            return false;
        }
        const expirationDate = new Date(Date.now() + maxInactiveMinutes * 60_000);
        const activeSession = { accountId, sessionId, expirationDate } as IActiveSession;
        await this.saveEntity({ accountId, sessionId }, activeSession);
        return true;
    }

    async hasSessionExpired(accountId: string, sessionId: string): Promise<boolean> {
        const maybeSession = await this.fetchOne({ accountId, sessionId });
        if (maybeSession.isNothing()) {
            return false;
        }
        const session = maybeSession.get();
        const cutoffDate = new Date();
        return session.expirationDate.getTime() < cutoffDate.getTime();
    }

}

export class ActiveSessionRepositoryFactory extends MongoRepositoryFactory<IActiveSession> {
    getSessionSchema(collectionName: string): mongoose.Schema {
        return new mongoose.Schema(MONGOOSE_SCHEMA, { collection: collectionName });
    }

    build(logger: Logger): MongoActiveSessionRepository {
        return new MongoActiveSessionRepository(this.model, this.collection, logger);
    }

    protected updateModel(): void {
        const schema = this.getSessionSchema(this.collection.name);
        schema.index({ sessionId: 1 });
        schema.index({ accountId: 1 });
        this.model = this.collection.connection.model<IActiveSession>("ActiveSessionDAO", schema);
    }

    static async fromConfig(config: BindersConfig, logger: Logger): Promise<ActiveSessionRepositoryFactory>{
        const loginOption = getMongoLogin("credential_service");
        const collectionConfig = await CollectionConfig.promiseFromConfig(config, "activeSessions", loginOption);
        return new ActiveSessionRepositoryFactory(collectionConfig, logger)
    }
}