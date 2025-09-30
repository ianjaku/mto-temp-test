import UUID from "@binders/client/lib/util/uuid";

export class ApiTokenModel {
    constructor(
        public readonly uuid: string,
        public readonly accountId: string,
        public readonly userId: string,
        public readonly created: Date
    ) {}

    generateNewUuid(): ApiTokenModel {
        return new ApiTokenModel(
            UUID.random().toString(),
            this.accountId,
            this.userId,
            this.created
        );
    }

    static create(accountId: string, userId: string): ApiTokenModel {
        return new ApiTokenModel(
            UUID.random().toString(),
            accountId,
            userId,
            new Date()
        );
    }
}
