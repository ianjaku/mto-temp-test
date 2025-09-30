import * as React from "react";
import { FC, useEffect, useMemo, useState } from "react";
import { APIFindSentNotifications } from "../../../api";
import { Binder } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { DocumentCollection } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { MessageDataView } from "./MessageDataView";
import { SentNotification } from "@binders/client/lib/clients/notificationservice/v1/contract";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import Table from "@binders/ui-kit/lib/elements/Table/SimpleTable";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import { buildUserName } from "@binders/client/lib/clients/userservice/v1/helpers";
import { fmtDateIso8601TimeLocalizedTZ } from "@binders/client/lib/util/date";
import { uniq } from "ramda";
import { useActiveAccountId } from "../../../../accounts/hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./NotificationHistory.styl";


interface NotificationHistoryProps {
    fetchUsersOrGroups: (userOrGroupIds: string[]) => void;
    targetItem: Binder | DocumentCollection;
    users: User[];
}

export const NotificationHistory: FC<NotificationHistoryProps> = ({
    fetchUsersOrGroups,
    targetItem,
    users,
}) => {
    const accountId: string = useActiveAccountId();
    const { t } = useTranslation();

    const [sentNotifications, setSentNotifications] = useState<SentNotification[]>([]);
    const [selectedNotification, setSelectedNotification] = useState<SentNotification>(undefined);

    useEffect(() => {
        const fetchSentNotifications = async () => {
            const sentNotifications = await APIFindSentNotifications(
                accountId,
                targetItem.id
            )
            setSentNotifications(sentNotifications)
            const idsToFetch = sentNotifications.map(sentNotification => sentNotification.sentToId)
            fetchUsersOrGroups(uniq(idsToFetch))
        }
        fetchSentNotifications()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accountId, targetItem.id]);
    const tableData = useMemo(() => {

        const showMessageView = (sentNotification: SentNotification) => {
            setSelectedNotification(sentNotification)
        }

        return sentNotifications.map(sentNotification => {
            const user = users.find(u => u.id === sentNotification.sentToId);
            return [
                sentNotification.kind?.toUpperCase(),
                user ? buildUserName(user) : t(TK.Notifications_UserNotExists),
                fmtDateIso8601TimeLocalizedTZ(sentNotification.sentAt),
                <div
                    className="notification-history-modal-link"
                    onClick={() => showMessageView(sentNotification)}
                >
                    <a rel="noreferrer">{t(TK.Notifications_ShowMessage)}</a>
                </div>
            ]
        })
    }, [sentNotifications, users, t]);

    const backToHistory = () => {
        setSelectedNotification(undefined)
    }

    return (
        <div>
            {selectedNotification && (
                <MessageDataView
                    backToHistory={backToHistory}
                    notification={selectedNotification}
                />
            )}
            {!selectedNotification && (
                <Table
                    noActionArea
                    data={tableData}
                    recordsPerPage={15}
                    customHeaders={["TYPE", "TARGETS", "SENT ON", ""]}
                />
            )}
        </div>
    )
}
