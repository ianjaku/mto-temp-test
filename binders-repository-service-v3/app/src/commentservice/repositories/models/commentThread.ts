import { CommentThreadOrigin } from "@binders/client/lib/clients/commentservice/v1/contract";
import UUID from "@binders/client/lib/util/uuid";

export class CommentThread {
    constructor(
        public readonly id: string,
        public readonly binderId: string,
        public readonly chunkId: string,
        public readonly languageCode: string,
        public readonly origin: CommentThreadOrigin,
        public readonly resolved: boolean,
        public readonly resolvedBy: string,
        public readonly resolvedDate: Date,
        public readonly created: Date,
        public readonly updated: Date,
        public readonly publicationId: string,
        public readonly createdById: string,
        public readonly accountId: string,
    ) {
    }

    static create(
        binderId: string,
        chunkId: string,
        languageCode: string,
        origin: CommentThreadOrigin,
        createdById: string,
        accountId: string,
        publicationId?: string
    ): CommentThread {
        return new CommentThread(
            UUID.randomWithPrefix("ctid-"),
            binderId,
            chunkId,
            languageCode,
            origin,
            false,
            undefined,
            undefined,
            undefined,
            undefined,
            publicationId,
            createdById,
            accountId
        );
    }
}
