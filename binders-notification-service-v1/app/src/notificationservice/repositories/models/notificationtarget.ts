import { NotificationKind, NotifierKind } from "@binders/client/lib/clients/notificationservice/v1/contract";

export class NotificationTarget {
    constructor(
        public readonly accountId: string,
        public readonly notifierKind: NotifierKind,
        public readonly targetId: string,
        public readonly notificationKind: NotificationKind,
        public readonly itemId?: string
    ) {}

    static create(
        accountId: string,
        notifierKind: NotifierKind,
        targetId: string,
        notificationKind: NotificationKind,
        itemId?: string
    ): NotificationTarget {
        return new NotificationTarget(
            accountId,
            notifierKind,
            targetId,
            notificationKind,
            itemId
        );
    }
}
