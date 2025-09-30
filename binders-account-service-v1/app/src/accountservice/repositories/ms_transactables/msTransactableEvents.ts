import * as mongoose from "mongoose";
import {
    MSTransactableEvent,
    MSTransactableEventCommon,
    MSTransactableEventInit
} from "../../model";
import {
    MongoRepository,
    MongoRepositoryFactory
} from "@binders/binders-service-common/lib/mongo/repository";
import { Logger } from "@binders/binders-service-common/lib/util/logging"

export interface MSTransactableEventRepository {
    createEvent(event: MSTransactableEvent): Promise<void>;
    listEvents(): Promise<MSTransactableEvent[]>;
}

export type IMSTransactableEventAction = "Init" | "Reinstate" | "ChangePlan" | "ChangeQuantity" | "Suspend" | "Unsubscribe";
export interface IMSTransactableEventBase {
    action: IMSTransactableEventAction;
    subscriptionId: string; // subscriptionId of the SaaS subscription that is being reinstated
    offerId: string;
    planId: string; // purchased plan ID
    quantity: number;
}

export interface IMSTransactableEventCommon extends IMSTransactableEventBase {
    action: Exclude<IMSTransactableEventAction, "Init">;
    operationId: string; //Operation ID; should be provided in the operations patch API call
    activityId: string;
    publisherId: string;
    timeStamp: string; // UTC
    status: "InProgress" | "NotStarted" | "Failed" | "Succeeded" | "Conflict";
}

export interface IMSTransactableEventInit extends IMSTransactableEventBase {
    action: "Init",
    purchaseIdToken: string;
    transactableId: string;
    tenantId: string;
    firstName: string;
    lastName: string;
    phone: string;
    companyName: string;
    companySite: string;
    email: string;
}

export type IMSTransactableEvent = IMSTransactableEventCommon | IMSTransactableEventInit;

function getMSTransactableEventsSchema(collectionName): mongoose.Schema {
    return new mongoose.Schema({
        action: {
            type: String,
            required: true
        },
        purchaseIdToken: {
            type: String,
            required: false
        },
        transactableId: {
            type: String,
            required: false
        },
        subscriptionId: {
            type: String,
            required: false
        },
        offerId: {
            type: String,
            required: false
        },
        planId: {
            type: String,
            required: false
        },
        tenantId: {
            type: String,
            required: false
        },
        firstName: {
            type: String,
            required: false
        },
        lastName: {
            type: String,
            required: false
        },
        phone: {
            type: String,
            required: false
        },
        companyName: {
            type: String,
            required: false
        },
        companySite: {
            type: String,
            required: false
        },
        email: {
            type: String,
            required: false
        },
        operationId: {
            type: String,
            required: false
        },
        activityId: {
            type: String,
            required: false
        },
        publisherId: {
            type: String,
            required: false
        },
        quantity: {
            type: Number,
            required: false
        },
        timeStamp: {
            type: String,
            required: false
        },
        status: {
            type: String,
            required: false
        },
        created: {
            type: Date,
            default: Date.now
        }
    }, { collection: collectionName });
}

function msTransactableEventDaoToModel(
    dao: IMSTransactableEvent
): MSTransactableEvent {
    if (dao.action === "Init") {
        return new MSTransactableEventInit(
            dao.purchaseIdToken,
            dao.transactableId,
            dao.subscriptionId,
            dao.offerId,
            dao.planId,
            dao.tenantId,
            dao.quantity,
            dao.firstName,
            dao.lastName,
            dao.phone,
            dao.companyName,
            dao.companySite,
            dao.email
        )
    } else {
        return new MSTransactableEventCommon(
            dao.action,
            dao.operationId,
            dao.activityId,
            dao.subscriptionId,
            dao.offerId,
            dao.publisherId,
            dao.planId,
            dao.quantity,
            dao.timeStamp,
            dao.status
        )
    }
}
export type IMSTransactableEventDAO = IMSTransactableEvent & mongoose.Document;

export class MongoMSTransactableEventsRepository
    extends MongoRepository<IMSTransactableEventDAO>
    implements MSTransactableEventRepository
{
    listEvents(): Promise<MSTransactableEvent[]> {
        return this.findEntities({}).then(daos => daos.map(msTransactableEventDaoToModel));
    }
    async createEvent(event: MSTransactableEvent): Promise<void> {
        await this.insertEntity(<IMSTransactableEventDAO>event)
    }
}

export class MongoMSTransactableEventsRepositoryFactory
    extends MongoRepositoryFactory<IMSTransactableEventDAO>
{
    build(logger: Logger): MongoMSTransactableEventsRepository {
        return new MongoMSTransactableEventsRepository(
            this.model,
            this.collection,
            logger
        );
    }

    protected updateModel(): void {
        const schema = getMSTransactableEventsSchema(this.collection.name);
        this.model = this.collection.connection.model<IMSTransactableEventDAO>(
            "MSTransactableEventDAO",
            schema
        )
    }
}

