import * as React from "react";
import {
    Binder,
    DocumentCollection
} from  "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    CustomNotification,
    NotificationKind,
    ScheduledEvent
} from  "@binders/client/lib/clients/notificationservice/v1/contract";
import { User, UsergroupDetails } from "@binders/client/lib/clients/userservice/v1/contract";
import { useEffect, useMemo, useState } from "react";
import { APIFindScheduledNotifications } from "../../../api";
import { CreateNotificationModal } from "../create-notification-modal/CreateNotificationModal";
import { FC } from "react";
import { ScheduledNotification } from "./ScheduledNotification";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import compareAsc from "date-fns/compareAsc";
import { showModal } from "@binders/ui-kit/lib/compounds/modals/showModal";
import { uniq } from "ramda";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./CustomNotifications.styl";

export const CustomNotifications: FC<{
    targetItem: DocumentCollection | Binder;
    users: User[];
    groups: UsergroupDetails[];
    fetchUsersOrGroups: (userOrGroupIds: string[]) => void
}> = ({ targetItem, users, groups, fetchUsersOrGroups }) => {
    const { t } = useTranslation();
    const [
        scheduledNotifications,
        setScheduledNotifications
    ] = useState<ScheduledEvent[]>([]);

    const orderedNotifications = useMemo(() => {
        if (scheduledNotifications == null) return [];
        return [...scheduledNotifications]
            .sort((a, b) => compareAsc(new Date(a.sendAt), new Date(b.sendAt)));
    }, [scheduledNotifications]);

    // Hide scheduled notifications that have passed
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            const notExpiredNotifications = scheduledNotifications.filter(
                (notification) => new Date(notification.sendAt) > new Date()
            );
            if (notExpiredNotifications.length === scheduledNotifications.length) return;
            setScheduledNotifications(notExpiredNotifications);
        }, 1000);
        return () => clearTimeout(timeoutId);
    }, [scheduledNotifications]);

    const fetchScheduledNotifications = async () => {
        const scheduled = await APIFindScheduledNotifications(
            targetItem.accountId,
            targetItem.id,
            NotificationKind.CUSTOM
        );
        setScheduledNotifications(scheduled);

        const idsToFetch = scheduled.reduce((idsToFetch, scheduled) => {
            const notification = scheduled.notification as CustomNotification;
            const targetIds = notification.targets.map(t => t.targetId);
            return [...idsToFetch, ...targetIds];
        }, []);
            
        fetchUsersOrGroups(uniq(idsToFetch));
    }

    const createNotification = async (scheduled: boolean) => {
        const shouldRefetch = await showModal(CreateNotificationModal, {
            scheduled,
            targetItem,
        });
        if (shouldRefetch) {
            fetchScheduledNotifications();
        }
    }

    const updateNotification = async (scheduledNotification: ScheduledEvent) => {
        const shouldRefetch = await showModal(CreateNotificationModal, {
            scheduled: true,
            targetItem,
            scheduledNotification,
        });
        if (shouldRefetch) {
            fetchScheduledNotifications();
        }
    }
    
    useEffect(() => {
        fetchScheduledNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetItem])
    
    return (
        <div className="custom-notifications-wrapper">
            <div className="custom-notifications-buttons">
                <button
                    className="custom-notifications-button"
                    onClick={() => createNotification(true)}
                >
                    + {t(TK.Notifications_ScheduleNotification)}
                </button>
                <button
                    className="custom-notifications-button"
                    onClick={() => createNotification(false)}
                >
                    + {t(TK.Notifications_SendNotificationNow)}
                </button>
            </div>
            <h1 className="custom-notifications-title">
                {t(TK.Notifications_ScheduledItems)}
            </h1>
            {orderedNotifications.map(notification => (
                <ScheduledNotification
                    key={notification.id}
                    scheduledNotification={notification}
                    users={users}
                    groups={groups}
                    onEdit={() => updateNotification(notification)}
                />
            ))}
            {orderedNotifications.length === 0 && (
                <p className="custom-notifications-empty">
                    {t(TK.Notifications_NoScheduledNots)}
                </p>
            )}
        </div>
    )
}
