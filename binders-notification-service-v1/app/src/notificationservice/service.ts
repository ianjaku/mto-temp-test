import * as WebSocket from "ws";
import {
    Alert,
    AlertChangeType,
    AlertChangedEventBody,
    CreateAlertParams,
    CreateNotificationTargetParams,
    CustomNotification,
    Notification,
    NotificationKind,
    NotificationTarget,
    NotificationTemplate,
    PublishRequestNotification,
    RelativeDate,
    RoutingKey,
    RoutingKeyType,
    ScheduledEvent,
    SentNotification,
    ServiceNotificationType,
    SimpleTarget,
} from "@binders/client/lib/clients/notificationservice/v1/contract";
import {
    AlertIdentifier,
    ScheduledEventIdentifier
} from "@binders/binders-service-common/lib/authentication/identity";
import { AlertRepository, AlertRepositoryFactory } from "./repositories/alerts";
import {
    BindersRepositoryServiceContract,
    CollectionElement
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import {
    INotificationTargetsRepository,
    NotificationTargetsRepositoryFactory
} from "./repositories/notificationtargets";
import {
    INotificationTemplateRepository,
    NotificationTemplateRepositoryFactory
} from "./repositories/notificationtemplates";
import {
    Logger,
    LoggerBuilder
} from "@binders/binders-service-common/lib/util/logging";
import MessageHandler, { DispatchHook, StateProvider } from "./websockets/messagehandler";
import {
    PermissionName,
    ResourceType
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { RedisClient, RedisClientBuilder } from "@binders/binders-service-common/lib/redis/client";
import {
    ScheduledEventRepository,
    ScheduledEventRepositoryFactory
} from "./repositories/scheduledevents";
import {
    SentNotificationRepository,
    SentNotificationRepositoryFactory
} from "./repositories/sentnotifications";
import { addMinutes, differenceInHours, isPast } from "date-fns";
import { Alert as AlertModel } from "./repositories/models/alert";
import { AuthenticatedSession } from "@binders/client/lib/clients/model";
import {
    AuthorizationServiceClient
} from "@binders/client/lib/clients/authorizationservice/v1/client";
import {
    BackendAuthorizationServiceClient
} from "@binders/binders-service-common/lib/authorization/backendclient";
import {
    BackendRepoServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { Config } from "@binders/client/lib/config/config";
import HtmlSanitizer from "@binders/binders-service-common/lib/html/sanitizer";
import ItemLockHandler from "./itemLockHandler";
import { MissingNotificationTargetItem } from "./events/dispatcher";
import {
    NOTIFICATION_COUNTER_LABEL
} from "@binders/binders-service-common/lib/monitoring/prometheus/htmlSanitizing";
import { NotificationDispatcherFactory } from "./events/dispatcherfactory";
import {
    NotificationTarget as NotificationTargetModel
} from "./repositories/models/notificationtarget";
import {
    NotificationTemplate as NotificationTemplateModel
} from "./repositories/models/notificationtemplate";
import { ScheduledEvent as ScheduledEventModel } from "./repositories/models/scheduledevent";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import { routingKeyToRedisChannel } from "./helpers";
import { uniq } from "ramda";

const notificationTargetModelToClientDao = (
    model: NotificationTargetModel
): NotificationTarget => ({
    accountId: model.accountId,
    notifierKind: model.notifierKind,
    targetId: model.targetId,
    notificationKind: model.notificationKind,
    itemId: model.itemId
});

const scheduledEventModelToClientDao = (
    model: ScheduledEventModel
): ScheduledEvent => ({
    id: model.id.value(),
    accountId: model.accountId,
    kind: model.kind,
    sendAt: model.sendAt,
    created: model.created,
    notification: model.notification,
    claimedAt: model.claimedAt
});

const templateModelToClientDao = (
    model: NotificationTemplateModel
): NotificationTemplate => {
    return {
        accountId: model.accountId,
        templateData: model.templateData,
        templateId: model.templateId.value(),
        templateName: model.templateName,
        scheduledDate: model.scheduledDate,
        scheduledTime: model.scheduledTime
    }
}

const alertModelToClientDao = (
    model: AlertModel
): Alert => {
    return {
        alertId: model.alertId.value(),
        message: model.message,
        adminsOnly: model.adminsOnly,
        cooldownHours: model.cooldownHours,
        startDate: model.startDate,
        endDate: model.endDate,
        accountIds: model.accountIds,
        buttonText: model.buttonText,
        buttonLink: model.buttonLink,
    }
}


export class NotificationService {
    constructor(
        private readonly wsMessageHandler: MessageHandler,
        private readonly logger: Logger,
        private readonly dispatcherFactory: NotificationDispatcherFactory,
        private readonly notificationTargetsRepository: INotificationTargetsRepository,
        private readonly scheduledEventsRepository: ScheduledEventRepository,
        private readonly notificationTemplateRepository: INotificationTemplateRepository,
        private readonly sentNotificationsRepository: SentNotificationRepository,
        private readonly alertRepository: AlertRepository,
        private readonly repoClient: BindersRepositoryServiceContract,
        private readonly authClient: AuthorizationServiceClient
    ) {
        wsMessageHandler.setLogger(logger);
    }

    async sendCustomNotification(
        accountId: string,
        itemId: string,
        targets: SimpleTarget[],
        subject: string,
        text: string,
        sendAt?: Date,
        actorId?: string
    ): Promise<CustomNotification> {
        const sanitizedText = new HtmlSanitizer(this.logger, NOTIFICATION_COUNTER_LABEL).sanitizeHtml(text)
        const notification: CustomNotification = {
            accountId,
            itemId,
            kind: NotificationKind.CUSTOM,
            subject,
            text: sanitizedText,
            targets,
            actorId
        }
        await this.sendNotification(notification, { sendAt });
        return notification;
    }

    async sendNotification(
        notification: Notification,
        options?: {
            sendAt?: Date
        },
    ): Promise<void> {
        if (options?.sendAt != null) {
            await this.scheduledEventsRepository.insert(ScheduledEventModel.create(
                notification.accountId,
                notification.kind,
                new Date(options.sendAt),
                notification
            ));
            return;
        }

        const dispatcher = await this.dispatcherFactory.buildDispatcherFor(notification.accountId);
        await dispatcher.dispatch(notification);
    }

    async sendPublishRequestNotification(
        accountId: string,
        binderId: string,
        userId?: string
    ): Promise<void> {
        if (userId == null) throw new Error(`UserId cannot be null ${accountId} ${userId}`);
        const notification: PublishRequestNotification = {
            kind: NotificationKind.PUBLISH_REQUEST,
            accountId,
            itemId: binderId,
            actorId: userId
        };
        await this.sendNotification(notification);
    }

    async findScheduledNotifications(
        accountId: string,
        itemId: string,
        kind?: NotificationKind
    ): Promise<ScheduledEvent[]> {
        const models = await this.scheduledEventsRepository.find({
            accountId,
            itemId,
            kind
        });
        return models.map(scheduledEventModelToClientDao);
    }

    async runScheduledEvents(): Promise<void> {
        const events = await this.scheduledEventsRepository.find({
            sendAtBefore: addMinutes(new Date(), 5)
        });
        for (const event of events) {
            await this.dispatchScheduledEvent(event);
        }
    }

    private async dispatchScheduledEvent(scheduledEvent: ScheduledEventModel) {
        if (scheduledEvent.claimedAt != null) return;
        const dispatcher = await this.dispatcherFactory.buildDispatcherFor(scheduledEvent.accountId);
        const scheduledEventId = scheduledEvent.id.value();
        const claimSuccessful = await this.scheduledEventsRepository.claim(scheduledEventId);
        if (!claimSuccessful) return;
        try {
            await dispatcher.dispatch(scheduledEvent.notification);
        } catch (e) {
            if (e instanceof MissingNotificationTargetItem) {
                // A missing item means that it was hard deleted, but the schedule event remained, nothing to recover.
                this.logger.warn(
                    `Could not dispatch scheduled event ${scheduledEventId}. Reason: ${e.message}`,
                    "notifications",
                    { scheduledEvent }
                );
            } else {
                this.logger.error(
                    `Failed to dispatch scheduled event with id ${scheduledEventId}`,
                    "notifications",
                    {
                        scheduledEvent,
                        errorMessage: e.message,
                        stack: e.stack
                    }
                );
                await this.scheduledEventsRepository.unClaim(scheduledEventId);
                return;
            }
        }
        await this.scheduledEventsRepository.delete(scheduledEventId);
    }

    async findNotificationTargets(
        accountId: string,
        notificationKind?: NotificationKind,
        itemIds?: string[]
    ): Promise<NotificationTarget[]> {
        const models = await this.notificationTargetsRepository.findForAccount(
            accountId,
            notificationKind,
            itemIds
        );
        return models.map(notificationTargetModelToClientDao);
    }

    async findSentNotifications(
        accountId: string,
        itemId: string
    ): Promise<SentNotification[]> {
        const descendantsMap = await this.repoClient.getDescendantsMap(itemId);
        const ids = Object.values(descendantsMap).reduce((ids: string[], collectionElements: CollectionElement[]) => {
            return [...ids, ...collectionElements.map(el => el.key)]
        }, []);
        return this.sentNotificationsRepository.find(accountId, ids);
    }

    async addNotificationTarget(
        params: CreateNotificationTargetParams
    ): Promise<NotificationTarget> {
        const model = NotificationTargetModel.create(
            params.accountId,
            params.notifierKind,
            params.targetId,
            params.notificationKind,
            params.itemId ?? null
        );
        const result = await this.notificationTargetsRepository.insert(model);
        return notificationTargetModelToClientDao(result);
    }

    async deleteNotificationTemplate(
        accountId: string,
        notificationTemplateId: string
    ): Promise<void> {
        await this.notificationTemplateRepository.delete(notificationTemplateId);
    }

    async deleteNotificationTarget(
        accountId: string,
        notificationTargetId: string,
        notificationKind: NotificationKind,
        itemId?: string
    ): Promise<void> {
        await this.notificationTargetsRepository.delete(
            accountId,
            notificationTargetId,
            notificationKind,
            itemId
        );
    }

    async deleteNotificationTargets(
        notificationTargetId: string,
        accountId?: string
    ): Promise<void> {
        await this.notificationTargetsRepository.deleteAllForTarget(
            notificationTargetId,
            accountId
        );
    }

    async deleteAllForAccount(accountId: string): Promise<void> {
        await this.notificationTargetsRepository.deleteAllForAccount(accountId);
        await this.scheduledEventsRepository.deleteAllForAccount(accountId);
        await this.sentNotificationsRepository.deleteAllForAccount(accountId);
    }

    addNotificationTemplate(
        accountId: string,
        templateData: Partial<CustomNotification>,
        templateName: string,
        scheduledDate?: Date | RelativeDate,
        scheduledTime?: Date
    ): Promise<NotificationTemplateModel> {
        const model = NotificationTemplateModel.create(
            accountId,
            templateData,
            templateName,
            scheduledDate,
            scheduledTime
        );

        return this.notificationTemplateRepository.insert(model);
    }

    async getNotificationTemplatesForAccount(
        accountId: string
    ) : Promise<NotificationTemplate[]> {
        const models = await this.notificationTemplateRepository.allTemplatesForAccount(accountId);
        return models.map(templateModelToClientDao);
    }

    async updateScheduledNotification(
        scheduledEventId: string,
        notification: Notification,
        sendAt: Date
    ): Promise<void> {
        const event = await this.scheduledEventsRepository.getById(scheduledEventId);
        if (event == null) {
            throw new Error(`No scheduled event found with id ${scheduledEventId}`);
        }
        if (event.claimedAt != null) {
            throw new Error(`Scheduled event with id ${scheduledEventId} is claimed`);
        }
        const updatedEvent = new ScheduledEventModel(
            new ScheduledEventIdentifier(scheduledEventId),
            notification.accountId,
            notification.kind,
            sendAt,
            event.created,
            notification,
        );
        await this.scheduledEventsRepository.put(updatedEvent);
    }

    async createAlert(
        params: CreateAlertParams,
        auditLogCallback: (alert: Alert) => void
    ): Promise<Alert> {
        const model = AlertModel.create(
            params.message,
            params.adminsOnly,
            params.cooldownHours,
            params.startDate,
            params.endDate,
            params.accountIds,
            params.buttonText,
            params.buttonLink
        );
        const result = await this.alertRepository.insert(model);
        const alert = alertModelToClientDao(result);
        if (this.isAlertActiveOrSoonToBe(alert)) {
            this.notifyAlertChanges(params.accountIds, alert, AlertChangeType.CREATED);
        }
        auditLogCallback(alert);
        return alert;
    }

    async updateAlert(
        alert: Alert,
        auditLogCallback: (alert: Alert) => void
    ): Promise<Alert> {
        if (alert.alertId == null) {
            throw new Error("Alert ID is required");
        }
        const model = new AlertModel(
            new AlertIdentifier(alert.alertId),
            alert.message,
            alert.adminsOnly,
            alert.cooldownHours,
            alert.startDate,
            alert.endDate,
            alert.accountIds,
            alert.buttonText,
            alert.buttonLink
        )
        const updatedAlertModel = await this.alertRepository.put(model);
        const updatedAlert = alertModelToClientDao(updatedAlertModel);
        if (
            this.isAlertActiveOrSoonToBe(alert) ||
            this.isAlertActiveOrSoonToBe(updatedAlert)
        ) {
            this.notifyAlertChanges(
                uniq([...alert.accountIds, ...updatedAlertModel.accountIds]),
                updatedAlert,
                AlertChangeType.UPDATED
            );
        }
        auditLogCallback(updatedAlert);
        return updatedAlert;
    }

    async deleteAlert(
        id: string,
        auditLogCallback: (alert: Alert, deleted: boolean) => void
    ): Promise<void> {
        const alertId = new AlertIdentifier(id);
        const alert = await this.getAlert(id);
        if (alert == null) return;
        await this.alertRepository.delete(alertId);
        if (this.isAlertActiveOrSoonToBe(alert)) {
            this.notifyAlertChanges(alert.accountIds, alert, AlertChangeType.DELETED);
        }
        auditLogCallback(alert, true);
    }

    private isAlertActiveOrSoonToBe(alert: Alert): boolean {
        if (
            alert.startDate != null &&
            !isPast(new Date(alert.startDate)) &&
            differenceInHours(new Date(alert.startDate), new Date()) > 3
        ) {
            return false;
        }
        if (alert.endDate != null && isPast(new Date(alert.endDate))) {
            return false;
        }
        return true;
    }

    private async notifyAlertChanges(
        accountIds: string[],
        changedAlert: Alert,
        changeType: AlertChangeType
    ) {
        const routingKeys: RoutingKey[] = [];
        if (accountIds.length === 0) {
            routingKeys.push({ type: RoutingKeyType.ALL, value: null });
        } else {
            routingKeys.push(
                ...accountIds.map(id => ({ type: RoutingKeyType.ACCOUNT, value: id }))
            );
        }

        for (const routingKey of routingKeys) {
            await this.wsMessageHandler.dispatch({
                routingKey,
                body: {
                    type: ServiceNotificationType.ALERT_CHANGE,
                    body: {
                        changedAlert,
                        changeType
                    } as AlertChangedEventBody,
                    adminsOnly: changedAlert.adminsOnly
                }
            });
        }
    }

    async getAlert(id: string): Promise<Alert> {
        const model = await this.alertRepository.getAlert(
            new AlertIdentifier(id)
        );
        return alertModelToClientDao(model);
    }

    async findActiveAlerts(accountId: string, userId?: string): Promise<Alert[]> {
        const models = await this.alertRepository.getActiveAlerts(
            accountId
        );
        const alerts = models.map(alertModelToClientDao);
        if (alerts.some(a => a.adminsOnly)) {
            const resourcePermissions = await this.authClient.findResourcePermissions(
                userId,
                ResourceType.ACCOUNT,
                accountId,
                accountId
            );
            const isAdmin = resourcePermissions.some(t => t === PermissionName.EDIT);
            if (isAdmin) {
                return alerts;
            } else {
                return alerts.filter(a => !a.adminsOnly);
            }
        }
        return alerts;
    }

    async findAllAlerts(): Promise<Alert[]> {
        const models = await this.alertRepository.getAllAlerts();
        return models.map(alertModelToClientDao);
    }

    async connect(ws: WebSocket, session?: AuthenticatedSession): Promise<void> {
        return this.wsMessageHandler.handleWebSocketConnection(ws, session?.userId);
    }
}

export class NotificationServiceFactory {

    private readonly notificationTargetsFactory: NotificationTargetsRepositoryFactory
    private readonly scheduledEventsFactory: ScheduledEventRepositoryFactory
    private readonly notificationTemplateFactory: NotificationTemplateRepositoryFactory
    private readonly sentNotificationsFactory: SentNotificationRepositoryFactory
    private readonly alertsFactory: AlertRepositoryFactory

    constructor(
        private readonly config: Config,
        private messageHandler: MessageHandler,
        private dispatcherFactory: NotificationDispatcherFactory,
        notificationTargetsConfig: CollectionConfig,
        scheduledEventsConfig: CollectionConfig,
        notificationTemplateConfig: CollectionConfig,
        sentNotificationsConfig: CollectionConfig,
        alertsConfig: CollectionConfig,
        private repoServiceClient: BindersRepositoryServiceContract,
        private authClient: AuthorizationServiceClient
    ) {
        const topLevelLogger = LoggerBuilder.fromConfig(config);
        this.notificationTargetsFactory = new NotificationTargetsRepositoryFactory(
            notificationTargetsConfig,
            topLevelLogger
        );
        this.scheduledEventsFactory = new ScheduledEventRepositoryFactory(
            scheduledEventsConfig,
            topLevelLogger
        );
        this.notificationTemplateFactory = new NotificationTemplateRepositoryFactory(
            notificationTemplateConfig,
            topLevelLogger
        );
        this.sentNotificationsFactory = new SentNotificationRepositoryFactory(
            sentNotificationsConfig,
            topLevelLogger
        );
        this.alertsFactory = new AlertRepositoryFactory(
            alertsConfig,
            topLevelLogger
        );
    }

    forRequest(request: WebRequest): NotificationService {
        return new NotificationService(
            this.messageHandler,
            request.logger,
            this.dispatcherFactory,
            this.notificationTargetsFactory.build(request.logger),
            this.scheduledEventsFactory.build(request.logger),
            this.notificationTemplateFactory.build(request.logger),
            this.sentNotificationsFactory.build(request.logger),
            this.alertsFactory.build(request.logger),
            this.repoServiceClient,
            this.authClient
        );
    }

    static async fromConfig(config: Config): Promise<NotificationServiceFactory> {
        const redisPublisher: RedisClient = RedisClientBuilder.fromConfig(config, "pubsub", "Ex"); // (Ex = Keyevent and Expired events (https://redis.io/topics/notifications))
        const redisSubscriber: RedisClient = RedisClientBuilder.fromConfig(config, "pubsub");

        const itemLockHandler = new ItemLockHandler(redisPublisher);

        const dispatchHooks = new Map<ServiceNotificationType, DispatchHook>();
        dispatchHooks.set(
            ServiceNotificationType.ITEM_LOCKED,
            (routingKey, body, logger) => itemLockHandler.lock(routingKey.value, body, logger)
        );
        dispatchHooks.set(
            ServiceNotificationType.OVERRIDE_ITEM_LOCK,
            (routingKey, body, logger) => itemLockHandler.lock(routingKey.value, body, logger, true)
        );
        dispatchHooks.set(
            ServiceNotificationType.ITEM_RELEASED,
            (routingKey, body, logger) => itemLockHandler.unlock(routingKey.value, body, logger)
        );
        dispatchHooks.set(
            ServiceNotificationType.KEY_EXPIRED,
            async (routingKey, body, logger) => {
                const [resourceType, , itemId] = body.key.split(":");
                logger?.trace(`KEY_EXPIRED dispatchHook caught event; ${body.key}`, "redis-pubsub");
                if (resourceType === "itemlocks") {
                    logger?.trace(`server-releasing item ${itemId}`, "redis-pubsub");
                    const itemReleasedServiceNotification = {
                        type: ServiceNotificationType.ITEM_RELEASED,
                        body: { itemId },
                    }
                    redisPublisher.publish(routingKeyToRedisChannel(routingKey), JSON.stringify(itemReleasedServiceNotification));
                }
                return { interruptDispatch: true }; // ServiceNotificationType.KEY_EXPIRED is handled, doesn't need to be dispatched further
            }
        );

        const initialStateProviders = new Map<RoutingKeyType, Array<StateProvider>>();
        initialStateProviders.set(
            RoutingKeyType.ACCOUNT,
            [
                (routingKey: RoutingKey) => itemLockHandler.getLocks(routingKey.value),
            ],
        );

        const isUserAnAdminInAccount = async (userId: string, accountId: string): Promise<boolean> => {
            const acls = await authClient.findResourcePermissionsWithRestrictions(userId, ResourceType.ACCOUNT, accountId, accountId);
            const adminPermissions = acls
                .flatMap(acl => acl.rules.flatMap(rule => rule.permissions))
                .filter(permission => permission.name === PermissionName.EDIT)
            return adminPermissions.length > 0;
        }

        const messageHandler = new MessageHandler(redisPublisher, redisSubscriber, dispatchHooks, initialStateProviders, isUserAnAdminInAccount);
        const loginOption = getMongoLogin("notification_service");

        const [
            dispatcherFactory,
            notificationTargetsConfig,
            scheduledEventsConfig,
            notificationTemplatesConfig,
            sentNotificationsConfig,
            alertsConfig
        ] = await Promise.all([
            NotificationDispatcherFactory.fromConfig(config),
            CollectionConfig.promiseFromConfig(config, "notificationtargets", loginOption),
            CollectionConfig.promiseFromConfig(config, "scheduledevents", loginOption),
            CollectionConfig.promiseFromConfig(config, "notificationtemplates", loginOption),
            CollectionConfig.promiseFromConfig(config, "sentnotifications", loginOption),
            CollectionConfig.promiseFromConfig(config, "alerts", loginOption),
        ]);

        const repoServiceClient = await BackendRepoServiceClient.fromConfig(config, "notification-service");
        const authClient = await BackendAuthorizationServiceClient.fromConfig(config, "notification-service");

        return new NotificationServiceFactory(
            config,
            messageHandler,
            dispatcherFactory,
            notificationTargetsConfig,
            scheduledEventsConfig,
            notificationTemplatesConfig,
            sentNotificationsConfig,
            alertsConfig,
            repoServiceClient,
            authClient
        );
    }
}
