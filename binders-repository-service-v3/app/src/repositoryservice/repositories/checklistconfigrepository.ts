import * as mongoose from "mongoose";
import { MongoRepository, MongoRepositoryFactory } from "@binders/binders-service-common/lib/mongo/repository";
import { ChecklistConfig } from "./models/checklist";
import { Logger } from "@binders/binders-service-common/lib/util/logging";

export interface IChecklistConfigDocumentHistory {
    changedActiveTo: boolean;
    changedOnDate: Date;
    changedByUserId: string;
}

export interface IChecklistConfigDocument extends mongoose.Document {
    id: string
    binderId: string;
    chunkId: string;
    isActive: boolean;

    // Keeps the history of all changes to the active state of a checklist config
    history?: IChecklistConfigDocumentHistory[]
}


export interface IChecklistsConfigRepository {
    getBindersWithChecklists(): Promise<string[]>;
    getChecklistsConfig(binderId: string): Promise<ChecklistConfig[]>;
    getChecklistsConfigs(
        binderIds: string[],
        requireActive?: boolean
    ): Promise<ChecklistConfig[]>;
    saveChecklistActivation(
        binderId: string,
        chunkId: string,
        isActive: boolean,
        userId?: string
    ): Promise<ChecklistConfig>;
}


export class ChecklistsConfigRepository extends MongoRepository<IChecklistConfigDocument> implements IChecklistsConfigRepository {

    async getBindersWithChecklists(): Promise<string[]> {
        return await this.findEntities({}, {
            select: "binderId",
            distinct: "binderId"
        }) as unknown as string[]; // select + distinct makes findEntities() return a string array here
    }

    async getChecklistsConfigs(
        binderIds: string[],
        requireActive = true
    ): Promise<ChecklistConfig[]> {
        const daos = await this.findEntities({
            binderId: mongoose.trusted({ $in: binderIds.map(String) }),
            ...(requireActive ? { isActive: true } : {})
        });
        return daos?.map(dao => daoToModel(dao)) ?? [];
    }

    async getChecklistsConfig(binderId: string): Promise<ChecklistConfig[]> {
        const daos = await this.findEntities({ binderId, isActive: true })
        return daos ? daos.map(dao => daoToModel(dao)) : []
    }

    async saveChecklistActivation(
        binderId: string,
        chunkId: string,
        isActive: boolean,
        userId?: string
    ): Promise<ChecklistConfig> {
        const [checklistDao] = await this.findEntities({ binderId, chunkId })
        const newHistoryItem: IChecklistConfigDocumentHistory = {
            changedActiveTo: isActive,
            changedByUserId: userId,
            changedOnDate: new Date()
        };
        if (checklistDao) {
            const checklist = daoToModel(checklistDao)
            const dao = modelToDao({ ...checklist, isActive });
            dao["history"] = [newHistoryItem, ...checklistDao.history];
            return this.saveEntity({ binderId, chunkId }, dao);
        } else {
            const dao = modelToDao(ChecklistConfig.create(binderId, chunkId, isActive));
            dao["history"] = [newHistoryItem];
            const daoAfterSave = await this.insertEntity(dao);
            return daoToModel(daoAfterSave)
        }
    }
}

export class ChecklistConfigRepositoryFactory extends MongoRepositoryFactory<IChecklistConfigDocument> {
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    build(logger: Logger) {
        return new ChecklistsConfigRepository(this.model, this.collection, logger)
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    updateModel() {
        const schema = getChecklistsSchema(this.collection.name)
        schema.index({ id: 1 }, { unique: true })
        schema.index({ binderId: 1, chunkId: 1 }, { unique: true })
        schema.index({ binderId: 1, isActive: 1 })
        this.model = this.collection.connection.model<IChecklistConfigDocument>("ChecklistsConfigDAO", schema);
    }
}

function getHistorySchema(): mongoose.Schema {
    return new mongoose.Schema({
        changedActiveTo: {
            type: Boolean,
            default: false
        },
        changedOnDate: {
            type: Date,
            required: true
        },
        changedByUserId: {
            type: String,
            required: true
        }
    });
}

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
        isActive: {
            type: Boolean,
            required: true
        },
        history: {
            type: [getHistorySchema()],
            required: true
        }
    }, { collection })
}

function daoToModel(
    { id, binderId, chunkId, isActive }: IChecklistConfigDocument
): ChecklistConfig {
    return new ChecklistConfig(
        id,
        binderId,
        chunkId,
        isActive
    )
}

function modelToDao({ id, binderId, chunkId, isActive }: ChecklistConfig): IChecklistConfigDocument {
    return <IChecklistConfigDocument>{
        id,
        binderId,
        chunkId,
        isActive
    }
}
