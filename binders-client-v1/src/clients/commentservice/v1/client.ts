import type {
    AuditLogCommentFn,
    AuditLogFn,
    CommentEdits,
    CommentServiceContract,
    CommentThreadsFilter,
    ExtendedCommentThread,
    GetReaderCommentOptions,
    IBinderComment,
    IBinderCommentQuery,
    ReaderComment,
} from "./contract";
import {
    BindersServiceClient,
    RequestHandler,
} from "../../client";
import { BindersServiceClientConfig } from "../../config";
import type { Config } from "../../../config";
import { Visual as VisualObj } from "../../imageservice/v1/Visual";
import getRoutes from "./routes";

export class CommentServiceClient extends BindersServiceClient implements CommentServiceContract {

    constructor(
        endpointPrefix: string,
        requestHandler: RequestHandler,
        accountIdProvider?: () => string,
    ) {
        super(endpointPrefix, getRoutes(), requestHandler, accountIdProvider);
    }

    static fromConfig(
        config: Config,
        version: string,
        requestHandler: RequestHandler,
        accountIdProvider?: () => string,
    ): CommentServiceClient {
        const versionedPath = BindersServiceClientConfig.getVersionedPath(config, "comment", version);
        return new CommentServiceClient(versionedPath, requestHandler, accountIdProvider);
    }

    async createReaderComment(
        publicationId: string,
        chunkId: string,
        accountId: string,
        text: string,
        userToken?: string
    ): Promise<string> {
        return this.handleRequest("createReaderComment", {
            body: {
                accountId,
                publicationId,
                chunkId,
                text,
                userToken
            },
            useDeviceTargetUserToken: true
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    deleteBinderComment(binderId: string, threadId: string, commentId: string, _userId?: string, accountId?: string, _auditLogger?: AuditLogFn): Promise<ExtendedCommentThread[]> {
        return this.handleRequest("deleteBinderComment", {
            body: {
                accountId,
                binderId,
                threadId,
                commentId,
            }
        });
    }

    deleteOwnComment(commentId: string, threadId: string, accountId: string): Promise<void> {
        return this.handleRequest("deleteOwnComment", {
            body: {
                commentId,
                threadId,
                accountId,
            },
            useDeviceTargetUserToken: true
        });
    }

    findCommentThreads(commentThreadsFilter: CommentThreadsFilter): Promise<ExtendedCommentThread[]> {
        return this.handleRequest("findCommentThreads", { body: { commentThreadsFilter } });
    }

    getCommentThreads(binderId: string): Promise<ExtendedCommentThread[]> {
        return this.handleRequest("getCommentThreads", {
            pathParams: {
                binderId,
            }
        });
    }

    getComments(commentsFilter: IBinderCommentQuery): Promise<IBinderComment[]> {
        return this.handleRequest("getComments", { body: { commentsFilter } });
    }

    async getReaderComments(binderId: string, accountId: string, options?: GetReaderCommentOptions): Promise<ReaderComment[]> {
        const readerComments = await this.handleRequest<ReaderComment[]>("getReaderComments", {
            pathParams: {
                binderId,
                accountId,
                ...(options ? { options: JSON.stringify(options) } : {}),
            },
            useDeviceTargetUserToken: true
        });
        return readerComments.map(comment => ({
            ...comment,
            attachments: comment.attachments.map(attachment => Object.assign(Object.create(VisualObj.prototype), attachment)),
            created: new Date(comment.created),
        }))
    }

    insertBinderComment(
        binderId: string,
        chunkId: string,
        languageCode: string,
        binderComment: IBinderComment,
        accountId?: string,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _auditLogger?: AuditLogCommentFn,
    ): Promise<ExtendedCommentThread[]> {
        return this.handleRequest("insertBinderComment", {
            body: {
                accountId,
                binderId,
                chunkId,
                languageCode,
                binderComment,
            }
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    migrateCommentThreads(binderId: string, sourceChunkIds: string[], targetChunkId: string, accountId?: string, _auditLogger?: AuditLogFn): Promise<ExtendedCommentThread[]> {
        return this.handleRequest("migrateCommentThreads", {
            body: {
                accountId,
                binderId,
                sourceChunkIds,
                targetChunkId,
            }
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    resolveCommentThread(binderId: string, threadId: string, _userId?: string, accountId?: string, _auditLogger?: AuditLogFn): Promise<ExtendedCommentThread[]> {
        return this.handleRequest("resolveCommentThread", {
            body: {
                accountId,
                binderId,
                threadId,
            }
        });
    }

    updateReaderComment(threadId: string, commentId: string, commentEdits: CommentEdits, accountId: string): Promise<void> {
        return this.handleRequest("updateReaderComment", {
            pathParams: {
                threadId,
                commentId,
            },
            body: {
                commentEdits,
                accountId,
            },
            useDeviceTargetUserToken: true
        });
    }

}
