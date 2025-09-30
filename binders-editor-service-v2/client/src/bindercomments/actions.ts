import {
    APIDeleteBinderComment,
    APIInsertBinderComment,
    APIMigrateCommentThreads,
    APIResolveCommentThread,
} from "./api";
import { invalidateCommentThreads } from "../documents/hooks";

export async function addComment(accountId: string, binderId: string, chunkId: string, languageCode: string, threadId: string, userId: string, body: string): Promise<void> {
    await APIInsertBinderComment(binderId, chunkId, languageCode, threadId, userId, body, accountId);
    invalidateCommentThreads(binderId);
}

export async function deleteComment(accountId: string, binderId: string, threadId: string, commentId: string): Promise<void> {
    await APIDeleteBinderComment(binderId, threadId, commentId, accountId);
    invalidateCommentThreads(binderId);
}

export async function resolveThread(accountId: string, binderId: string, threadId: string): Promise<void> {
    await APIResolveCommentThread(binderId, threadId, accountId);
    invalidateCommentThreads(binderId);
}

export async function migrateCommentThreads(accountId: string, binderId: string, sourceChunkIds: string[], targetChunkId: string): Promise<void> {
    await APIMigrateCommentThreads(binderId, sourceChunkIds, targetChunkId, accountId);
    invalidateCommentThreads(binderId);
}
