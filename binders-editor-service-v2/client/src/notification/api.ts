import {
    Alert,
    AlertChangedEventBody,
    AllItemLocksServiceNotification,
    CreateNotificationTargetParams,
    CustomNotification,
    ItemLockServiceNotification,
    ItemReleaseServiceNotification,
    Notification,
    NotificationKind,
    NotificationTarget,
    NotificationTemplate,
    OverrideItemLockServiceNotification,
    RelativeDate,
    RoutingKey,
    ScheduledEvent,
    SentNotification,
    ServiceNotification,
    ServiceNotificationBody,
    ServiceNotificationType,
    SimpleTarget
} from "@binders/client/lib/clients/notificationservice/v1/contract";
import DocumentStore, { ACTION_ITEM_LOCK_OVERRIDDEN } from "../documents/store";
import {
    overrideItemLock,
    releaseItemLockAndSetRedirectionPolicy,
    setItemLockAndRedirectionPolicy,
    setLockedItems
} from "../editlocking/store";
import AccountStore from "../accounts/store";
import {
    NotificationServiceClient
} from "@binders/client/lib/clients/notificationservice/v1/client";
import { alertUpdateListeners } from "./alerts/Alerts";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config";
import { dispatch } from "@binders/client/lib/react/flux/dispatcher";
import { getWindowId } from "./windowId";
import { logoutCurrentUser } from "../stores/my-details-store";
import { refetchVisual } from "../media/actions";

export const client = NotificationServiceClient.fromConfig(
    config,
    "v1",
    browserRequestHandler,
    handleServiceNotification,
    AccountStore.getActiveAccountId.bind(AccountStore)
);


export async function APIFindActiveAlerts(accountId: string): Promise<Alert[]> {
    return client.findActiveAlerts(accountId);
}

export async function APISendCustomNotification(
    accountId: string,
    itemId: string,
    targets: SimpleTarget[],
    subject: string,
    text: string,
    sendAt?: Date
): Promise<void> {
    await client.sendCustomNotification(
        accountId,
        itemId,
        targets,
        subject,
        text,
        sendAt
    );
}

export async function APIUpdateScheduledNotification(
    scheduledEventId: string,
    notification: Notification,
    sendAt: Date
): Promise<void> {
    await client.updateScheduledNotification(
        scheduledEventId,
        notification,
        sendAt
    );
}

export async function APIFindSentNotifications(
    accountId: string,
    itemId: string,
): Promise<SentNotification[]> {
    return client.findSentNotifications(accountId, itemId);
}

export async function APIFindNotificationTargets(
    accountId: string,
    itemIds?: string[]
): Promise<NotificationTarget[]> {
    return client.findNotificationTargets(
        accountId,
        undefined,
        itemIds
    );
}

export async function APIFindScheduledNotifications(
    accountId: string,
    itemId: string,
    kind?: NotificationKind
): Promise<ScheduledEvent[]> {
    return client.findScheduledNotifications(
        accountId,
        itemId,
        kind
    );
}

export async function APIDeleteNotificationTarget(
    target: NotificationTarget
): Promise<void> {
    return client.deleteNotificationTarget(
        target.accountId,
        target.targetId,
        target.notificationKind,
        target.itemId
    );
}

export async function APIAddNotificationTarget(
    params: CreateNotificationTargetParams
): Promise<NotificationTarget> {
    return client.addNotificationTarget(params);
}

export function APISubscribeToRoutingKeys(routingKeys: RoutingKey[]): void {
    return client.subscribe(routingKeys);
}

export function APIUnsubscribeFromRoutingKeys(routingKeys: RoutingKey[]): void {
    client.unsubscribe(routingKeys);
}

export function APIAddNotificationTemplate(
    accountId: string,
    templateData: Partial<CustomNotification>,
    templateName: string,
    scheduledDate?: Date | RelativeDate,
    scheduledTime?: Date
): Promise<NotificationTemplate> {
    return client.addNotificationTemplate(
        accountId,
        templateData,
        templateName,
        scheduledDate,
        scheduledTime
    );
}

export function APIDeleteNotificationTemplate(
    accountId: string,
    notificationTemplateId: string
): Promise<void> {
    return client.deleteNotificationTemplate(
        accountId,
        notificationTemplateId
    );
}

export function APIFindNotificationTemplatesForAccount(accountId: string): Promise<NotificationTemplate[]> {
    return client.getNotificationTemplatesForAccount(accountId)
}

export function closeWs(): void {
    client.closeWs();
}

export function APIDispatchEvent(routingKey: RoutingKey, eventType: ServiceNotificationType, eventBody: ServiceNotificationBody): void {
    return client.dispatch(routingKey, eventType, eventBody);
}

function handleServiceNotification(serviceNotification: ServiceNotification) {
    const { body: serviceNotificationBody } = serviceNotification;
    switch (serviceNotification.type) {
        case ServiceNotificationType.ALL_LOCKED_ITEMS: {
            const { edits } = serviceNotificationBody as AllItemLocksServiceNotification["body"];
            const editsWithLockedInfo = edits.map(lockInfo => ({
                ...lockInfo,
                lockedInThisWindow: lockInfo.windowId === getWindowId()
            }));
            setLockedItems(editsWithLockedInfo);
            break;
        }
        case ServiceNotificationType.ITEM_LOCKED: {
            const {
                itemId, user, windowId: wId, lockVisibleByInitiator, redirectionPolicy
            } = serviceNotificationBody as ItemLockServiceNotification["body"];
            const itemLock = { itemId, user, lockVisibleByInitiator, lockedInThisWindow: wId === getWindowId() };
            setItemLockAndRedirectionPolicy(itemLock, redirectionPolicy);
            break;
        }
        case ServiceNotificationType.OVERRIDE_ITEM_LOCK: {
            const activeItemId = DocumentStore.getActiveBinderObject()?.id;
            const itemLock = serviceNotificationBody as OverrideItemLockServiceNotification["body"];
            const overriddenItemLock = { ...itemLock, overriddenByThisWindow: itemLock.windowId === getWindowId() };
            overrideItemLock(overriddenItemLock, activeItemId);
            dispatch({
                type: ACTION_ITEM_LOCK_OVERRIDDEN,
                body: overriddenItemLock,
            });
            break;
        }
        case ServiceNotificationType.ITEM_RELEASED: {
            const { itemId, redirectionPolicy } = serviceNotificationBody as ItemReleaseServiceNotification["body"];
            releaseItemLockAndSetRedirectionPolicy(itemId, redirectionPolicy);
            break;
        }
        case ServiceNotificationType.USER_LOGGED_OFF: {
            if (serviceNotificationBody.windowId !== getWindowId()) {
                logoutCurrentUser(serviceNotificationBody.sessionId);
            }
            break;
        }
        case ServiceNotificationType.VIDEOPROCESSING_END:
            refetchVisual(
                serviceNotificationBody.binderId,
                serviceNotificationBody.visualId,
            );
            break;
        case ServiceNotificationType.ALERT_CHANGE:
            alertUpdateListeners.forEach(
                listener => listener(serviceNotificationBody as AlertChangedEventBody)
            );
            break;
        default:
            // eslint-disable-next-line no-console
            console.error("Service notification of unknown type received", serviceNotification);
    }
}
