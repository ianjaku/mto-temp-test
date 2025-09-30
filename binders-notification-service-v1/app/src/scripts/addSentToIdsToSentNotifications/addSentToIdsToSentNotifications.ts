import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { SentNotificationsRepoFactoryWrapper } from "./repoWrappers";


export const addSentToIdsToSentNotifications = async (): Promise<void> => {
    const config = BindersConfig.get();
    const logger = LoggerBuilder.fromConfig(config);

    const mongoLogin = getMongoLogin("notification_service");
    const collectionConfig = await CollectionConfig.promiseFromConfig(config, "sentnotifications", mongoLogin);
    const repoFactory = new SentNotificationsRepoFactoryWrapper(collectionConfig, logger);
    const repo = repoFactory.buildWrapper(logger);
    
    await repo.batchProcessSentNotifications(async (sentNotifications) => {
        const sentNotificationsToUpdate = sentNotifications.filter(
            sentNotification => sentNotification.sentToIds == null || sentNotification.sentToIds.length === 0
        );
        await repo.addSentToIdsToSentNotifications(sentNotificationsToUpdate);
    });
}
