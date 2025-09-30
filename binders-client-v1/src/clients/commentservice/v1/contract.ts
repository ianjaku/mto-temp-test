import type { IVisualSearchOptions, Visual } from "../../imageservice/v1/contract";
import type { TrackingServiceContract } from "../../trackingservice/v1/contract";

export interface CommentServiceContract {
    createReaderComment(
        publicationId: string,
        chunkId: string,
        accountId: string,
        text: string,
    ): Promise<string>;
    deleteBinderComment(binderId: string, threadId: string, commentId: string, userId?: string, accountId?: string, auditLogger?: AuditLogFn, canAdmin?: boolean): Promise<ExtendedCommentThread[]>;
    deleteOwnComment(commentId: string, threadId: string, accountId: string): Promise<void>;
    findCommentThreads(commentThreadsFilter: CommentThreadsFilter): Promise<ICommentThread[]>;
    getCommentThreads(binderId: string): Promise<ExtendedCommentThread[]>;
    getComments(commentFilter: IBinderCommentQuery): Promise<IBinderComment[]>;
    getReaderComments(binderId: string, accountId: string, options?: GetReaderCommentOptions): Promise<ReaderComment[]>;
    insertBinderComment(binderId: string, chunkId: string, languageCode: string, binderComment: IBinderComment, accountId?: string, auditLogger?: AuditLogCommentFn): Promise<ExtendedCommentThread[]>;
    migrateCommentThreads(binderId: string, sourceChunkIds: string[], targetChunkId: string, accountId?: string, auditLogger?: AuditLogFn): Promise<ExtendedCommentThread[]>;
    resolveCommentThread(binderId: string, threadId: string, userId?: string, accountId?: string, auditLogger?: AuditLogFn): Promise<ExtendedCommentThread[]>;
    updateReaderComment(threadId: string, commentId: string, commentEdits: CommentEdits, accountId: string): Promise<void>;
}

export type AuditLogFn = (trackingClient: TrackingServiceContract) => Promise<void>;

export type AuditLogCommentFn = (trackingClient: TrackingServiceContract, threadId: string, commentId: string) => Promise<void>;

export interface CommentEdits {
    text?: string;
    attachmentIdsForRemoval?: string[];
}

export interface CommentThreadsFilter {
    ids?: string[];
    accountId?: string;
    resolved?: boolean;
}

export enum CommentThreadOrigin {
    Editor = "editor",
    Reader = "reader"
}

export type ExtendedCommentThread = ICommentThread & {
    comments: IBinderComment[];
    /**
     * Marks the comment thread as orphaned when its chunkIs cannot be
     * found in the binder it references (not even in the binder log)
     */
    isOrphaned?: boolean;
}

export interface GetReaderCommentOptions {
    visualSearchOptions?: IVisualSearchOptions;
}

export interface IBinderComment {
    id?: string;
    threadId?: string;
    userId: string;
    userName?: string;
    userLogin?: string;
    body: string;
    attachments?: Visual[];
    created?: Date;
    updated?: Date;
    isEdited?: boolean;
    markedAsDeleted?: boolean;
}

export interface IBinderCommentQuery {
    id?: string;
    threadIds?: string[];
    createdAfter?: Date;
    createdBefore?: Date;
}

export interface ICommentThread {
    id?: string;
    binderId: string;
    chunkId: string;
    languageCode: string;
    origin: CommentThreadOrigin;
    resolved: boolean;
    resolvedBy?: string;
    resolvedByName?: string;
    resolvedByLogin?: string;
    resolvedDate?: Date;
    accountId: string,
    created?: Date;
    updated?: Date;
}

export interface ReaderComment {
    commentId: string;
    threadId: string;
    binderId: string;
    chunkId: string;
    languageCode: string;
    publicationId: string;
    resolved: boolean;
    body: string;
    created: Date;
    isEdited: boolean;
    attachments?: Visual[];
    authorId: string;
}

