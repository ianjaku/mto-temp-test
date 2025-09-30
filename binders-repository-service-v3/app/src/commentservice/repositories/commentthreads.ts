import * as mongoose from "mongoose";
import {
    CommentThreadOrigin,
    CommentThreadsFilter
} from "@binders/client/lib/clients/commentservice/v1/contract";
import {
    MongoRepository,
    MongoRepositoryFactory
} from "@binders/binders-service-common/lib/mongo/repository";
import { CommentThread } from "./models/commentThread";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { addTimestampMiddleware } from "@binders/binders-service-common/lib/mongo/schema";

export interface ICommentThreadDocument extends mongoose.Document {
    id: string;
    binderId: string;
    chunkId: string;
    languageCode: string;
    origin: CommentThreadOrigin;
    resolved: boolean;
    resolvedBy: string;
    resolvedDate: Date;
    created: Date;
    updated: Date;
    publicationId?: string;
    createdById: string;
    accountId: string;
}

function daoToModel(commentThread: ICommentThreadDocument): CommentThread {
    return new CommentThread(
        commentThread.id,
        commentThread.binderId,
        commentThread.chunkId,
        commentThread.languageCode,
        // Old editor comments don't have their origin set
        commentThread.origin ?? CommentThreadOrigin.Editor,
        commentThread.resolved,
        commentThread.resolvedBy,
        commentThread.resolvedDate,
        commentThread.created,
        commentThread.updated,
        commentThread.publicationId,
        commentThread.createdById,
        commentThread.accountId
    );
}

function modelToDao(commentThread: CommentThread): ICommentThreadDocument {
    return <ICommentThreadDocument>{
        id: commentThread.id,
        binderId: commentThread.binderId,
        chunkId: commentThread.chunkId,
        languageCode: commentThread.languageCode,
        origin: commentThread.origin,
        resolved: commentThread.resolved,
        resolvedBy: commentThread.resolvedBy,
        resolvedDate: commentThread.resolvedDate,
        created: commentThread.created,
        updated: commentThread.updated,
        publicationId: commentThread.publicationId,
        createdById: commentThread.createdById,
        accountId: commentThread.accountId
    };
}

function getCommentThreadSchema(collectionName: string): mongoose.Schema {
    const schema = new mongoose.Schema({
        id: {
            type: String,
            required: true
        },
        binderId: {
            type: String,
            required: true
        },
        chunkId: {
            type: String,
            required: true
        },
        languageCode: {
            type: String,
            required: true
        },
        origin: {
            type: String,
            required: true
        },
        publicationId: {
            type: String,
            required: false,
            default: null
        },
        resolved: {
            type: Boolean,
            required: true
        },
        resolvedBy: {
            type: String,
            required: false
        },
        resolvedDate: {
            type: Date,
            required: false
        },
        created: {
            type: Date,
            default: Date.now
        },
        updated: {
            type: Date,
            default: Date.now
        },
        createdById: {
            type: String,
            required: true
        },
        accountId: {
            type: String,
            required: true
        }
    }, { collection: collectionName });
    return addTimestampMiddleware(schema, "updated");
}

export interface ICommentThreadsRepository {
    findThreadById(threadId: string): Promise<CommentThread | null>;
    findUnresolvedThreads(binderIds: string[]): Promise<CommentThread[]>;
    getThreads(binderId: string): Promise<CommentThread[]>;
    getThreadsByUserInBinder(binderId: string, userId: string, origin?: CommentThreadOrigin): Promise<CommentThread[]>;
    insertThread(thread: CommentThread): Promise<CommentThread>;
    resolveThread(threadId: string, userId: string): Promise<void>;
    deleteThread(threadId: string): Promise<void>;
    changeThreadsLanguage(binderId: string, oldLanguageCode: string, newLanguageCode: string): Promise<void>;
    migrateThreads(sourceChunkId: string, targetChunkId: string): Promise<void>;
    findThreads(filter: CommentThreadsFilter): Promise<CommentThread[]>;
}

export class MongoCommentThreadsRepository extends MongoRepository<ICommentThreadDocument> implements ICommentThreadsRepository {

    async findThreadById(threadId: string): Promise<CommentThread | null> {
        const [dao] = await this.findEntities({ id: threadId });
        return dao == null ? null : daoToModel(dao);
    }

    async findUnresolvedThreads(binderIds: string[]): Promise<CommentThread[]> {
        const daos = await this.findEntities({ binderId: mongoose.trusted({ $in: binderIds.map(String) }), resolved: false });
        return daos ? daos.map(dao => daoToModel(dao)) : [];
    }
    async getThreads(binderId: string): Promise<CommentThread[]> {
        const query = { binderId };
        const daos = await this.findEntities(query);
        return daos ? daos.map(dao => daoToModel(dao)) : [];
    }
    async getThreadsByUserInBinder(
        binderId: string,
        createdById: string,
        origin?: CommentThreadOrigin
    ): Promise<CommentThread[]> {
        const query = { binderId, createdById };
        if (origin) {
            query["origin"] = origin;
        }
        const daos = await this.findEntities(query);
        return daos ? daos.map(dao => daoToModel(dao)) : [];
    }
    async insertThread(thread: CommentThread): Promise<CommentThread> {
        const dao = await this.insertEntity(modelToDao(thread));
        return daoToModel(dao);
    }
    async resolveThread(threadId: string, userId: string): Promise<void> {
        const [threadDao] = await this.findEntities({ id: threadId });
        const thread = daoToModel(threadDao);
        await this.saveEntity({ id: threadId }, modelToDao({ ...thread, resolved: true, resolvedBy: userId, resolvedDate: new Date() }));
    }
    async deleteThread(threadId: string): Promise<void> {
        await this.deleteEntity({ id: threadId });
    }
    async changeThreadsLanguage(binderId: string, oldLanguageCode: string, newLanguageCode: string): Promise<void> {
        await this.updateMany(
            { binderId, languageCode: oldLanguageCode },
            { $set: { languageCode: newLanguageCode } }
        );
    }

    async migrateThreads(sourceChunkId: string, targetChunkId: string): Promise<void> {
        const threadDaos = await this.findEntities({ chunkId: sourceChunkId });
        const threads = threadDaos.map(daoToModel);
        await Promise.all(threads.map(thread => {
            return this.saveEntity({ id: thread.id }, modelToDao({ ...thread, chunkId: targetChunkId }));
        }));
    }

    async findThreads(filter: CommentThreadsFilter): Promise<CommentThread[]> {
        const { ids, accountId, resolved } = filter;
        const matchObj = {};
        if (ids) {
            matchObj["id"] = mongoose.trusted({ $in: ids.map(String) });
        }
        if (accountId) {
            matchObj["accountId"] = accountId;
        }
        if (typeof resolved === "boolean") {
            matchObj["resolved"] = resolved;
        }
        if (Object.keys(matchObj).length) {
            const daos = await this.findEntities(matchObj);
            return daos ? daos.map(dao => daoToModel(dao)) : [];
        }
        return [];
    }
}

export class CommentThreadsRepositoryFactory extends MongoRepositoryFactory<ICommentThreadDocument> {

    build(logger: Logger): MongoCommentThreadsRepository {
        return new MongoCommentThreadsRepository(this.model, this.collection, logger);
    }

    updateModel(): void {
        const schema = getCommentThreadSchema(this.collection.name);
        schema.index({ id: 1 }, { unique: true });
        this.model = this.collection.connection.model<ICommentThreadDocument>("CommentThreadDAO", schema);
    }
}
