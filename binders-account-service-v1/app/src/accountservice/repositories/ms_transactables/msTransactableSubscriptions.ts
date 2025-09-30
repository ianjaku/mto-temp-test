import * as mongoose from "mongoose";
import {
    MongoRepository,
    MongoRepositoryFactory
} from "@binders/binders-service-common/lib/mongo/repository";
import { Logger } from "@binders/binders-service-common/lib/util/logging"
import { MSTransactableSubscription } from "../../model"
import { MSTransactableSubscriptionNotFound } from "@binders/client/lib/clients/accountservice/v1/contract"

export interface MSTransactableSubscriptionsRepository {
    createTransactableSubscription(transactableSubscription: MSTransactableSubscription): Promise<void>;
    getTransactableSubscription(msSubscriptionId: string): Promise<MSTransactableSubscription | null>;
    getTransactableSubscriptionByAccountId(purchaseIdToken: string): Promise<MSTransactableSubscription | null>;
}

export interface IMSTransactableSubscription extends mongoose.Document {
    accountId: string;
    subscriptionId: string;
}

function getMSTransactableSubscriptionsSchema(collectionName: string): mongoose.Schema {
    return new mongoose.Schema({
        accountId: {
            type: String,
            required: true
        },
        subscriptionId: {
            type: String,
            required: true,
            index: true
        },
    }, { collection: collectionName });
}

function msTransactableSubscriptionDaoToModel(dao: IMSTransactableSubscription): MSTransactableSubscription {
    return new MSTransactableSubscription(dao.accountId, dao.subscriptionId);
}

export class MongoMSTransactableSubscriptionsRepository extends MongoRepository<IMSTransactableSubscription> implements MSTransactableSubscriptionsRepository {
    async createTransactableSubscription(transactableSubscription: MSTransactableSubscription): Promise<void> {
        await this.insertEntity(transactableSubscription as IMSTransactableSubscription)
    }

    async getTransactableSubscription(msSubscriptionId: string): Promise<MSTransactableSubscription | null> {
        const subscription = await this.findOne({ subscriptionId: msSubscriptionId });
        return subscription == null ? null : msTransactableSubscriptionDaoToModel(subscription);
    }

    async getTransactableSubscriptionByAccountId(accountId: string): Promise<MSTransactableSubscription> {
        const subscription = await this.findOne({ accountId });
        if (subscription == null) {
            throw new MSTransactableSubscriptionNotFound(accountId, "accountId");
        }
        return msTransactableSubscriptionDaoToModel(subscription);
    }
}

export class MongoMSTransactableSubscriptionsRepositoryFactory extends MongoRepositoryFactory<IMSTransactableSubscription> {
    build(logger: Logger): MongoMSTransactableSubscriptionsRepository {
        return new MongoMSTransactableSubscriptionsRepository(this.model, this.collection, logger);
    }

    protected updateModel(): void {
        const schema = getMSTransactableSubscriptionsSchema(this.collection.name);
        this.model = this.collection.connection.model<IMSTransactableSubscription>("MSTransactableEventDAO", schema);
    }
}
