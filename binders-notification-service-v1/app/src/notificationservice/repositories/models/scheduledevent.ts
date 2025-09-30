import { Notification, NotificationKind } from "@binders/client/lib/clients/notificationservice/v1/contract";
import { ScheduledEventIdentifier } from "@binders/binders-service-common/lib/authentication/identity";

export class ScheduledEvent {
    constructor(
        public readonly id: ScheduledEventIdentifier,
        public readonly accountId: string,
        public readonly kind: NotificationKind,
        public readonly sendAt: Date,
        public readonly created: Date,
        public readonly notification: Notification,
        public readonly claimedAt?: Date
    ) {}

    static create(
        accountId: string,
        kind: NotificationKind,
        sendAt: Date,
        notification: Notification
    ): ScheduledEvent {
        return new ScheduledEvent(
            ScheduledEventIdentifier.generate(),
            accountId,
            kind,
            sendAt,
            new Date(),
            notification
        )
    }
}
