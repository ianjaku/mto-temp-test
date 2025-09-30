import {
    BackendAccountServiceClient,
    BackendRoutingServiceClient
} from  "@binders/binders-service-common/lib/apiclient/backendclient";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import {
    NotificationTargetsRepository,
    NotificationTargetsRepositoryFactory
} from  "../repositories/notificationtargets";
import {
    SentNotificationRepository,
    SentNotificationRepositoryFactory
} from  "../repositories/sentnotifications";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import { Config } from "@binders/client/lib/config/config";
import {
    FEATURE_CUSTOM_NOTIFICATION_EMAIL_NAME
} from  "@binders/client/lib/clients/accountservice/v1/contract";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { NotificationDispatcher } from "./dispatcher";
import { NotificationMailer } from "./mailer";
import { NotifierTemplateFactory } from "./messages/notificationMessageTemplateFactory";
import { RoutingServiceClient } from "@binders/client/lib/clients/routingservice/v1/client";
import { TargetResolver } from "./targetresolver";

export class NotificationDispatcherFactory {
    constructor(
        private readonly config: Config,
        private readonly accountServiceClient: AccountServiceClient,
        private readonly routingServiceClient: RoutingServiceClient,
        private readonly sentNotificationsRepo: SentNotificationRepository,
        private readonly targetsRepository: NotificationTargetsRepository
    ) {}

    public async buildDispatcherFor(
        accountId: string
    ): Promise<NotificationDispatcher> {
        const targetResolver = await TargetResolver.fromConfig(
            accountId,
            this.config,
            this.targetsRepository
        );
        const features = await this.accountServiceClient.getAccountFeatures(accountId);
        const mailer = await NotificationMailer.fromConfig(this.config)
        const templateFactory = await NotifierTemplateFactory.fromConfig(this.config);
        return new NotificationDispatcher(
            targetResolver,
            templateFactory,
            this.sentNotificationsRepo,
            this.routingServiceClient,
            this.config,
            mailer,
            features.includes(FEATURE_CUSTOM_NOTIFICATION_EMAIL_NAME),
        );
    }

    static async fromConfig(config: Config): Promise<NotificationDispatcherFactory> {
        const topLevelLogger = LoggerBuilder.fromConfig(config, "notification-service");
        const loginOption = getMongoLogin("notification_service");

        const [
            sentNotificationConfig,
            notificationTargetsConfig
        ] = await Promise.all([
            await CollectionConfig.promiseFromConfig(config, "sentnotifications", loginOption),
            await CollectionConfig.promiseFromConfig(config, "notificationtargets", loginOption)
        ]);

        const sentNotificationsFactory = new SentNotificationRepositoryFactory(
            sentNotificationConfig,
            topLevelLogger
        );
        const notificationTargetsFactory = new NotificationTargetsRepositoryFactory(
            notificationTargetsConfig,
            topLevelLogger
        );
        const targetsRepository = notificationTargetsFactory.build(topLevelLogger)
        const sentNotificationRepo = sentNotificationsFactory.build(topLevelLogger);

        const accountServiceClient = await BackendAccountServiceClient.fromConfig(
            config,
            "notification-service"
        );

        const routingServiceClient = await BackendRoutingServiceClient.fromConfig(config, "notification-service");

        return new NotificationDispatcherFactory(
            config,
            accountServiceClient,
            routingServiceClient,
            sentNotificationRepo,
            targetsRepository
        );
    }
}
