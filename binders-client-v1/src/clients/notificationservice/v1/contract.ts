import { EntityNotFound } from "../../model";
import { IVideoIndexerResult } from "../../imageservice/v1/contract";

export class AlertNotFound extends EntityNotFound {
    constructor(id: string) {
        super(`Could not find alert with id ${id}`);
    }
}

export enum NotificationKind {
    PUBLISH = "publish",
    CUSTOM = "custom",
    REVIEW_REQUEST = "review",
    PUBLISH_REQUEST  = "publish-request",
}

export enum NotifierKind  {
    USER_EMAIL = "user-email",
    GROUP_EMAIL = "group-email",
    DUMMY = "dummy" // Doesn't do anything, and will always return 200 successfull
}

export type EmailInlineAttachment = {
    cid: string;
    filename: string;
    path: string;
}

export interface EmailMessage {
    subject: string;
    text: string;
    html: string;
    fromName?: string;
    replyTo?: string;
    inlineAttachments?: Array<EmailInlineAttachment>;
}

export interface NotifierTemplate {
    subject: string;
    text: string;
    html: string;
    fromName?: string;
    inlineAttachments?: Array<unknown>;
}

export interface Notification {
    accountId: string;
    kind: NotificationKind;
    actorId: string;
    itemId: string;
}

export interface Alert {
    alertId: string;
    message: string;
    adminsOnly: boolean;
    cooldownHours: number;
    startDate: Date;
    endDate: Date;
    accountIds: string[];
    buttonText: string;
    buttonLink: string;
}

export interface CreateAlertParams {
    message: string;
    accountIds: string[];
    adminsOnly?: boolean;
    cooldownHours?: number;
    startDate?: Date;
    endDate?: Date;
    buttonText?: string;
    buttonLink?: string;
}

export enum AlertChangeType {
    CREATED = "created",
    UPDATED = "updated",
    DELETED = "deleted"
}

export interface AlertChangedEventBody {
    changeType: AlertChangeType;
    changedAlert: Alert;
}

export interface PublishNotification extends Notification {
    kind: NotificationKind.PUBLISH;
    publicationId: string;
    publicationTitle: string;
    publicationLanguageCode: string;
}

export interface ReviewRequestNotification extends Notification {
    kind: NotificationKind.REVIEW_REQUEST;
}

export interface PublishRequestNotification extends Notification {
    kind: NotificationKind.PUBLISH_REQUEST;
}

export interface CustomNotification extends Notification {
    kind: NotificationKind.CUSTOM;
    targets: SimpleTarget[];
    subject: string;
    text: string;
}

export interface SimpleTarget {
    notifierKind: NotifierKind;
    targetId: string;
}

export interface SentNotification {
    accountId: string;
    kind: NotificationKind;
    messageData: {
        from: string;
        subject: string;
        text: string;
        html: string;
        inlineAttachments?: unknown[];
    };
    sentAt: Date;
    sentToNotifier: NotifierKind;
    /** @depricated use sentToIds instead */
    sentToId?: string;
    sentToIds: string[];
    notificationMetadata: unknown;
}

export interface NotificationTarget {
    accountId: string;
    notifierKind: NotifierKind;
    notificationKind: NotificationKind;
    targetId: string;
    itemId?: string;
}


export interface NotificationTemplate {
    templateId: string;
    accountId: string;
    templateData: Partial<CustomNotification>;
    templateName: string;
    scheduledDate?: Date | RelativeDate;
    scheduledTime?: Date;
}

export type CreateNotificationTargetParams = NotificationTarget;

export interface ScheduledEvent {
    id: string;
    accountId: string;
    kind: NotificationKind;
    sendAt: Date;
    created: Date;
    notification: Notification;
    claimedAt?: Date;
}

export interface WebSocketMessage {
    type: WebSocketMessageType;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: any;
    windowId?: string;
}

export interface NotificationEvent {
    routingKey: RoutingKey;
    body: ServiceNotification;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ServiceNotification<T = ServiceNotificationType, U = any> {
    type: T;
    body: U;
    windowId?: string;
    adminsOnly?: boolean;
}

export interface ItemLock {
    itemId: string;
    user: {
        id: string,
        displayName: string,
        login: string,
    };
    windowId?: string;
    lockVisibleByInitiator?: boolean;
    redirectionPolicy?: IRedirectionPolicy;
}

export interface ItemRelease {
    itemId: string;
    userId?: string;
    windowId?: string;
    lockVisibleByInitiator?: boolean;
    redirectionPolicy?: IRedirectionPolicy;
}

export interface AllItemLocksServiceNotification
    extends ServiceNotification<ServiceNotificationType.ALL_LOCKED_ITEMS, { edits: ItemLock[] }> {}

export interface ItemLockServiceNotification
    extends ServiceNotification<ServiceNotificationType.ITEM_LOCKED, ItemLock> {}

export interface OverrideItemLockServiceNotification
    extends ServiceNotification<ServiceNotificationType.OVERRIDE_ITEM_LOCK, ItemLock> {}

export interface ItemReleaseServiceNotification
    extends ServiceNotification<ServiceNotificationType.ITEM_RELEASED, ItemRelease> {}

export interface RoutingKey {
    type: RoutingKeyType;
    value: string;
}

export enum WebSocketMessageType {
    SUBSCRIBE = 0,
    UNSUBSCRIBE = 1,
    DISPATCH = 2,
}

export enum RoutingKeyType {
    ALL = 0,
    ACCOUNT = 1,
    USER = 8,
}

export enum ServiceNotificationType {
    CONNECTION_SUCCESS = 0,
    ROUTING_KEYS_UPDATED = 10,
    KEY_EXPIRED = 20,
    ALL_LOCKED_ITEMS = 100,
    ITEM_LOCKED = 150,
    OVERRIDE_ITEM_LOCK = 160,
    ITEM_RELEASED = 200,
    VIDEOINDEXING_PROGRESS = 300,
    VIDEOINDEXING_END = 320,
    VIDEOPROCESSING_END = 350,
    USER_LOGGED_OFF = 666,
    ALERT_CHANGE = 700, // Notifies the user that an alert was created, updated or deleted
}

export interface IRedirectionPolicy {
    targetItemId: string;
    redirectCollectionId?: string;
    restrictRedirectionToComposer?: boolean;
}

export interface UserLogoutNotificationBody {
    sessionId: string;
    windowId: string;

}

export interface IDispatchHookResult<T = ServiceNotification> {
    interruptDispatch?: boolean;
    overriddenServiceNotification?: T;
}

export const DispatchHookSuccess = {};

export type VideoIndexingNotificationBody = IVideoIndexerResult;

export interface VideoTranscodingNotificationBody {
    accountId: string;
    visualId: string;
    binderId: string;
}

export type ServiceNotificationBody =
    ItemLock |
    ItemRelease |
    VideoIndexingNotificationBody |
    UserLogoutNotificationBody |
    VideoTranscodingNotificationBody;

export interface SendNotificationOptions {
    sendAt?: Date
}

export type DateGranularity = "days" | "months" | "years";

export interface RelativeDate {
    granularity: DateGranularity;
    amount: number;
}

export interface NotificationServiceContract {
    sendNotification(
        notification: Notification,
        options?: SendNotificationOptions
    ): Promise<void>;
    sendPublishRequestNotification(
        accountId: string,
        binderId: string,
    ): Promise<void>;
    findNotificationTargets(
        accountId: string,
        notificationKind?: NotificationKind,
        itemIds?: string[]
    ): Promise<NotificationTarget[]>;
    addNotificationTarget(params: CreateNotificationTargetParams): Promise<NotificationTarget>;
    findScheduledNotifications(
        accountId: string,
        itemId: string,
        kind?: NotificationKind
    ): Promise<ScheduledEvent[]>;
    deleteNotificationTarget(
        accountId: string,
        targetId: string,
        notificationKind: NotificationKind,
        itemId?: string
    ): Promise<void>;
    addNotificationTemplate(
        accountId: string,
        templateData: Partial<CustomNotification>,
        templateName: string,
        scheduledDate?: Date | RelativeDate,
        scheduledTime?: Date
    ): Promise<NotificationTemplate>
    deleteNotificationTemplate(
        accountId: string,
        notificationTemplateId: string
    ): Promise<void>;
    getNotificationTemplatesForAccount(accountId: string) : Promise<NotificationTemplate[]>
    findSentNotifications(accountId: string, itemId: string): Promise<SentNotification[]>;
    deleteNotificationTargets(
        targetId: string,
        accountId?: string
    ): Promise<void>;
    subscribe(routingKeys: RoutingKey[]): void;
    unsubscribe(routingKeys: RoutingKey[]): void;
    closeWs(): void;
    dispatch(routingKey: RoutingKey, eventType: ServiceNotificationType, eventBody: ServiceNotificationBody): void;
    deleteAllForAccount(accountId: string): Promise<void>;
    runScheduledEvents(): Promise<void>;
    sendCustomNotification(
        accountId: string,
        itemId: string,
        targets: SimpleTarget[],
        subject: string,
        text: string,
        sendAt?: Date
    ): Promise<CustomNotification>;
    updateScheduledNotification(
        scheduledEventId: string,
        notification: Notification,
        sendAt: Date
    ): Promise<void>;
    createAlert(params: Omit<Alert, "alertId">): Promise<Alert>;
    updateAlert(alert: Alert): Promise<Alert>;
    deleteAlert(alertId: string): Promise<void>;
    getAlert(id: string): Promise<Alert>;
    findActiveAlerts(accountId: string): Promise<Alert[]>;
    findAllAlerts(): Promise<Alert[]>;
}

export interface ILockInfo {
    itemId?: string;
    user: {
        id: string,
        displayName: string,
        login: string,
    };
    windowId?: string;
    lockedInThisWindow?: boolean;
    itsMe?: boolean;
}