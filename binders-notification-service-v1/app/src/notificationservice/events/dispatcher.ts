import {
    Notification,
    NotifierKind
} from  "@binders/client/lib/clients/notificationservice/v1/contract";
import { omit, uniq } from "ramda";
import { Attachment } from "@binders/binders-service-common/lib/mail/mailgun";
import { BackendRepoServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { Config } from "@binders/client/lib/config/config";
import { NotificationMailer } from "./mailer";
import { NotifierTemplateFactory } from "./messages/notificationMessageTemplateFactory";
import { RoutingServiceClient } from "@binders/client/lib/clients/routingservice/v1/client";
import { SentNotificationRepository } from "../repositories/sentnotifications";
import { TargetResolver } from "./targetresolver";
import { TemplateTagResolver } from "./templatetagresolver";
import {
    isCustomNotification
} from  "@binders/client/lib/clients/notificationservice/v1/validation";

export const NOTIFICATION_EMAIL_GENERIC_FROM = "Manual.to notifications <noreply@mail.manual.to>";
const NOTIFICATION_EMAIL_NAMED_FROM = "[name] <noreply@mail.manual.to>"

export class MissingNotificationTargetItem extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, MissingNotificationTargetItem.prototype);  // ES5 >= requirement
    }
}

export class NotificationDispatcher {
    constructor(
        private readonly targetResolver: TargetResolver,
        private readonly templateFactory: NotifierTemplateFactory,
        private readonly sentNotificationsRepository: SentNotificationRepository,
        private readonly routingServiceClient: RoutingServiceClient,
        private readonly config: Config,
        private readonly mailer: NotificationMailer,
        private readonly useCustomEmailNames: boolean,
    ) { }

    async dispatch(notification: Notification): Promise<void> {
        const targets = await this.targetResolver.resolve(notification);
        if (targets.length === 0) return;

        const item = await this.resolveNotificationItem(notification);
        const tagResolver = await TemplateTagResolver.fromConfig(this.config, item, notification.actorId);
        const domains = await this.routingServiceClient.getDomainFiltersForAccounts([notification.accountId]);

        const domainForBranding = domains.length && domains[0];
        const readerBranding = domainForBranding && await this.routingServiceClient.getBrandingForReaderDomain(domainForBranding.domain);
        const messageTemplate = await this.templateFactory.buildMessage(
            notification,
            domainForBranding.domain,
            readerBranding,
        );

        const tagsInText = await tagResolver.findTagsInText(messageTemplate.text);
        const tagsInSubject = await tagResolver.findTagsInText(messageTemplate.subject);
        const tagsInHtml = await tagResolver.findTagsInText(messageTemplate.html);
        const tags = uniq([...tagsInText, ...tagsInSubject, ...tagsInHtml]);

        const users = await this.targetResolver.resolve(notification);
        const targetUserEmails = users.map(u => u.login);

        const variables = {};
        const variablesByUserId = {};
        for (const user of users) {
            const userVariables = {
                ...notification,
                ...(await tagResolver.parseTags(tags, user))
            }
            variables[user.login] = userVariables;
            variablesByUserId[user.id] = variables[user.login];
        }

        let from = NOTIFICATION_EMAIL_GENERIC_FROM;
        if (
            messageTemplate.fromName &&
            this.useCustomEmailNames &&
            isCustomNotification(notification)
        ) {
            from = NOTIFICATION_EMAIL_NAMED_FROM.replace("[name]", messageTemplate.fromName);
        }

        const messageData = {
            from,
            subject: messageTemplate.subject,
            text: messageTemplate.text,
            html: messageTemplate.html,
            inlineAttachments: messageTemplate.inlineAttachments as Attachment[],
        }

        await this.mailer.sendBatchMessages(
            messageData,
            targetUserEmails,
            variables
        );

        await this.sentNotificationsRepository.insert(
            {
                accountId: notification.accountId,
                kind: notification.kind,
                messageData,
                notificationMetadata: omit(["accountId", "kind"], notification),
                sentAt: new Date(),
                sentToNotifier: NotifierKind.USER_EMAIL,
                sentToIds: users.map(u => u.id),
            },
            variablesByUserId
        );
    }

    private async resolveNotificationItem(notification: Notification) {
        const repoService = await BackendRepoServiceClient.fromConfig(this.config, "notification-service");
        const [ item ] = await repoService.findItems({ ids: [ notification.itemId ] }, { maxResults: 1 });
        if (item == null) {
            throw new MissingNotificationTargetItem(`Item with id ${notification.itemId} not found`);
        }
        return item;
    }
}
