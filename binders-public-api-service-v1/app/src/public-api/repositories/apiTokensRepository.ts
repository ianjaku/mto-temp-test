import * as mongoose from "mongoose";
import {
    MongoRepository,
    MongoRepositoryFactory
} from  "@binders/binders-service-common/lib/mongo/repository";
import { ApiTokenModel } from "./models/apiTokenModel";
import { Logger } from "@binders/binders-service-common/lib/util/logging";

export interface ApiTokenDao extends mongoose.Document {
    uuid: string;
    accountId: string;
    userId: string;
    created: Date;
}

function daoToModel(dao: ApiTokenDao): ApiTokenModel {
    return new ApiTokenModel(
        dao.uuid,
        dao.accountId,
        dao.userId,
        dao.created
    );
}

function modelToDao(model: ApiTokenModel): ApiTokenDao {
    return <ApiTokenDao>{
        uuid: model.uuid,
        accountId: model.accountId,
        userId: model.userId,
        created: model.created
    };
}

function getSchema(collectionName: string) {
    return new mongoose.Schema({
        uuid: {
            type: String,
            required: true
        },
        accountId: {
            type: String,
            required: true
        },
        userId: {
            type: String,
            required: true
        },
        created: {
            type: Date,
            default: Date.now
        },
    }, { collection: collectionName });
}

export interface ApiTokenRepository {
    store(model: ApiTokenModel): Promise<ApiTokenModel>;
    getByUuid(uuid: string): Promise<ApiTokenModel | null>;
    getForUser(accountId: string, userId: string): Promise<ApiTokenModel | null>;
}

export class MongoApiTokenRepository
    extends MongoRepository<ApiTokenDao>
    implements ApiTokenRepository
{
    async getForUser(accountId: string, userId: string): Promise<ApiTokenModel> {
        const dao = await this.fetchOne({ userId, accountId })
        if (dao.isNothing()) return null;
        return daoToModel(dao.get());
    }

    async store(model: ApiTokenModel): Promise<ApiTokenModel> {
        const createdDao = await this.upsert(
            { accountId: model.accountId, userId: model.userId },
            modelToDao(model)
        );
        return daoToModel(createdDao);
    }

    async getByUuid(uuid: string): Promise<ApiTokenModel> {
        const dao = await this.fetchOne({ uuid });
        if (dao.isNothing()) return null;
        return daoToModel(dao.get());
    }

}

export class ApiTokenRepositoryFactory
    extends MongoRepositoryFactory<ApiTokenDao>
{

    build(logger: Logger): MongoApiTokenRepository {
        return new MongoApiTokenRepository(this.model, this.collection, logger);
    }

    updateModel(): void {
        const schema = getSchema(this.collection.name);
        schema.index({ uuid: 1 }, { unique: true });
        this.model = this.collection.connection.model<ApiTokenDao> (
            "ApiTokenDao",
            schema
        );
    }
}

