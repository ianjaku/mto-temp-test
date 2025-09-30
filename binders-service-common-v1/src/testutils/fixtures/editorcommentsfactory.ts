import { BackendCommentServiceClient } from "../../apiclient/backendclient";
import { Binder } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { BindersConfig } from "../../bindersconfig/binders";
import { ClientFactory } from "../../testutils/clientfactory";
import { CommentServiceClient } from "@binders/client/lib/clients/commentservice/v1/client";
import { Config } from "@binders/client/lib/config/config";
import { ExtendedCommentThread } from "@binders/client/lib/clients/commentservice/v1/contract";

export class TestEditorCommentsFactory {

    constructor(
        private readonly config: Config,
        private readonly accountId: string
    ) { }

    async createOrphanedComment(
        doc: Binder,
        commentText: string,
        languageCode: string,
        createForUserId?: string,
    ): Promise<ExtendedCommentThread[]> {
        const client = await this.repoClient(createForUserId);
        const inexistentChunkId = "00000000-0000-0000-0000-000000000000";
        const binderComment = {
            userId: createForUserId,
            body: commentText,
        };
        return client.insertBinderComment(doc.id, inexistentChunkId, languageCode, binderComment, this.accountId);
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
