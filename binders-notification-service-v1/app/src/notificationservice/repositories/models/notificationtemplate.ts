import { CustomNotification, RelativeDate } from "@binders/client/lib/clients/notificationservice/v1/contract";
import { NotificationTemplateIdentifier } from "@binders/binders-service-common/lib/authentication/identity";

export class NotificationTemplate {
    constructor(
        public readonly templateId: NotificationTemplateIdentifier,
        public readonly accountId: string,
        public readonly templateData: Partial<CustomNotification>,
        public readonly templateName: string,
        public readonly scheduledDate?: Date | RelativeDate,
        public readonly scheduledTime?: Date
    ) {}

    static create(
        accountId: string,
        templateData: Partial<CustomNotification>,
        templateName: string,
        scheduledDate?: Date | RelativeDate,
        scheduleTime?: Date
    ): NotificationTemplate {
        return new NotificationTemplate(
            NotificationTemplateIdentifier.generate(),
            accountId,
            templateData,
            templateName,
            scheduledDate,
            scheduleTime
        )
    }
}
