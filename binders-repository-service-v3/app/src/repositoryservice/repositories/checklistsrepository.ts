import * as mongoose from "mongoose";
import {
    BulkWriteResult,
    MongoRepository,
    MongoRepositoryFactory,
} from "@binders/binders-service-common/lib/mongo/repository";
import {
    IChecklist,
    IChecklistAction,
    IChecklistConfig,
    IChecklistProgress,
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { intersection, without } from "ramda";
import { Checklist } from "./models/checklist";
import { EntityNotFound } from "@binders/client/lib/clients/model";
import { Logger } from "@binders/binders-service-common/lib/util/logging";

type ArrayElement<ArrayType extends readonly unknown[]> = 
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never;

export interface IChecklistPerformedHistoryDocument extends mongoose.Document {
    lastPerformedByUserId: string;
    lastPerformedDate: Date;
    performed: boolean;
    step: number; // First checklist in the publication = 0, second = 1, ...
    publicationId?: string; // Not available on resets
}

export interface IChecklistsDocument extends mongoose.Document {
    id: string
    binderId: string;
    chunkId: string;
    performed: boolean;
    isDeleted: boolean;
    performedHistory: IChecklistPerformedHistoryDocument[];
}


export interface IChecklistsRepository {
    getChecklists(binderId: string, isDeleted: boolean): Promise<IChecklist[]>;
    togglePerformed(
        id: string,
        performed: boolean,
        userId: string,
        checklistStep: number,
        publicationId: string
    ): Promise<IChecklist>;
    uspertChecklists(binderId: string, checklistConfigs: IChecklistConfig[]): Promise<BulkWriteResult>;
    getChecklistProgress(binderIds: string[]): Promise<IChecklistProgress[]>;
    getChecklistById(id: string): Promise<IChecklist>;
    resetPerformedTasks(
        binderId: string,
        stepsMap: Record<string, number> // [chunkId] -> step
    ): Promise<BulkWriteResult>;
    getChecklistActions(binderIds: string[]): Promise<IChecklistAction[]>;
    bulkUpdateById(checklists: IChecklist[]): Promise<void>;
}


function getUpdatedChecklist(
    checklist: IChecklist,
    performed: boolean,
    userId: string,
    step: number,
    publicationId?: string
): IChecklist {
    const item = {
        lastPerformedByUserId: userId,
        lastPerformedDate: new Date(),
        performed,
        step,
        publicationId
    }
    const performedHistory = [item, ...checklist.performedHistory]
    return {
        ...checklist,
        performed,
        performedHistory
    }
}

export class ChecklistsRepository extends MongoRepository<IChecklistsDocument> implements IChecklistsRepository {

    async getChecklistById(id: string): Promise<IChecklist> {
        const checklists = await this.findEntities({ id });
        if (checklists.length === 0) return null;
        return daoToModel(checklists[0], true);
    }

    async getChecklists(
        binderId: string,
        isDeleted: boolean | null = false, 
        showLastPerformedHistory = true
    ): Promise<IChecklist[]> {
        const daos = await this.findEntities({
            binderId,
            ...(isDeleted == null ? {} : { isDeleted })
        })
        return daos ? daos.map(dao => daoToModel(dao, showLastPerformedHistory)) : []
    }

    async getChecklistActions(binderIds: string[]): Promise<IChecklistAction[]> {
        const result = await this.aggregate<IChecklist & { performedHistory: ArrayElement<IChecklist["performedHistory"]> }>([
            {$match: { binderId: { $in: binderIds }}}, // Filter out anything not in binderIds
            {$unwind: "$performedHistory"}, // For every performedHistory item, make a new item that has performedHistory as an object. Example: [{history: [1, 2]}] -> [{history: 1}, {history:2}]
            // {$match: {"performedHistory.lastPerformedData": {$gte: ...}}}, // TODO: paginate
            {$sort: {"performedHistory.lastPerformedDate": -1}}
        ])
        return result.map(item => ({
            checklistId: item.id,
            binderId: item.binderId,
            chunkId: item.chunkId,
            performed: item.performedHistory.performed,
            performedDate: item.performedHistory.lastPerformedDate,
            performedByUserId: item.performedHistory.lastPerformedByUserId,
            step: item.performedHistory.step,
            publicationId: item.performedHistory.publicationId
        }));
    }

    async togglePerformed(
        id: string, 
        performed: boolean,
        userId: string,
        checklistStep: number,
        publicationId: string
    ): Promise<IChecklist> {
        const [checklistDao] = await this.findEntities({ id })
        if (!checklistDao) throw new ChecklistNotFound(id)

        const updatedChecklist = getUpdatedChecklist(
            daoToModel(checklistDao),
            performed,
            userId,
            checklistStep,
            publicationId
        );
        const dao = await this.saveEntity({ id }, modelToDao(updatedChecklist))
        return daoToModel(dao, true)
    }

    async bulkUpdateById(checklists: IChecklist[]): Promise<void> {
        const updates = [];
        for (const checklist of checklists) {
            if(checklist.id == null) {
                throw new Error("Ids are required in method \"bulkUpdateById\"");
            }
            updates.push({
                updateOne: {
                    filter: { id: checklist.id },
                    update: checklist,
                    upsert: false
                }
            });
        }
        await this.bulkWrite(updates);
    }

    async uspertChecklists(binderId: string, checklistConfigs: IChecklistConfig[]): Promise<BulkWriteResult> {
        await this.updateMany({ binderId }, { $set: { isDeleted: true } })
        if (checklistConfigs && checklistConfigs.length === 0) {
            return {
                insertedCount: 0,
                matchedCount: 0,
                modifiedCount: 0,
                upsertedCount: 0
            }
        }
        const checklists = await this.getChecklists(binderId, true);
        const chunkIds = checklistConfigs.map(c => c.chunkId);
        const alreadySavedInDB = intersection(chunkIds, checklists.map(c => c.chunkId));
        const newInDB = without(alreadySavedInDB, chunkIds);
        const bulk = [...alreadySavedInDB.map(chId => {
            return {
                updateOne: {
                    filter: { binderId, chunkId: chId },
                    update: { isDeleted: false },
                    upsert: true
                }
            }
        }), ...newInDB.map(chId => {
            return {
                updateOne: {
                    filter: { binderId, chunkId: chId },
                    update: modelToDao(Checklist.create(binderId, chId)),
                    upsert: true
                }
            }
        })];
        return await this.bulkWrite(bulk)
    }

    async getChecklistProgress(binderIds: string[]): Promise<IChecklistProgress[]> {
        const result = await this.aggregate([
            {
                $match: {
                    binderId: { $in: binderIds },
                    isDeleted: false
                }
            },
            {
                $group: {
                    _id: "$binderId",
                    performed: { $sum: { $cond: [{ $eq: ["$performed", true] }, 1, 0] } },
                    total: { $sum: 1 },
                    checklistHistory: { $push: { $arrayElemAt: ["$performedHistory", 0] } }
                }
            }
        ])
        return result.map(({ _id, checklistHistory, performed, total }) => {
            const sortedHistory = checklistHistory.sort((c1, c2) => {
                if (c1.lastPerformedDate > c2.lastPerformedDate) {
                    return -1;
                }
                return c1.lastPerformedDate < c2.lastPerformedDate ? 1 : 0;
            })
            const lastUpdated = (sortedHistory && sortedHistory.length > 0 && new Date(sortedHistory[0].lastPerformedDate)) || undefined
            return {
                binderId: _id,
                performed,
                total,
                lastUpdated
            }
        })
    }

    async resetPerformedTasks(
        binderId: string,
        stepsMap: Record<string, number>
    ): Promise<BulkWriteResult> {
        const checklists =  await this.getChecklists(binderId, false, false);
        const bulk = checklists.map(checklist => {
            const chunkId = checklist.chunkId
            return {
                updateOne: {
                    filter: { binderId, chunkId },
                    update: modelToDao(getUpdatedChecklist(checklist, false, null, stepsMap[chunkId])),
                    upsert: true
                }
            }
        })
        // Reason for `as any`
        // bulk is of type AnyBulkWriteOperation<IChecklistsDocument>[]
        // however, when hinted, typescript compilation fails with
        // RangeError: Map maximum size exceeded
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return this.bulkWrite(bulk as any)
    }
}

export class ChecklistsRepositoryFactory extends MongoRepositoryFactory<IChecklistsDocument> {
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    build(logger: Logger) {
        return new ChecklistsRepository(this.model, this.collection, logger)
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    updateModel() {
        const schema = getChecklistsSchema(this.collection.name)
        schema.index({ id: 1 }, { unique: true })
        schema.index({ binderId: 1 })
        schema.index({ binderId: 1, isDeleted: 1 })
        this.model = this.collection.connection.model<IChecklistsDocument>("ChecklistsDAO", schema)
    }
}

const PerformedHistorySchema = new mongoose.Schema({
    lastPerformedByUserId: {
        type: String,
        required: true
    },
    lastPerformedDate: {
        type: Date,
        required: true
    },
    performed: {
        type: Boolean,
        required: true
    },
    step: {
        type: Number,
        required: true
    },
    publicationId: {
        type: String,
        default: null
    }
})

function getChecklistsSchema(collection: string): mongoose.Schema {
    return new mongoose.Schema({
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
        performed: {
            type: Boolean,
            required: true
        },
        isDeleted: {
            type: Boolean,
            required: true
        },
        performedHistory: {
            type: [PerformedHistorySchema],
            required: true
        }
    }, { collection })
}

function daoToModel({ id, binderId, chunkId, performed, performedHistory }: IChecklistsDocument, showLastPerformed?: boolean): Checklist {
    let history: IChecklistPerformedHistoryDocument[]
    if (showLastPerformed) {
        history = performedHistory.filter(history => history.performed === true).slice(0, 2)
    } else {
        history = performedHistory
    }
    return Checklist.createFullModel(id, binderId, chunkId, performed, history)
}

function modelToDao({ id, binderId, chunkId, performed, performedHistory }: IChecklist, isDeleted = false): IChecklistsDocument {
    return <IChecklistsDocument>{
        id,
        binderId,
        chunkId,
        performed,
        isDeleted,
        performedHistory
    }
}

export class ChecklistNotFound extends EntityNotFound {
    constructor(id: string) {
        super(`Checklist for given checklistId: ${id} not found`)
    }
}
