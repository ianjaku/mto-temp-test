import * as React from "react";
import {
    EmailMessage,
    SentNotification
} from  "@binders/client/lib/clients/notificationservice/v1/contract";
import { FC } from "react";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./NotificationHistory.styl";

interface MessageDataViewProps {
    backToHistory: () => void
    notification: SentNotification
}

export const MessageDataView: FC<MessageDataViewProps> = ({ backToHistory, notification }) => {
    const { t } = useTranslation();
    const messageData = notification.messageData as EmailMessage
    messageData.html = (messageData.inlineAttachments ?? [])
        .reduce((html, attch) => html.replace(`cid:${attch.cid}`, `/assets/email-icons/${attch.cid}`), messageData.html)
    const content = { __html: messageData.html }
    return (
        <div>
            <div className="notification-history-modal-link" onClick={backToHistory}>{t(TK.Notifications_BackToHistory)}</div>
            <div className="notification-history-message-view-row">
                <label htmlFor="subject" className="notification-history-message-view-label">
                    {t(TK.Notifications_Subject)}
                </label>
                <div>{messageData.subject}</div>
            </div>
            <div className="notification-history-message-view-row">
                <label htmlFor="subject" className="notification-history-message-view-label">
                    {t(TK.Notifications_EmailContent)}
                </label>
                <p dangerouslySetInnerHTML={content} />
            </div>

        </div>)
}