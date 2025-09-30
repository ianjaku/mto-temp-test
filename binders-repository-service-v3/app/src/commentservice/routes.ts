import {
    AccountFeaturesEnabled,
    asDeviceUserIfAvailable,
} from "@binders/binders-service-common/lib/middleware/authorization";
import {
    AccountServiceContract,
    FEATURE_READER_COMMENTING
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    AuditLogCommentFn,
    AuditLogFn,
    CommentServiceContract,
} from "@binders/client/lib/clients/commentservice/v1/contract";
import { CommentService, CommentServiceFactory } from "./service";
import { documentAuthorization, publicationAuthorization } from "../repositoryservice/authorization";
import { ApplicationToken } from "@binders/binders-service-common/lib/middleware/authentication";
import { AuditLogType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { AuthorizationServiceContract } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { BindersRepositoryServiceFactory } from "../repositoryservice/service";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { ServiceRoute } from "@binders/binders-service-common/lib/middleware/app";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import getAppRoutes from "@binders/client/lib/clients/commentservice/v1/routes";
import { getClientIps } from "@binders/binders-service-common/lib/util/ip";

export function getServiceRoutes(
    serviceFactory: CommentServiceFactory,
    logger: Logger,
    azClient: AuthorizationServiceContract,
    accountClient: AccountServiceContract,
    repoFactory: BindersRepositoryServiceFactory,
): { [name in keyof CommentServiceContract]: ServiceRoute } {
    const appRoutes = getAppRoutes();
    const repoClient = repoFactory.forRequest({ logger });
    const { docAdmin, docEdit, docRead } = documentAuthorization(azClient);
    const { publicationRead } = publicationAuthorization(azClient, repoClient);

    function withService<T>(f: (service: CommentService, request: WebRequest) => Promise<T>): (request: WebRequest) => Promise<T> {
        return function(request: WebRequest) {
            const service = serviceFactory.forRequest(request);
            return f(service, request);
        };
    }

    return {
        createReaderComment: {
            ...appRoutes.createReaderComment,
            serviceMethod: async (request) => {
                return serviceFactory.forRequest(request)
                    .createReaderComment(
                        request.body.publicationId,
                        request.body.chunkId,
                        request.body.accountId,
                        request.body.text,
                        request.user.userId
                    )
            },
            authentication: ApplicationToken,
            authorization: asDeviceUserIfAvailable(publicationRead("publicationId"))
        },
        deleteOwnComment: {
            ...appRoutes.deleteOwnComment,
            serviceMethod: request => serviceFactory.forRequest(request).deleteOwnComment(
                request.body.commentId,
                request.body.threadId,
                request.body.accountId,
                request.user.userId,
                request.user.deviceUserId ?? request.user.userId
            ),
            authentication: ApplicationToken,
            authorization: AccountFeaturesEnabled(accountClient, [FEATURE_READER_COMMENTING]),
        },
        deleteBinderComment: {
            ...appRoutes.deleteBinderComment,
            serviceMethod: withService(async (service, request) => {
                const auditLogger: AuditLogFn = async (trackingClient) => {
                    await trackingClient.logAuditLog(
                        AuditLogType.BINDERCOMMENT_DELETED,
                        request.user && request.user.userId,
                        request.body.accountId,
                        request["headers"] && request["headers"]["user-agent"],
                        {
                            binderId: request.body.binderId,
                            threadId: request.body.threadId,
                            commentId: request.body.commentId,
                        },
                        getClientIps(request),
                    );
                };
                // eslint-disable-next-line no-async-promise-executor
                const canAdmin = await new Promise<boolean>(async resolve => {
                    try {
                        await docAdmin("binderId", "body")(request);
                        resolve(true);
                    } catch (err) {
                        logger.error(err.message || err, "deleteBinderComment")
                        resolve(false);
                    }
                })
                return service.deleteBinderComment(request.body.binderId, request.body.threadId,
                    request.body.commentId, request.user && request.user.userId, undefined, auditLogger, canAdmin);
            }),
            authentication: ApplicationToken,
            authorization: docEdit("binderId", true),
        },
        findCommentThreads: {
            ...appRoutes.findCommentThreads,
            serviceMethod: withService(
                (service, request) => {
                    const commentThreadsFilter = request.body.commentThreadsFilter;
                    return service.findCommentThreads(commentThreadsFilter);
                }
            ),
        },
        getCommentThreads: {
            ...appRoutes.getCommentThreads,
            serviceMethod: withService((service, request) =>
                service.getCommentThreads(request.params.binderId)
            ),
            authentication: ApplicationToken,
            authorization: docEdit("binderId"),
        },
        getComments: {
            ...appRoutes.getComments,
            serviceMethod: withService(
                (service, request) => {
                    const commentsFilter = request.body.commentsFilter;
                    return service.getComments(commentsFilter);
                }
            ),
        },
        getReaderComments: {
            ...appRoutes.getReaderComments,
            serviceMethod: (request) => {
                const optionsSerialized = request.params.options;
                const options = optionsSerialized && optionsSerialized !== ":options" && JSON.parse(optionsSerialized);
                return serviceFactory.forRequest(request)
                    .getReaderComments(
                        request.params.binderId,
                        request.user.userId,
                        options,
                    )
            },
            authentication: ApplicationToken,
            authorization: asDeviceUserIfAvailable(docRead("binderId"))
        },
        insertBinderComment: {
            ...appRoutes.insertBinderComment,
            serviceMethod: withService((service, request) => {
                const auditLogger: AuditLogCommentFn = async (trackingClient, threadId, commentId) => {
                    await trackingClient.logAuditLog(
                        AuditLogType.BINDERCOMMENT_ADDED,
                        request.user && request.user.userId,
                        request.body.accountId,
                        request["headers"] && request["headers"]["user-agent"],
                        {
                            binderId: request.body.binderId,
                            chunkId: request.body.chunkId,
                            threadId,
                            commentId,
                            languageCode: request.body.languageCode,
                            body: request.body.binderComment.body,
                        },
                        getClientIps(request),
                    );
                };
                return service.insertBinderComment(
                    request.body.binderId,
                    request.body.chunkId,
                    request.body.languageCode,
                    request.body.binderComment,
                    request.body.accountId,
                    auditLogger
                );
            }),
            authentication: ApplicationToken,
            authorization: docEdit("binderId", true),
        },
        migrateCommentThreads: {
            ...appRoutes.migrateCommentThreads,
            serviceMethod: withService((service, request) => {
                const auditLogger: AuditLogFn = async (trackingClient) => {
                    await trackingClient.logAuditLog(
                        AuditLogType.BINDERCOMMENTTHREADS_CHUNKMERGE,
                        request.user && request.user.userId,
                        request.body.accountId,
                        request["headers"] && request["headers"]["user-agent"],
                        {
                            binderId: request.body.binderId,
                            uuids: request.body.sourceChunkIds.join(),
                        },
                        getClientIps(request),
                    );
                };
                return service.migrateCommentThreads(request.body.binderId, request.body.sourceChunkIds, request.body.targetChunkId, undefined, auditLogger);
            }),
            authentication: ApplicationToken,
            authorization: docEdit("binderId", true),
        },
        updateReaderComment: {
            ...appRoutes.updateReaderComment,
            serviceMethod: request => serviceFactory.forRequest(request)
                .updateReaderComment(
                    request.params.threadId,
                    request.params.commentId,
                    request.body.commentEdits,
                    request.body.accountId,
                    request.user.userId,
                    request.user.deviceUserId ?? request.user.userId
                ),
            authentication: ApplicationToken,
            authorization:
                AccountFeaturesEnabled(accountClient, [FEATURE_READER_COMMENTING]),
        },
        resolveCommentThread: {
            ...appRoutes.resolveCommentThread,
            serviceMethod: withService((service, request) => {
                const auditLogger: AuditLogFn = async (trackingClient) => {
                    await trackingClient.logAuditLog(
                        AuditLogType.BINDERCOMMENTTHREAD_RESOLVED,
                        request.user && request.user.userId,
                        request.body.accountId,
                        request["headers"] && request["headers"]["user-agent"],
                        {
                            binderId: request.body.binderId,
                            threadId: request.body.threadId
                        },
                        getClientIps(request),
                    );
                };
                return service.resolveCommentThread(request.body.binderId, request.body.threadId,
                    request.user && request.user.userId, undefined, auditLogger);
            }),
            authentication: ApplicationToken,
            authorization: docEdit("binderId", true),
        },
    };

}
