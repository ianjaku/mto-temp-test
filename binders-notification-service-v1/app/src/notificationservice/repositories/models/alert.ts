import { AlertIdentifier } from "@binders/binders-service-common/lib/authentication/identity";

export class Alert {
    constructor(
        public readonly alertId: AlertIdentifier,
        public readonly message: string,
        public readonly adminsOnly: boolean,
        public readonly cooldownHours: number,
        public readonly startDate: Date,
        public readonly endDate: Date,
        public readonly accountIds: string[],
        public readonly buttonText: string,
        public readonly buttonLink: string
    ) {}

    static create(
        message: string,
        adminsOnly: boolean,
        cooldownHours: number,
        startDate: Date,
        endDate: Date,
        accountIds: string[],
        buttonText: string,
        buttonLink: string
    ): Alert {
        return new Alert(
            AlertIdentifier.generate(),
            message,
            adminsOnly,
            cooldownHours,
            startDate,
            endDate,
            accountIds,
            buttonText,
            buttonLink
        )
    }
}