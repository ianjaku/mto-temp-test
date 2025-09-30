import {
    Binder,
    PublicationSummary
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { BackendCommentServiceClient } from "../../apiclient/backendclient";
import { BindersConfig } from "../../bindersconfig/binders";
import { ClientFactory } from "../../testutils/clientfactory";
import { CommentServiceClient } from "@binders/client/lib/clients/commentservice/v1/client";
import { Config } from "@binders/client/lib/config/config";

export class TestReaderCommentsFactory {

    constructor(
        private readonly config: Config,
        private readonly accountId: string
    ) { }

    async createReaderComment(
        doc: Binder,
        pub: PublicationSummary,
        chunkIndex: number,
        commentText: string,
        createForUserId?: string,
    ): Promise<void> {
        const client = await this.repoClient(createForUserId);
        const chunkId = this.chunkIdFromIndex(doc, chunkIndex);
        await client.createReaderComment(pub.id, chunkId, this.accountId, commentText);
    }

    async startNewThread(
        doc: Binder,
        chunkIndex: number,
        languageCode: string,
        commentText: string,
        createForUserId: string,
    ) {
        const client = await this.repoClient(createForUserId);
        const chunkId = this.chunkIdFromIndex(doc, chunkIndex);
        return client.insertBinderComment(doc.id, chunkId, languageCode, {
            userId: createForUserId,
            body: commentText,
        }, this.accountId);
    }


    private chunkIdFromIndex(doc: Binder, chunkIndex = 0): string {
        if (doc.binderLog?.current == null) {
            throw new Error("No binder log available");
        }
        const binderLog = doc.binderLog.current.find(log => log.position === chunkIndex);
        if (binderLog == null) {
            throw new Error(`No chunk at index ${chunkIndex}`);
        }
        return binderLog.uuid;
    }

    private repoClient(createForUserId?: string) {
        if (createForUserId) {
            const config = BindersConfig.get();
            const clientFactory = new ClientFactory(
                config,
                CommentServiceClient,
                "v1"
            );
            return clientFactory.createForFrontend(createForUserId, () => this.accountId);
        }
        return BackendCommentServiceClient.fromConfig(
            this.config,
            "testing"
        );
    }

}
