import AccountStore from "../accounts/store";
import { CommentServiceClient } from "@binders/client/lib/clients/commentservice/v1/client";
import { ExtendedCommentThread } from "@binders/client/lib/clients/commentservice/v1/contract";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config";
import { sanitizeUserInput } from "@binders/ui-kit/lib/helpers/sanitization";

const client = CommentServiceClient.fromConfig(
    config,
    "v1",
    browserRequestHandler,
    AccountStore.getActiveAccountId.bind(AccountStore),
);

export async function APIGetCommentThreads(binderId: string): Promise<ExtendedCommentThread[]> {
    return client.getCommentThreads(binderId);
}

export async function APIInsertBinderComment(binderId: string, chunkId: string, languageCode: string, threadId: string, userId: string, body: string, accountId: string): Promise<ExtendedCommentThread[]> {
    return client.insertBinderComment(
        binderId,
        chunkId,
        languageCode,
        {
            userId,
            threadId,
            body: sanitizeUserInput(body),
        },
        accountId,
    );
}

export async function APIDeleteBinderComment(binderId: string, threadId: string, commentId: string, accountId: string): Promise<ExtendedCommentThread[]> {
    return client.deleteBinderComment(
        binderId,
        threadId,
        commentId,
        undefined,
        accountId,
    );
}

export async function APIResolveCommentThread(binderId: string, threadId: string, accountId: string): Promise<ExtendedCommentThread[]> {
    return client.resolveCommentThread(
        binderId,
        threadId,
        undefined,
        accountId,
    );
}

export async function APIMigrateCommentThreads(binderId: string, sourceChunkIds: string[], targetChunkId: string, accountId: string): Promise<ExtendedCommentThread[]> {
    return client.migrateCommentThreads(
        binderId,
        sourceChunkIds,
        targetChunkId,
        accountId,
    );
}
