import {
    Notification,
    NotificationKind,
    NotifierTemplate
} from "@binders/client/lib/clients/notificationservice/v1/contract";
import {
    PUBLISH_NOTIFICATION_MESSAGE,
    PUBLISH_REQUEST_NOTIFICATION_MESSAGE,
    REVIEW_REQUEST_NOTIFICATION_MESSAGE,
    buildCustomNotificationMarkup,
    buildPublishNotificationMarkup,
    buildPublishRequestNotificationMarkup,
    buildReviewRequestNotificationMarkup
} from "./messages";
import {
    BackendUserServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { Config } from "@binders/client/lib/config/config";
import { ReaderBranding } from "@binders/client/lib/clients/routingservice/v1/contract";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import i18next from "@binders/client/lib/i18n";
import {
    isCustomNotification
} from "@binders/client/lib/clients/notificationservice/v1/validation";

export class NotifierTemplateFactory {

    constructor(
        private readonly userClient: UserServiceClient
    ) { }

    private readonly messageHandlers = {
        [NotificationKind.CUSTOM]: this.createCustomNotificationTemplate.bind(this),
        [NotificationKind.PUBLISH]: (_notification, domain, readerBranding) => ({
            subject: i18next.t(TK.Notifications_Publish_Subject),
            text: PUBLISH_NOTIFICATION_MESSAGE,
            ...buildPublishNotificationMarkup(
                domain,
                readerBranding,
            ),
        }),
        [NotificationKind.REVIEW_REQUEST]: (_notification, domain, readerBranding) => ({
            subject: i18next.t(TK.Notifications_Review_Request_Subject),
            text: REVIEW_REQUEST_NOTIFICATION_MESSAGE,
            ...buildReviewRequestNotificationMarkup(
                domain,
                readerBranding,
            )
        }),
        [NotificationKind.PUBLISH_REQUEST]: (_notification, domain, readerBranding) => ({
            subject: i18next.t(TK.Notifications_Publish_Request_Subject),
            text: PUBLISH_REQUEST_NOTIFICATION_MESSAGE,
            ...buildPublishRequestNotificationMarkup(
                domain,
                readerBranding,
            )
        })
    }

    buildMessage(
        notification: Notification,
        domain?: string,
        readerBranding?: ReaderBranding,
    ): Promise<NotifierTemplate> {
        const handler = this.messageHandlers[notification.kind];
        if (handler == null) throw new Error(`No handler to build a message for notification kind ${notification.kind}`);
        return handler(notification, domain, readerBranding);
    }

    private async createCustomNotificationTemplate(
        notification: Notification,
        domain: string,
        readerBranding?: ReaderBranding,
    ): Promise<NotifierTemplate> {
        if (!isCustomNotification(notification)) throw new Error(`Notification is not a custom notification ${JSON.stringify(notification)}`);

        let sender: User;
        if (notification.actorId != null) {
            sender = await this.userClient.getUser(notification.actorId);
        }

        return {
            subject: notification.subject,
            text: notification.text,
            ...buildCustomNotificationMarkup(notification.text, domain, readerBranding),
            fromName: sender?.displayName
        }
    }

    static async fromConfig(config: Config): Promise<NotifierTemplateFactory> {
        const userClient = await BackendUserServiceClient.fromConfig(config, "notification-service");
        return new NotifierTemplateFactory(
            userClient
        );
    }

}
