import * as mongoose from "mongoose";
import { BINDER_COMMENT_ID_PREFIX, BinderComment } from "./models/binderComment";
import {
    MongoRepository,
    MongoRepositoryFactory,
    Query
} from "@binders/binders-service-common/lib/mongo/repository";
import { IBinderCommentQuery } from "@binders/client/lib/clients/commentservice/v1/contract";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import UUID from "@binders/client/lib/util/uuid";
import { addTimestampMiddleware } from "@binders/binders-service-common/lib/mongo/schema";

export interface IBinderCommentDocument extends mongoose.Document {
    id: string;
    threadId: string;
    userId: string;
    body: string;
    created: Date;
    updated: Date;
    isEdited: boolean;
    markedAsDeletedAt?: Date;
}

function daoToModel(binderComment: IBinderCommentDocument): BinderComment {
    return {
        id: binderComment.id,
        threadId: binderComment.threadId,
        userId: binderComment.userId,
        body: binderComment.markedAsDeletedAt ? "" : binderComment.body,
        created: binderComment.created,
        updated: binderComment.updated,
        isEdited: binderComment.isEdited ?? false,
        markedAsDeleted: !!binderComment.markedAsDeletedAt,
    };
}

function modelToDao(binderComment: BinderComment): IBinderCommentDocument {
    return {
        id: binderComment.id,
        threadId: binderComment.threadId,
        userId: binderComment.userId,
        body: binderComment.body,
        created: binderComment.created,
        updated: binderComment.updated,
        isEdited: binderComment.isEdited,
    } as IBinderCommentDocument;
}

function getBinderCommentSchema(collectionName: string): mongoose.Schema {
    const schema = new mongoose.Schema({
        id: {
            type: String,
            required: true
        },
        threadId: {
            type: String,
            required: true
        },
        userId: {
            type: String,
            required: true
        },
        body: {
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
        },
        isEdited: {
            type: Boolean,
            default: false
        },
        markedAsDeletedAt: {
            type: Date,
        }
    }, { collection: collectionName });
    return addTimestampMiddleware(schema, "updated");
}

export interface IBinderCommentsRepository {
    createBinderComment(threadId: string, userId: string, body: string): Promise<BinderComment>;
    updateBinderCommentBody(commentId: string, body: string): Promise<void>;
    deleteBinderComment(commentId: string): Promise<void>;
    getComments(query: IBinderCommentQuery): Promise<BinderComment[]>;

    /**
     * Marks the comment as deleted without actually removing it
     * @param commentId - id of the comment to mark as deleted
     */
    softDeleteComment(commentId: string): Promise<void>;
}


export class MongoBinderCommentsRepository extends MongoRepository<IBinderCommentDocument> implements IBinderCommentsRepository {

    async createBinderComment(threadId: string, userId: string, body: string): Promise<BinderComment> {
        const binderComment: BinderComment = {
            id: UUID.randomWithPrefix(BINDER_COMMENT_ID_PREFIX),
            threadId: threadId,
            userId: userId,
            body: body,
            created: undefined,
            updated: undefined,
            isEdited: false,
        };
        const dao = await this.insertEntity(modelToDao(binderComment));
        return daoToModel(dao);
    }

    async updateBinderCommentBody(commentId: string, body: string): Promise<void> {
        await this.findOneAndUpdate({ id: commentId }, { body, isEdited: true });
    }

    async deleteBinderComment(commentId: string): Promise<void> {
        await this.deleteEntity({ id: commentId });
    }
    async getComments(query: IBinderCommentQuery): Promise<BinderComment[]> {
        const { threadIds, id, createdAfter, createdBefore } = query;
        const matchObj: Query = {};
        if (id) {
            matchObj["id"] = id;
        } else {
            if (threadIds) {
                matchObj["$or"] = threadIds.map(threadId => ({ threadId }));
            }
            if (createdAfter || createdBefore) {
                matchObj["created"] = {
                    ...createdAfter ? mongoose.trusted({ $gte: new Date(createdAfter) }) : {},
                    ...createdBefore ? mongoose.trusted({ $lte: new Date(createdBefore) }) : {},
                };
            }
        }
        if (Object.keys(matchObj).length) {
            const daos = await this.findEntities(matchObj);
            return daos ? daos.map(dao => daoToModel(dao)) : [];
        }
        return [];
    }

    async softDeleteComment(commentId: string): Promise<void> {
        await this.findOneAndUpdate({ id: commentId }, { markedAsDeletedAt: new Date() });
    }
}

export class BinderCommentsRepositoryFactory extends MongoRepositoryFactory<IBinderCommentDocument> {

    build(logger: Logger): MongoBinderCommentsRepository {
        return new MongoBinderCommentsRepository(this.model, this.collection, logger);
    }

    updateModel(): void {
        const schema = getBinderCommentSchema(this.collection.name);
        schema.index({ id: 1 }, { unique: true });
        this.model = this.collection.connection.model<IBinderCommentDocument>("BinderCommentDAO", schema);
    }

}
