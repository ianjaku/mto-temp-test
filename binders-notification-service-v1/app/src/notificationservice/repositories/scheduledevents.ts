import * as mongoose from "mongoose";
import {
    MongoRepository,
    MongoRepositoryFactory
} from "@binders/binders-service-common/lib/mongo/repository";
import {
    Notification,
    NotificationKind
} from "@binders/client/lib/clients/notificationservice/v1/contract";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { ScheduledEvent } from "./models/scheduledevent";
import { ScheduledEventIdentifier } from "@binders/binders-service-common/lib/authentication/identity";


export interface IScheduledEventDocument extends mongoose.Document {
    scheduledEventId: string;
    accountId: string;
    kind: NotificationKind;
    sendAt: Date;
    created: Date;
    claimedAt?: Date;
    notification: Notification;
}

function daoToModel(dao: IScheduledEventDocument): ScheduledEvent {
    return new ScheduledEvent(
        new ScheduledEventIdentifier(dao.scheduledEventId),
        dao.accountId,
        dao.kind,
        dao.sendAt,
        dao.created,
        dao.notification,
        dao.claimedAt
    );
}

function modelToDao(model: ScheduledEvent): IScheduledEventDocument {
    return <IScheduledEventDocument>{
        scheduledEventId: model.id.value(),
        accountId: model.accountId,
        kind: model.kind,
        sendAt: model.sendAt,
        created: model.created,
        notification: model.notification,
        claimedAt: model.claimedAt,
    };
}

function getSchema(collectionName: string) {
    const schema = new mongoose.Schema({
        scheduledEventId: {
            type: String,
            required: true
        },
        accountId: {
            type: String,
            required: true
        },
        kind: {
            type: String,
            required: true
        },
        notification: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        sendAt: {
            type: Date,
            required: true
        },
        claimedAt: {
            type: Date,
            default: null
        },
        created: {
            type: Date,
            default: Date.now
        },
    }, { collection: collectionName });
    return schema;
}

interface FindScheduledEventsOptions {
    sendAtBefore?: Date;
    accountId?: string;
    itemId?: string;
    kind?: NotificationKind;
}

export interface IScheduledEventRepository {
    insert(event: ScheduledEvent): Promise<ScheduledEvent>;
    delete(id: string): Promise<void>;
    getById(id: string): Promise<ScheduledEvent>;
    find(options: FindScheduledEventsOptions): Promise<ScheduledEvent[]>;
    put(event: ScheduledEvent): Promise<void>;
    /**
     * Adds a "claimedAt" date to a scheduledEvent.
     * This means a service is handling the event and it should be ignored by others.
     *
     * @returns Whether the claim was successful, if false the event should be left alone
     */
    claim(id: string): Promise<boolean>;
    unClaim(id: string): Promise<void>;
    deleteAllForAccount(accountId: string): Promise<void>;
}

export class ScheduledEventRepository
    extends MongoRepository<IScheduledEventDocument>
    implements IScheduledEventRepository {

    async claim(id: string): Promise<boolean> {
        const result = await this.update({
            scheduledEventId: id,
            claimedAt: null
        }, {
            claimedAt: new Date()
        });
        return result.updateCount > 0;
    }

    async unClaim(id: string): Promise<void> {
        await this.update({ scheduledEventId: id }, { claimedAt: null });
    }

    async getById(id: string): Promise<ScheduledEvent> {
        const dao = await this.fetchOne({ scheduledEventId: id });
        if (dao.isNothing()) return null;
        return daoToModel(dao.get());
    }

    async find(options: FindScheduledEventsOptions): Promise<ScheduledEvent[]> {
        const daos = await this.findEntities({
            ...(options.sendAtBefore && { sendAt: mongoose.trusted({ $lt: new Date(options.sendAtBefore) }) }),
            ...(options.accountId ? { accountId: options.accountId } : {}),
            ...(options.itemId ? { "notification.itemId": options.itemId } : {}),
            ...(options.kind ? { kind: options.kind } : {}),
        }, { orderByField: "sendAt", sortOrder: "ascending" });
        return daos.map(daoToModel);
    }

    async delete(scheduledEventId: string): Promise<void> {
        await this.deleteEntity({ scheduledEventId });
    }

    async insert(model: ScheduledEvent): Promise<ScheduledEvent> {
        const dao = modelToDao(model);
        const result = await this.insertEntity(dao);
        return daoToModel(result);
    }

    async deleteAllForAccount(accountId: string): Promise<void> {
        await this.deleteMany({ accountId });
    }

    async put(event: ScheduledEvent): Promise<void> {
        const dao = modelToDao(event);
        await this.updateEntity({ scheduledEventId: event.id.value() }, dao);
    }

}

export class ScheduledEventRepositoryFactory
    extends MongoRepositoryFactory<IScheduledEventDocument> {

    build(logger: Logger): ScheduledEventRepository {
        return new ScheduledEventRepository(this.model, this.collection, logger);
    }

    updateModel(): void {
        const schema = getSchema(this.collection.name);
        schema.index({
            accountId: 1,
            created: 1
        });
        schema.index({ scheduledEventId: 1 }, { unique: true });
        this.model = this.collection.connection.model<IScheduledEventDocument>(
            "ScheduledEventDAO",
            schema
        );
    }
}
