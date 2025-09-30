import * as mongoose from "mongoose";
import {
    BinderApprovalStatus,
    BinderStatusFilter,
    BinderStatusForAccount
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    MongoRepository,
    MongoRepositoryFactory,
    Query,
    SearchOptions
} from "@binders/binders-service-common/lib/mongo/repository";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { addTimestampMiddleware } from "@binders/binders-service-common/lib/mongo/schema";
import { pick } from "ramda";

/**
 * This repository is used as a cache to store precalculated (via cronjob) binder statuses,
 * which are returned in the public API (findBindersStatuses endpoint)
 */

export interface BinderStatusCacheDocument extends mongoose.Document {
    accountId: string;
    parentTitles: string[];
    id: string;
    title: string;
    chunkCount: number;
    lastModificationDate: Date;
    lastPublicationDate: Date;
    isPublic: boolean;
    created: Date;
    hasDraft: boolean;
    approvalStatus: BinderApprovalStatus;
    openThreadCount: number;
    editorLink: string;
    publishedLanguages: string[];
    draftLanguages: string[];
    binderCreationDate?: Date;
}

export interface IBinderStatusCacheRepository {
    upsertBinderStatuses(binderStatuses: BinderStatusForAccount[]): Promise<void>;
    findBinderStatuses(binderStatusFilter: BinderStatusFilter): Promise<BinderStatusForAccount[]>;
}

export class BinderStatusCacheRepository extends MongoRepository<BinderStatusCacheDocument> implements IBinderStatusCacheRepository {

    async upsertBinderStatuses(binderStatuses: BinderStatusForAccount[]): Promise<void> {
        const daos = binderStatuses.map(bs => modelToDao(bs));
        const updated = new Date();
        const bulk = daos.map(dao => {
            return {
                updateOne: {
                    filter: { accountId: dao.accountId, id: dao.id },
                    update: { ...dao, updated },
                    upsert: true,
                }
            };
        });
        await this.bulkWrite(bulk);
    }

    async findBinderStatuses(filter: BinderStatusFilter, options?: SearchOptions): Promise<BinderStatusForAccount[]> {
        const query: Query = {};
        if (filter.accountId) {
            query.accountId = filter.accountId;
        }
        if (filter.updatedAfter) {
            query.updated = mongoose.trusted({ $gt: new Date(filter.updatedAfter) });
        }
        const daos = await this.findEntities(query, options);
        return daos.map(daoToModel);
    }
}

export class BinderStatusCacheRepositoryFactory extends MongoRepositoryFactory<BinderStatusCacheDocument> {
    build(logger: Logger): BinderStatusCacheRepository {
        return new BinderStatusCacheRepository(this.model, this.collection, logger)
    }

    updateModel(): void {
        const schema = getBinderStatusSchema(this.collection.name);
        schema.index({ accountId: 1, id: 1 }, { unique: true });
        this.model = this.collection.connection.model<BinderStatusCacheDocument>("BinderStatusCacheDAO", schema)
    }
}

function getBinderStatusSchema(collection: string): mongoose.Schema {
    const schema = new mongoose.Schema({
        accountId: {
            type: String,
            required: true
        },
        parentTitles: {
            type: [String],
            required: true
        },
        id: {
            type: String,
            required: true
        },
        title: {
            type: String,
            required: true
        },
        chunkCount: {
            type: Number,
            required: true
        },
        lastModificationDate: Date,
        lastPublicationDate: Date,
        isPublic: {
            type: Boolean,
            required: true
        },
        hasDraft: {
            type: Boolean,
            required: true
        },
        approvalStatus: String,
        openThreadCount: {
            type: Number,
            required: true
        },
        editorLink: {
            type: String,
            required: true
        },
        publishedLanguages: {
            type: [String],
            required: true
        },
        draftLanguages: {
            type: [String],
            required: true
        },
        binderCreationDate: Date,
        created: { /* Note: this created belongs to the Binder that the BinderStatus is targeting, not to the BinderStatus entry itself  */
            type: Date,
        },
        updated: {
            type: Date,
            default: Date.now,
            required: true,
        },
    }, { collection });
    return addTimestampMiddleware(schema, "updated");
}

function daoToModel(dao: BinderStatusCacheDocument): BinderStatusForAccount {
    const model = pick([
        "accountId",
        "id",
        "title",
        "chunkCount",
        "lastModificationDate",
        "lastPublicationDate",
        "isPublic",
        "created",
        "hasDraft",
        "approvalStatus",
        "openThreadCount",
        "editorLink",
        "publishedLanguages",
        "draftLanguages",
        "binderCreationDate",
    ], dao);
    for (const [i, parentTitle] of dao.parentTitles.entries()) {
        model[`parentTitle${i + 1}`] = parentTitle;
    }
    return model;
}

function modelToDao(model: BinderStatusForAccount): BinderStatusCacheDocument {
    const dao = {
        ...model,
        parentTitles: [],
    } as BinderStatusCacheDocument;
    let i = 1;
    while (dao[`parentTitle${i}`]) {
        dao.parentTitles.push(dao[`parentTitle${i}`]);
        i++;
    }
    return dao;
}
