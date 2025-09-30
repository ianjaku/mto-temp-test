import {
    CreateNotificationTargetParams,
    NotificationKind,
    NotificationTarget,
    NotifierKind
} from  "@binders/client/lib/clients/notificationservice/v1/contract";
import { BackendNotificationServiceClient } from "../../apiclient/backendclient";
import { Config } from "@binders/client/lib/config/config";


export class TestNotificationTargetFactory {
    constructor(
        private readonly config: Config,
        private readonly accountId: string
    ) {}

    async create(
        values: Partial<Omit<CreateNotificationTargetParams, "accountId">> & { targetId: string }
    ): Promise<NotificationTarget> {
        const defaults = {
            notifierKind: NotifierKind.USER_EMAIL,
            notificationKind: NotificationKind.PUBLISH,
            targetId: "some-target-id"
        }
        const client = await BackendNotificationServiceClient.fromConfig(
            this.config,
            "testing",
            null
        );

        return await client.addNotificationTarget({
            accountId: this.accountId,
            ...defaults,
            ...values
        });
    }
}
