import * as React from "react";
import { Pane, Tabs } from "@binders/ui-kit/lib/elements/tabs";
import {
    USER_GROUP_IDENTIFIER_PREFIX,
    USER_IDENTIFIER_PREFIX,
} from "@binders/client/lib/clients/userservice/v1/constants";
import { useGroups, useNotificationTargets, useUsers } from "./notificationSettingsModal";
import { Binder, } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import CircularProgress from "@binders/ui-kit/lib/elements/circularprogress";
import { CustomNotifications } from "./sections/custom-notification/CustomNotifications";
import { DocumentCollection } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import Modal from "@binders/ui-kit/lib/elements/modal";
import { ModalProps } from "@binders/ui-kit/lib/compounds/modals/ModalViewProvider";
import { NotificationHistory } from "./sections/notification-history/NotificationHistory";
import { RecipientsSettings } from "./sections/recipients-settings/RecipientsSettings";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./NotificationSettingsModal.styl";


export const NotificationSettingsModal: React.FC<ModalProps<{
    item: Binder | DocumentCollection
}, undefined>> = (
    { params, hide }
) => {
    const {
        isLoading,
        error,
        ancestors,
        refetch: refetchTargets,
        notificationTargets
    } = useNotificationTargets(params.item);
    const { t } = useTranslation();
    const { users, fetchUsers } = useUsers(notificationTargets);
    const { groups, fetchGroups } = useGroups(notificationTargets);

    const fetchUsersOrGroups = (ids: string[]) => {
        if (ids.length === 0) return;
        const userIds = ids.filter(id => id.startsWith(USER_IDENTIFIER_PREFIX));
        const groupIds = ids.filter(id => id.startsWith(USER_GROUP_IDENTIFIER_PREFIX));
        fetchUsers(userIds);
        fetchGroups(groupIds);
    }

    if (isLoading) {
        return (
            <Modal title="Notification settings">
                <div className="notification-settings-wrapper notification-settings-wrapper--loading">
                    {CircularProgress()} {t(TK.Notifications_Loading)}
                </div>
            </Modal>
        );
    }

    if (error) {
        return (
            <Modal title="Notification settings">
                <div className="notification-settings-wrapper notification-settings-wrapper--error">
                    {t(TK.General_SomethingWentWrong)}
                </div>
            </Modal>
        );
    }

    return (
        <Modal title="Notification settings" onHide={hide}>
            <div className="notification-settings-wrapper">
                <Tabs noContentPadding navHeight="auto" noBg fullWidth>
                    <Pane label={t(TK.Notifications_TabTitleRecipients)}>
                        <div className="notification-settings-content">
                            <RecipientsSettings
                                item={params.item}
                                users={users}
                                groups={groups}
                                targets={notificationTargets}
                                refetchTargets={refetchTargets}
                                ancestors={ancestors}
                            />
                        </div>
                    </Pane>
                    <Pane label={t(TK.Notifications_TabTitleCustom)}>
                        <div className="notification-settings-content">
                            <CustomNotifications 
                                targetItem={params.item}
                                users={users}
                                groups={groups}
                                fetchUsersOrGroups={fetchUsersOrGroups}
                            />
                        </div>
                    </Pane>
                    <Pane label={t(TK.Notifications_TabTitleHistory)}>
                        <div className="notification-settings-content">
                            <NotificationHistory
                                fetchUsersOrGroups={fetchUsersOrGroups}
                                users={users}
                                targetItem={params.item}
                            />
                        </div>
                    </Pane>
                </Tabs>
            </div>
        </Modal>
    );
}
