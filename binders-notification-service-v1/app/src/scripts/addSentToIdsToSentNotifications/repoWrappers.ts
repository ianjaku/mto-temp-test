import * as mongoose from "mongoose";
import { ISentNotificationDocument, SentNotificationRepository, SentNotificationRepositoryFactory } from "../../notificationservice/repositories/sentnotifications";
import { Collection } from "@binders/binders-service-common/lib/mongo/collection";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { SentNotification } from "@binders/client/lib/clients/notificationservice/v1/contract";

export class SentNotificationsRepoWrapper extends SentNotificationRepository {
    constructor(
        protected readonly model: mongoose.Model<ISentNotificationDocument>,
        protected readonly collection: Collection,
        protected readonly logger: Logger
    ) {
        super(model, collection, logger);
    }

    async batchProcessSentNotifications(
        batchProcess: (batch: SentNotification[]) => Promise<void>
    ): Promise<void> {
        await this.batchProcess({}, batchProcess);
    }

    async addSentToIdsToSentNotifications(
        sentNotifications: SentNotification[]
    ): Promise<void> {
        const updates = sentNotifications.map((sentNotification) => {
            return {
                updateOne: {
                    filter: {
                        sentAt: sentNotification.sentAt,
                        accountId: sentNotification.accountId,
                        sentToId: sentNotification.sentToId
                    },
                    update: { sentToIds: [sentNotification.sentToId] },
                    upsert: false
                }
            }
        });
        await this.bulkWrite(updates);
    }
}

export class SentNotificationsRepoFactoryWrapper extends SentNotificationRepositoryFactory {
    buildWrapper(logger: Logger): SentNotificationsRepoWrapper {
        return new SentNotificationsRepoWrapper(this.model, this.collection, logger);
    }
}
