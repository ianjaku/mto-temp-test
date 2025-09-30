import * as mongoose from "mongoose";
import {
    MongoRepository,
    MongoRepositoryFactory
} from "@binders/binders-service-common/lib/mongo/repository";
import { Logger } from "@binders/binders-service-common/lib/util/logging"
import { MSAccountSetupRequest } from "../../model"

export interface MSAccountSetupRequestsRepository {
    createAccountSetupRequest(setupRequest: MSAccountSetupRequest): Promise<void>;
    deleteAccountSetupRequest(setupRequestId: string): Promise<void>;
    listAccountSetupRequests(): Promise<MSAccountSetupRequest[]>;
    getAccountSetupRequestByToken(purchaseIdToken: string): Promise<MSAccountSetupRequest | null>;
    getAccountSetupRequestBySubscription(subscriptionId: string): Promise<MSAccountSetupRequest | null>;
}

export interface IMSAccountSetupRequest extends mongoose.Document {
    purchaseIdToken: string;
    transactableId: string;
    subscriptionId: string;
    offerId: string;
    planId: string;
    tenantId: string;
    quantity: number;
    firstName: string;
    lastName: string;
    phone: string;
    companyName: string;
    companySite: string;
    email: string;
    isDeleted: boolean;
}

function getMSAccountSetupRequestsSchema(collectionName): mongoose.Schema {
    return new mongoose.Schema({
        purchaseIdToken: {
            type: String,
            required: true,
            index: true
        },
        transactableId: {
            type: String,
            required: true
        },
        subscriptionId: {
            type: String,
            required: true
        },
        offerId: {
            type: String,
            required: true
        },
        planId: {
            type: String,
            required: true
        },
        tenantId: {
            type: String,
            required: true
        },
        quantity: {
            type: Number,
            required: true
        },
        firstName: {
            type: String,
            required: true
        },
        lastName: {
            type: String,
            required: true,
        },
        phone: {
            type: String,
            required: true,
        },
        companyName: {
            type: String,
            required: true,
        },
        companySite: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true
        },
        created: {
            type: Date,
            default: Date.now
        },
        isDeleted: {
            type: Boolean,
            default: false
        }
    }, { collection: collectionName });
}

function msAccountSetupRequestDaoToModel(
    dao: IMSAccountSetupRequest
): MSAccountSetupRequest {
    return new MSAccountSetupRequest(
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
        dao.email,
        dao.isDeleted
    )
}

export class MongoMSAccountSetupRequestsRepository
    extends MongoRepository<IMSAccountSetupRequest>
    implements MSAccountSetupRequestsRepository
{
    async createAccountSetupRequest(
        setupRequest: MSAccountSetupRequest
    ): Promise<void> {
        await this.insertEntity(<IMSAccountSetupRequest>setupRequest);
    }

    listAccountSetupRequests(): Promise<MSAccountSetupRequest[]> {
        return this.findEntities({}).then(
            daos => daos
                .filter(dao => !dao.isDeleted)
                .map(msAccountSetupRequestDaoToModel)
        );
    }

    getAccountSetupRequestByToken(purchaseIdToken: string): Promise<MSAccountSetupRequest | null> {
        return this.fetchOne({
            purchaseIdToken
        }).then((result) => {
            if (result.isJust()) {
                return msAccountSetupRequestDaoToModel(result.get())
            } else {
                return null;
            }
        })
    }

    getAccountSetupRequestBySubscription(subscriptionId: string): Promise<MSAccountSetupRequest | null> {
        return this.fetchOne({
            subscriptionId
        }).then((result) => {
            if (result.isJust()) {
                return msAccountSetupRequestDaoToModel(result.get())
            } else {
                return null;
            }
        })
    }

    async deleteAccountSetupRequest(subscriptionId: string): Promise<void> {
        await this.update({
            subscriptionId
        }, {
            isDeleted: true
        });
    }
}

export class MongoMSAccountSetupRequestsRepositoryFactory
    extends MongoRepositoryFactory<IMSAccountSetupRequest>
{
    build(logger: Logger): MongoMSAccountSetupRequestsRepository {
        return new MongoMSAccountSetupRequestsRepository(
            this.model,
            this.collection,
            logger
        );
    }

    protected updateModel(): void {
        const schema = getMSAccountSetupRequestsSchema(this.collection.name);
        this.model = this.collection.connection.model<IMSAccountSetupRequest>(
            "MSAccountSetupRequestDAO",
            schema
        )
    }
}
