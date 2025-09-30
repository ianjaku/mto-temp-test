import * as mongoose from "mongoose";
import {
    MongoRepository,
    MongoRepositoryFactory
} from "@binders/binders-service-common/lib/mongo/repository";
import {
    NotificationKind,
    NotifierKind,
} from "@binders/client/lib/clients/notificationservice/v1/contract";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { NotificationTarget } from "./models/notificationtarget";
import { addTimestampMiddleware } from "@binders/binders-service-common/lib/mongo/schema";


export interface INotificationTargetDocument extends mongoose.Document {
    accountId: string;
    notifierKind: NotifierKind;
    targetId: string;
    notificationKind: NotificationKind;
    itemId?: string;
}

function daoToModel(dao: INotificationTargetDocument): NotificationTarget {
    return NotificationTarget.create(
        dao.accountId,
        dao.notifierKind,
        dao.targetId,
        dao.notificationKind,
        dao.itemId
    );
}

function modelToDao(model: NotificationTarget): INotificationTargetDocument {
    return <INotificationTargetDocument>{
        accountId: model.accountId,
        notifierKind: model.notifierKind,
        targetId: model.targetId,
        notificationKind: model.notificationKind,
        itemId: model.itemId
    };
}

function getSchema(collectionName: string) {
    const schema = new mongoose.Schema({
        accountId: {
            type: String,
            required: true
        },
        notifierKind: {
            type: String,
            required: true
        },
        targetId: {
            type: String,
            required: true
        },
        notificationKind: {
            type: String,
            required: true
        },
        itemId: {
            type: String,
            default: null
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

export interface INotificationTargetsRepository {
    getOne(
        accountId: string,
        targetId: string,
        itemId?: string
    ): Promise<NotificationTarget>;
    insert(target: NotificationTarget): Promise<NotificationTarget>;
    /**
     * When itemIds is passed, all account wide targets and all targets
     * matching one of the itemIds will be returned.
     *
     * When itemIds is not passed, only account wide targets will be returned.
     */
    findForAccount(
        accountId: string,
        notificationKind: NotificationKind,
        itemIds?: string[]
    ): Promise<NotificationTarget[]>;
    delete(
        accountId: string,
        targetId: string,
        notificationKind: NotificationKind,
        itemId?: string
    ): Promise<void>;
    deleteAllForTarget(
        targetId: string,
        accountId?: string
    ): Promise<void>;
    deleteAllForAccount(accountId: string): Promise<void>;
}

export class NotificationTargetsRepository
    extends MongoRepository<INotificationTargetDocument>
    implements INotificationTargetsRepository {

    async getOne(
        accountId: string,
        targetId: string,
        itemId?: string | null
    ): Promise<NotificationTarget> {
        const dao = await this.fetchOne({ accountId, targetId, itemId: itemId ?? null });
        return dao.isJust() ? daoToModel(dao.get()) : null;
    }

    async findForAccount(
        accountId: string,
        notificationKind?: NotificationKind,
        itemIds?: string[]
    ): Promise<NotificationTarget[]> {
        const query = {
            accountId,
            ...(notificationKind ? { notificationKind } : {}),
            $or: [
                { itemId: mongoose.trusted({ $in: itemIds?.map(String) }) },
                { itemId: null }
            ]
        };
        const daos = await this.findEntities(query);
        return daos.map(daoToModel);
    }

    async insert(target: NotificationTarget): Promise<NotificationTarget> {
        const dao = modelToDao(target);
        const result = await this.insertEntity(dao);
        return daoToModel(result);
    }

    async delete(
        accountId: string,
        targetId: string,
        notificationKind: NotificationKind,
        itemId?: string
    ): Promise<void> {
        await this.deleteEntity({
            accountId,
            notificationKind,
            targetId,
            itemId: itemId ?? null
        });
    }

    async deleteAllForTarget(targetId: string, accountId?: string): Promise<void> {
        if (targetId == null) return;
        await this.deleteMany({
            targetId,
            ...(accountId ? { accountId } : {})
        });
    }

    async deleteAllForAccount(accountId: string): Promise<void> {
        await this.deleteMany({ accountId });
    }

}

export class NotificationTargetsRepositoryFactory
    extends MongoRepositoryFactory<INotificationTargetDocument> {

    build(logger: Logger): NotificationTargetsRepository {
        return new NotificationTargetsRepository(this.model, this.collection, logger);
    }

    updateModel(): void {
        const schema = getSchema(this.collection.name);
        schema.index({
            accountId: 1,
            targetId: 1,
            itemId: 1,
            notificationKind: 1
        }, { unique: true });
        this.model = this.collection.connection.model<INotificationTargetDocument>(
            "NotificationTargetsDAO",
            schema
        );
    }
}
