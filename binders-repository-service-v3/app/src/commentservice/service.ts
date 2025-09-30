import {
    AuditLogCommentFn,
    AuditLogFn,
    CommentEdits,
    CommentServiceContract,
    CommentThreadOrigin,
    CommentThreadsFilter,
    ExtendedCommentThread,
    GetReaderCommentOptions,
    IBinderComment,
    IBinderCommentQuery,
    ICommentThread,
    ReaderComment,
} from "@binders/client/lib/clients/commentservice/v1/contract";
import {
    AuthorizationServiceContract,
    PermissionName,
    ResourceType
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import {
    BackendImageServiceClient,
    BackendTrackingServiceClient,
    BackendUserServiceClient,
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BinderCommentsRepositoryFactory, IBinderCommentsRepository } from "./repositories/bindercomments";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { CommentThreadsRepositoryFactory, ICommentThreadsRepository } from "./repositories/commentthreads";
import { DefaultESQueryBuilderHelper, ESQueryBuilderHelper } from "../repositoryservice/esquery/helper";
import { ElasticMultiRepository, MultiRepository } from "../repositoryservice/repositories/multirepository";
import { Logger, LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { ServerEvent, captureServerEvent } from "@binders/binders-service-common/lib/tracking/capture";
import { BackendAuthorizationServiceClient } from "@binders/binders-service-common/lib/authorization/backendclient";
import { Binder } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { BinderComment } from "./repositories/models/binderComment";
import { COMMENT_COUNTER_LABEL } from "@binders/binders-service-common/lib/monitoring/prometheus/htmlSanitizing";
import { CommentThread } from "./repositories/models/commentThread";
import { Config } from "@binders/client/lib/config";
import HtmlSanitizer from "@binders/binders-service-common/lib/html/sanitizer";
import { ImageServiceContract } from "@binders/client/lib/clients/imageservice/v1/contract";
import { PublicationNotFound } from "@binders/client/lib/clients/publicapiservice/v1/contract";
import { PublicationRepository } from "../repositoryservice/repositories/publicationrepository";
import { PublicationRepositoryFactory } from "../repositoryservice/service";
import { TrackingServiceContract } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { Unauthorized } from "@binders/client/lib/clients/model";
import { UserServiceContract } from "@binders/client/lib/clients/userservice/v1/contract";
import { getUserName } from "@binders/client/lib/clients/userservice/v1/helpers";
import { groupBy } from "ramda";
import { isBefore } from "date-fns";

export class CommentService implements CommentServiceContract {
    constructor(
        private readonly publicationRepository: PublicationRepository,
        private readonly multiRepository: MultiRepository,
        private readonly binderCommentsRepository: IBinderCommentsRepository,
        private readonly commentThreadsRepository: ICommentThreadsRepository,
        private readonly authorizationContract: AuthorizationServiceContract,
        private readonly trackingServiceContract: TrackingServiceContract,
        private readonly imageServiceContract: ImageServiceContract,
        private readonly userServiceContract: UserServiceContract,
        private readonly logger: Logger,
    ) { }

    async createReaderComment(
        publicationId: string,
        chunkId: string,
        accountId: string,
        text: string,
        actorId?: string,
    ): Promise<string> {
        if (actorId == null) throw new Unauthorized("UserId is null");
        const publication = await this.publicationRepository.getPublication(publicationId);
        if (publication == null) throw new PublicationNotFound("Publication not found");
        if (publication.accountId !== accountId) throw new Unauthorized("Publication id does not match the given account id");

        const thread = await this.commentThreadsRepository.insertThread(
            CommentThread.create(
                publication.binderId,
                chunkId,
                publication.language.iso639_1,
                CommentThreadOrigin.Reader,
                actorId,
                accountId,
                publicationId,
            )
        );

        const sanitizedText = new HtmlSanitizer(this.logger, COMMENT_COUNTER_LABEL).sanitizeHtml(text);
        const comment = await this.binderCommentsRepository.createBinderComment(thread.id, actorId, sanitizedText);
        captureServerEvent(ServerEvent.ReaderCommentCreated, {
            accountId,
            userId: actorId
        }, {
            publicationId,
            text,
            chunkId,
            binderId: publication.binderId
        });
        return comment.id;
    }

    async deleteBinderComment(binderId: string, threadId: string, commentId: string, userId: string, _accountId: string, auditLogger: AuditLogFn, canAdmin: boolean): Promise<ExtendedCommentThread[]> {
        const [comment] = await this.binderCommentsRepository.getComments({ id: commentId });
        if (comment.userId !== userId && !canAdmin) {
            throw new Unauthorized("Deletion of other users' comments is not authorized for non-admins");
        }
        await this.binderCommentsRepository.deleteBinderComment(commentId);
        const comments = await this.binderCommentsRepository.getComments({ threadIds: [threadId] });
        if (comments.length === 0) {
            await this.commentThreadsRepository.deleteThread(threadId);
        }
        await auditLogger(this.trackingServiceContract);
        return this.getCommentThreads(binderId);
    }

    async deleteOwnComment(
        commentId: string,
        threadId: string,
        accountId: string,
        authorId?: string,
        authUserId?: string
    ): Promise<void> {
        const threadComments = await this.binderCommentsRepository.getComments({ threadIds: [threadId] });
        const commentToDelete = threadComments.find(comment => comment.id === commentId);
        if (commentToDelete == null) {
            this.logger.error(`Comment with id ${commentId} was not found`, "reader-comment");
            throw new Unauthorized(`Comment ${commentId} not found`, `Not allowed to delete ${commentId}`);
        }
        if (commentToDelete.userId !== authorId) {
            this.logger.error(`Comment user ${commentToDelete.userId} does not match requester ${authorId}`, "reader-comment");
            throw new Unauthorized(`Comment user does not match requester ${authorId}`, `Not allowed to delete ${commentId}`);
        }
        const thread = await this.commentThreadsRepository.findThreadById(threadId);
        if (thread == null) {
            this.logger.error(`Thread with id ${threadId} was not found`, "reader-comment");
            throw new Unauthorized(`Could not find the thread ${threadId}`, `Not allowed to delete ${commentId}`);
        }
        await this.#ensureUserHasViewPermissionsOnDoc(authUserId, thread.binderId, accountId, commentId);

        if (threadComments.length === 1) {
            await this.binderCommentsRepository.deleteBinderComment(commentId);
            await this.commentThreadsRepository.deleteThread(threadId);
        } else {
            await this.binderCommentsRepository.softDeleteComment(commentId);
        }
    }

    async findCommentThreads(commentThreadsFilter: CommentThreadsFilter): Promise<ICommentThread[]> {
        const threads = await this.commentThreadsRepository.findThreads(commentThreadsFilter);
        return threads as ICommentThread[];
    }

    async getCommentThreads(binderId: string): Promise<ExtendedCommentThread[]> {
        const commentThreads = await this.commentThreadsRepository.getThreads(binderId);
        if (!commentThreads || !commentThreads.length) {
            return [];
        }
        const [threadIds, resolverIds] = commentThreads.reduce((acc, thread) => {
            const [threadIds, resolverIds] = acc;
            threadIds.push(thread.id);
            if (thread.resolvedBy) {
                resolverIds.push(thread.resolvedBy);
            }
            return [threadIds, resolverIds];
        }, [[], []] as [string[], string[]]);

        const comments = await this.binderCommentsRepository.getComments({ threadIds });
        const commenterIdsSet = comments.reduce((acc, comment) => acc.add(comment.userId), new Set<string>());
        const commenterIds = Array.from(commenterIdsSet);
        const users = await this.userServiceContract.findUserDetailsForIds(resolverIds.concat(commenterIds));
        const attachments = await this.imageServiceContract.getFeedbackAttachmentVisuals(binderId);
        const attachmentsByCommentId = groupBy(attachment => attachment.commentId, attachments);

        const populatedComments = comments.map(comment => {
            const user = users.find(u => u.id === comment.userId);
            return {
                ...comment,
                userName: user && getUserName(user),
                userLogin: user && user.login,
                attachments: attachmentsByCommentId[comment.id],
            }
        });

        const binder = await this.multiRepository.getBinderOrCollection(binderId);
        const allKnownChunkIds = new Set((binder as Binder).binderLog.current
            .flatMap(currentPositionLog => [currentPositionLog.uuid, ...currentPositionLog.targetId]));

        return commentThreads.map((thread) => {
            const resolvedByUser = thread.resolvedBy && users.find(u => u.id === thread.resolvedBy);
            const resolvedByName = resolvedByUser && getUserName(resolvedByUser);
            const resolvedByLogin = resolvedByUser && resolvedByUser.login;
            return {
                ...thread,
                ...(resolvedByUser ? { resolvedByName, resolvedByLogin } : {}),
                comments: populatedComments.filter(comment => comment.threadId === thread.id),
                isOrphaned: !allKnownChunkIds.has(thread.chunkId),
            }
        });
    }

    async getComments(commentsFilter: IBinderCommentQuery): Promise<IBinderComment[]> {
        const comments = await this.binderCommentsRepository.getComments(commentsFilter);
        return comments as IBinderComment[];
    }

    async getReaderComments(
        binderId: string,
        userId?: string,
        options?: GetReaderCommentOptions,
    ): Promise<ReaderComment[]> {
        const threads = await this.commentThreadsRepository.getThreadsByUserInBinder(
            binderId,
            userId,
            CommentThreadOrigin.Reader
        );
        if (threads.length === 0) return [];
        const threadIds = threads.map(t => t.id);
        const comments = await this.binderCommentsRepository.getComments({ threadIds });
        if (comments.length === 0) return [];

        const commentsByThread = new Map<string, BinderComment[]>();
        for (const comment of comments) {
            const comments = commentsByThread.get(comment.threadId) ?? [];
            comments.push(comment);
            commentsByThread.set(comment.threadId, comments);
        }

        const feedbackAttachments = await this.imageServiceContract.getFeedbackAttachmentVisuals(binderId, options?.visualSearchOptions);

        const readerComments: ReaderComment[] = [];
        for (const thread of threads) {
            const comments = commentsByThread.get(thread.id);
            if (comments == null || comments.length === 0) continue;
            const oldestComment = comments.reduce((prev, curr) =>
                isBefore(prev.created, curr.created) ? prev : curr
            );
            if (oldestComment.markedAsDeleted) continue;
            readerComments.push({
                commentId: oldestComment.id,
                threadId: thread.id,
                binderId: thread.binderId,
                chunkId: thread.chunkId,
                languageCode: thread.languageCode,
                publicationId: thread.publicationId,
                resolved: !!thread.resolved,
                body: oldestComment.body,
                created: oldestComment.created,
                attachments: feedbackAttachments.filter(visual => visual.commentId === oldestComment.id),
                isEdited: oldestComment.isEdited,
                authorId: oldestComment.userId,
            });
        }
        return readerComments;
    }

    async insertBinderComment(
        binderId: string,
        chunkId: string,
        languageCode: string,
        binderComment: IBinderComment,
        accountId: string,
        auditLogger: AuditLogCommentFn,
    ): Promise<ExtendedCommentThread[]> {
        const { userId, body } = binderComment;
        if (body.length > 5000) {
            throw new Unauthorized("Comments with over 5000 characters are not allowed");
        }
        const sanitizedBody = new HtmlSanitizer(this.logger, COMMENT_COUNTER_LABEL).sanitizeHtml(body);
        if (sanitizedBody.length === 0) {
            throw new Unauthorized("Empty comments are not allowed");
        }
        let threadId = binderComment.threadId;
        if (!threadId) {
            const newThread = await this.commentThreadsRepository.insertThread(
                CommentThread.create(
                    binderId,
                    chunkId,
                    languageCode,
                    CommentThreadOrigin.Editor,
                    userId,
                    accountId
                )
            );
            threadId = newThread.id;
            captureServerEvent(ServerEvent.EditorCommentThreadCreated, {
                accountId,
                userId,
            }, {
                binderId,
                languageCode
            });
        }
        const comment = await this.binderCommentsRepository.createBinderComment(threadId, userId, sanitizedBody);
        await auditLogger(this.trackingServiceContract, threadId, comment.id);
        captureServerEvent(ServerEvent.EditorCommentCreated, {
            accountId,
            userId,
        }, {
            binderId,
            languageCode,
            threadId,
        });
        return this.getCommentThreads(binderId);
    }

    async migrateCommentThreads(
        binderId: string,
        sourceChunkIds: string[],
        targetChunkId: string,
        _accountId: string,
        auditLogger: AuditLogFn
    ): Promise<ExtendedCommentThread[]> {
        await Promise.all(sourceChunkIds.map(chunkId => this.commentThreadsRepository.migrateThreads(chunkId, targetChunkId)));
        await auditLogger(this.trackingServiceContract);
        return this.getCommentThreads(binderId);
    }

    async resolveCommentThread(binderId: string, threadId: string, userId: string, accountId: string, auditLogger: AuditLogFn): Promise<ExtendedCommentThread[]> {
        await this.commentThreadsRepository.resolveThread(threadId, userId);
        await auditLogger(this.trackingServiceContract);
        const thread = await this.getCommentThreads(binderId);
        captureServerEvent(ServerEvent.CommentThreadResolved, { accountId, userId }, { binderId, threadId });
        return thread;
    }

    async updateReaderComment(
        threadId: string,
        commentId: string,
        commentEdits: CommentEdits,
        accountId: string,
        authorId?: string,
        authUserId?: string
    ): Promise<void> {
        if (!commentEdits) {
            return;
        }
        const [comment] = await this.binderCommentsRepository.getComments({ id: commentId });
        if (comment == null) {
            this.logger.error(`Comment with id ${commentId} was not found`, "reader-comment");
            throw new Unauthorized(`Not allowed to change ${commentId}`);
        }
        if (comment.userId !== authorId || comment.threadId !== threadId) {
            throw new Unauthorized(`Not allowed to change ${commentId}`);
        }
        const thread = await this.commentThreadsRepository.findThreadById(threadId);
        if (thread == null) {
            this.logger.error(`Thread with id ${threadId} was not found`, "reader-comment");
            throw new Unauthorized(`Not allowed to change ${commentId}`);
        }
        await this.#ensureUserHasViewPermissionsOnDoc(authUserId, thread.binderId, accountId, commentId);
        const sanitizedText = new HtmlSanitizer(this.logger, COMMENT_COUNTER_LABEL).sanitizeHtml(commentEdits.text);
        await this.binderCommentsRepository.updateBinderCommentBody(commentId, sanitizedText);

        if ((commentEdits.attachmentIdsForRemoval ?? []).length > 0) {
            await this.imageServiceContract.deleteVisuals(thread.binderId, commentEdits.attachmentIdsForRemoval);
        }
    }

    async #ensureUserHasViewPermissionsOnDoc(userId: string, binderId: string, accountId: string, commentId: string) {
        const permissions = await this.authorizationContract.findResourcePermissions(userId, ResourceType.DOCUMENT, binderId, accountId);
        if (!permissions.includes(PermissionName.VIEW)) {
            throw new Unauthorized(`User ${userId} is lacking read permission on ${binderId}`, `Not allowed to change ${commentId}`);
        }
    }

}

export class CommentServiceFactory {
    private readonly authorizationContractBuilder: (logger?: Logger) => AuthorizationServiceContract;
    private binderCommentsRepositoryFactory: BinderCommentsRepositoryFactory;
    private commentThreadsRepositoryFactory: CommentThreadsRepositoryFactory;
    private readonly queryBuilderHelper: ESQueryBuilderHelper;

    constructor(
        readonly config: Config,
        readonly logger: Logger,
        authorizationContractBuilder: (logger?: Logger) => AuthorizationServiceContract,
        private readonly trackingServiceContract: TrackingServiceContract,
        private readonly imageServiceContract: ImageServiceContract,
        private readonly userServiceContract: UserServiceContract,
        private publicationRepositoryFactory: PublicationRepositoryFactory,
        readonly binderCommentsCollectionConfig: CollectionConfig,
        readonly commentThreadsCollectionConfig: CollectionConfig,
    ) {
        this.authorizationContractBuilder = authorizationContractBuilder;
        this.userServiceContract = userServiceContract;
        this.binderCommentsRepositoryFactory = new BinderCommentsRepositoryFactory(binderCommentsCollectionConfig, logger);
        this.commentThreadsRepositoryFactory = new CommentThreadsRepositoryFactory(commentThreadsCollectionConfig, logger);
        this.queryBuilderHelper = new DefaultESQueryBuilderHelper(config);
    }

    forRequest(request: { logger?: Logger }): CommentService {
        const binderCommentsRepository = this.binderCommentsRepositoryFactory.build(request.logger);
        const commentThreadsRepository = this.commentThreadsRepositoryFactory.build(request.logger);
        const publicationRepository = this.publicationRepositoryFactory.forRequest(request.logger);
        const multiRepo = new ElasticMultiRepository(this.config, request.logger, this.queryBuilderHelper);

        return new CommentService(
            publicationRepository,
            multiRepo,
            binderCommentsRepository,
            commentThreadsRepository,
            this.authorizationContractBuilder(request.logger),
            this.trackingServiceContract,
            this.imageServiceContract,
            this.userServiceContract,
            request.logger,
        );
    }

    static async fromConfig(config: Config): Promise<CommentServiceFactory> {
        const loginOption = getMongoLogin("repository_service");
        const topLevelLogger = LoggerBuilder.fromConfig(config);
        const publicationRepositoryFactory = await PublicationRepositoryFactory.fromConfig(config);
        const authorizationContractBuilder = await BackendAuthorizationServiceClient.createBuilderFromConfig(config, "comment-service");
        const trackingServiceContract = await BackendTrackingServiceClient.fromConfig(config, "comment-service");
        const imageServiceClient = await BackendImageServiceClient.fromConfig(config, "comment-service");
        const userServiceClient = await BackendUserServiceClient.fromConfig(config, "comment-service");
        const binderCommentsCollectionConfig = await CollectionConfig.promiseFromConfig(config, "bindercomments", loginOption);
        const commentThreadsCollectionConfig = await CollectionConfig.promiseFromConfig(config, "commentthreads", loginOption);
        return new CommentServiceFactory(
            config,
            topLevelLogger,
            authorizationContractBuilder,
            trackingServiceContract,
            imageServiceClient,
            userServiceClient,
            publicationRepositoryFactory,
            binderCommentsCollectionConfig,
            commentThreadsCollectionConfig,
        );
    }
}
