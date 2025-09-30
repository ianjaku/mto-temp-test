import UUID from "@binders/client/lib/util/uuid";

export type ElasticOperation = "bulk" | "delete" | "index" | "update"

export class OperationLog {
    constructor(
        public readonly id: string,
        public readonly operation: ElasticOperation,
        public readonly payload: string,
        public readonly timestamp: Date,
    ) { }

    static create(
        operation: ElasticOperation,
        payload: string,
    ): OperationLog {
        const timestamp = new Date()
        return new OperationLog(
            UUID.randomWithPrefix("opid-"),
            operation,
            payload,
            timestamp
        );
    }

}