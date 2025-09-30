import * as mongoose from "mongoose";
import {
    FeedbackFilter,
    FeedbackParams
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    MongoRepository,
    MongoRepositoryFactory
} from "@binders/binders-service-common/lib/mongo/repository";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import UUID from "@binders/client/lib/util/uuid";
import { addTimestampMiddleware } from "@binders/binders-service-common/lib/mongo/schema";

export interface BinderFeedbackModel {
    id: string,
    created: Date,
    updated: Date,
    accountId: string,
    binderId: string,
    publicationId: string,
    userId: string,
    isAnonymous: boolean,
    rating?: number,
    message?: string,
}

export interface IFeedbackDocument extends mongoose.Document {
    id: string;
    accountId: string;
    binderId: string;
    publicationId: string;
    userId: string;
    rating: number;
    isAnonymous: boolean;
    message: string;
    created: Date;
    updated: Date;
}

function daoToModel(feedback: IFeedbackDocument): BinderFeedbackModel {
    return {
        id: feedback.id,
        created: feedback.created,
        updated: feedback.updated,
        accountId: feedback.accountId,
        binderId: feedback.binderId,
        publicationId: feedback.publicationId,
        userId: feedback.userId,
        isAnonymous: feedback.isAnonymous,
        rating: feedback.rating,
        message: feedback.message,
    };
}

function modelToDao(model: BinderFeedbackModel): IFeedbackDocument {
    return <IFeedbackDocument>model;
}

function getFeedbackSchema(collectionName: string): mongoose.Schema {
    const schema = new mongoose.Schema({
        id: {
            type: String,
            required: true,
        },
        binderId: {
            type: String,
            required: true,
        },
        publicationId: {
            type: String,
            required: true,
        },
        created: {
            type: Date,
            default: Date.now,
        },
        updated: {
            type: Date,
            default: Date.now,
        },
        userId: {
            type: String,
            required: false,
        },
        accountId: {
            type: String,
            required: true,
        },
        isAnonymous: {
            type: Boolean,
            required: true,
        },
        message: {
            type: String,
            required: false,
        },
        rating: {
            type: Number,
            required: false,
        },
    }, { collection: collectionName });
    return addTimestampMiddleware(schema, "updated");
}

export interface UpdateFeedbackParams {
    id: string,
    isAnonymous: boolean,
    message?: string,
    rating?: number,
}
export interface IFeedbackRepository {
    getFeedbackByPublicationUser(publicationId: string, userId: string): Promise<BinderFeedbackModel | null>;
    getBinderFeedbacks(binderId: string): Promise<BinderFeedbackModel[]>;
    getBinderUserFeedbacksOrderedDesc(binderId: string, userId: string): Promise<BinderFeedbackModel[]>;
    createFeedback(accountId: string, binderId: string, publicationId: string, userId: string, feedbackParams: FeedbackParams): Promise<BinderFeedbackModel>;
    deleteFeedback(feedbackId: string): Promise<void>;
    updateFeedback(params: UpdateFeedbackParams): Promise<BinderFeedbackModel>;
    getFeedbacks(filter: FeedbackFilter): Promise<BinderFeedbackModel[]>;
}

export class MongoFeedbackRepository extends MongoRepository<IFeedbackDocument> implements IFeedbackRepository {
    async getFeedbackByPublicationUser(
        publicationId: string,
        userId: string,
    ): Promise<BinderFeedbackModel | null> {
        const query = { publicationId, userId };
        const daos = await this.findEntities(query, { orderByField: "updated", sortOrder: "descending" });
        return daos.length ? daoToModel(daos[0]) : null;
    }

    async getBinderFeedbacks(binderId: string): Promise<BinderFeedbackModel[]> {
        const query = { binderId };
        const daos = await this.findEntities(query, { orderByField: "updated", sortOrder: "descending" });
        return daos.map(dao => daoToModel(dao));
    }

    async getBinderUserFeedbacksOrderedDesc(binderId: string, userId: string): Promise<BinderFeedbackModel[]> {
        const query = { binderId, userId };
        const daos = await this.findEntities(query, { orderByField: "created", sortOrder: "descending" });
        return daos.map(daoToModel);
    }

    async createFeedback(accountId: string, binderId: string, publicationId: string, userId: string, feedbackParams: FeedbackParams): Promise<BinderFeedbackModel> {
        const now = new Date();
        const feedback = {
            id: UUID.randomWithPrefix("bfid-"),
            created: now,
            updated: now,
            accountId: accountId,
            binderId: binderId,
            publicationId: publicationId,
            userId: userId,
            isAnonymous: !userId || feedbackParams.isAnonymous,
            rating: feedbackParams.rating,
            message: feedbackParams.message,
        };
        const dao = await this.insertEntity(modelToDao(feedback));
        return daoToModel(dao);
    }

    async deleteFeedback(feedbackId: string): Promise<void> {
        await this.deleteOne({ id: feedbackId });
    }

    async updateFeedback(params: UpdateFeedbackParams): Promise<BinderFeedbackModel> {
        const dao = await this.findOneAndUpdate({ id: params.id }, {
            isAnonymous: params.isAnonymous,
            message: params.message,
            rating: params.rating,
        }, {
            new: true,
        });
        return daoToModel(dao);
    }

    async getFeedbacks(filter: FeedbackFilter): Promise<BinderFeedbackModel[]> {
        const { createdAfter, createdBefore, accountId } = filter;
        const matchObj = {};
        if (createdAfter || createdBefore) {
            matchObj["created"] = {
                ...createdAfter ? mongoose.trusted({ $gte: createdAfter }) : {},
                ...createdBefore ? mongoose.trusted({ $lte: createdBefore }) : {},
            };
        }
        if (accountId) {
            matchObj["accountId"] = accountId;
        }
        if (Object.keys(matchObj).length) {
            const daos = await this.findEntities(matchObj);
            return daos ? daos.map(dao => daoToModel(dao)) : [];
        }
        return [];
    }
}

export class FeedbackRepositoryFactory extends MongoRepositoryFactory<IFeedbackDocument> {

    build(logger: Logger): MongoFeedbackRepository {
        return new MongoFeedbackRepository(this.model, this.collection, logger);
    }

    updateModel(): void {
        const schema = getFeedbackSchema(this.collection.name);
        schema.index({ id: 1 }, { unique: true });
        schema.index({ binderId: 1 }, { unique: false });
        schema.index({ binderId: 1, userId: 1 }, { unique: false });
        this.model = this.collection.connection.model<IFeedbackDocument>("BinderFeedbackDAO", schema);
    }

}

