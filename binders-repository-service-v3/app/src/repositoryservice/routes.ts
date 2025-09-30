import {
    AccountAdminParams,
    AccountAdminToken,
    AccountFeaturesEnabled,
    AccountMemberBody,
    AccountMemberParams,
    AccountsEditorMember,
    AccountsMemberBody,
    Allow,
    Authorization,
    BindersMediaAdmin,
    EditDocument,
    MultiAuthorization,
    MultiAuthorizationAnd,
    MultiAuthorizationOr,
    MultiDocumentEdit,
    MultiDocumentView,
    UserIdFromUserToken,
    ViewDocument,
    asDeviceUserIfAvailable,
    authorize,
    maybeAuth
} from "@binders/binders-service-common/lib/middleware/authorization";
import {
    AccountServiceContract,
    FEATURE_ANONYMOUS_RATING,
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    ApplicationToken,
    ApplicationTokenOrPublic,
    Public,
    buildUserTokenAuthentication
} from "@binders/binders-service-common/lib/middleware/authentication";
import {
    ApprovedStatus,
    BindersRepositoryServiceContract,
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    AuditLogType,
    PublishUpdateActionType,
    TrackingServiceContract
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { BindersRepositoryService, BindersRepositoryServiceFactory } from "./service";
import { documentAuthorization, publicationAuthorization } from "./authorization";
import { AuditLogFn } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    AuthorizationServiceContract
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import {
    FindBindersStatusesQueryParams
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import LaunchDarklyService from "@binders/binders-service-common/lib/launchdarkly/server";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { ServiceRoute } from "@binders/binders-service-common/lib/middleware/app";
import { Unauthorized } from "@binders/client/lib/clients/model";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import {
    extractInterfaceLanguageFromRequest
} from "@binders/binders-service-common/lib/util/i18n";
import getAppRoutes from "@binders/client/lib/clients/repositoryservice/v3/routes";
import { getClientIps } from "@binders/binders-service-common/lib/util/ip";
import { requireLaunchDarklyFlagEnabled } from "@binders/binders-service-common/lib/middleware/flags";

export function getServiceRoutes(
    logger: Logger,
    azClient: AuthorizationServiceContract,
    serviceFactory: BindersRepositoryServiceFactory,
    accountClient: AccountServiceContract,
    trackingClient: TrackingServiceContract,
    launchDarklyService: LaunchDarklyService,
): { [name in keyof BindersRepositoryServiceContract]: ServiceRoute } {
    const appRoutes = getAppRoutes();
    const service = serviceFactory.forRequest({ logger });
    const {
        docAdmin,
        docEdit,
        docPublish,
        docRead,
        docReviewApprove,
        docTranslate,
        multiDocAdmin,
        multiDocRead,
    } = documentAuthorization(azClient);
    const { publicationRead } = publicationAuthorization(azClient, service);

    function withService<T>(f: (service: BindersRepositoryService, request: WebRequest) => Promise<T>): (request: WebRequest) => Promise<T> {
        return function(request: WebRequest) {
            const service = serviceFactory.forRequest(request);
            return f(service, request);
        };
    }

    const canLeaveFeedback: Authorization = (request) => {
        if (request.user) {
            return asDeviceUserIfAvailable(publicationRead("publicationId"))(request);
        } else {
            return AccountFeaturesEnabled(accountClient, [FEATURE_ANONYMOUS_RATING])(request);
        }
    }

    const AccountMember = AccountMemberBody(accountClient);
    const AccountMemberP = AccountMemberParams(accountClient);
    const AccountsMember = AccountsMemberBody(accountClient);

    const docEditResetApproval: Authorization = req => MultiAuthorization(
        [
            docEdit("binderId", true),
            () => {
                return new Promise((resolve, reject) => {
                    if (req.body.approval === ApprovedStatus.UNKNOWN) {
                        return resolve(undefined);
                    }
                    return reject(new Unauthorized("You don't have the required permission."));
                })
            }
        ],
        true,
    )(req);

    const logAuditLogForPublishUpdate = (request: WebRequest) => {
        return (
            binderId: string,
            accountId: string,
            publicationId: string,
            publishUpdateAction: PublishUpdateActionType,
            languageCode = "xx",
        ) => {
            trackingClient.logAuditLog(
                AuditLogType.PUBLISH_DOCUMENT,
                request.user && request.user.userId,
                accountId,
                request["headers"] && request["headers"]["user-agent"],
                {
                    binderId,
                    publicationId,
                    publishUpdateAction,
                    languageCode,
                },
                getClientIps(request),
            );
        };
    };

    const logAuditLogForChunkApprovals = (request: WebRequest) => {
        return (
            binderId: string,
            accountId: string,
            chunkId: string,
            chunkLastUpdate: number,
            languageCode: string,
            approval: ApprovedStatus,
        ) => {
            trackingClient.logAuditLog(
                AuditLogType.CHUNK_APPROVAL_UPDATE,
                request.user && request.user.userId,
                accountId,
                request["headers"] && request["headers"]["user-agent"],
                {
                    binderId,
                    chunkId,
                    chunkLastUpdate,
                    languageCode,
                    approval,
                },
                getClientIps(request),
            )
        }
    }

    return {
        searchBindersAndCollections: {
            ...appRoutes.searchBindersAndCollections,
            serviceMethod: withService((service, request) => {
                return service.searchBindersAndCollections(
                    request.body.query,
                    request.body.options,
                    request.body.accountId,
                    request.body.multiSearchOptions,
                    request.user.userId,
                );
            }),
            authentication: ApplicationToken,
            authorization: AccountMember,
        },
        searchPublicationsAndCollections: {
            ...appRoutes.searchPublicationsAndCollections,
            serviceMethod: withService((service, request) => {
                return service.searchPublicationsAndCollections(
                    request.body.query,
                    request.body.options,
                    request.body.domain,
                    request.body.multiSearchOptions,
                    request.user && request.user.userId,
                );
            }),
            authentication: ApplicationTokenOrPublic,
            authorization: Allow,
        },
        getBinder: {
            ...appRoutes.getBinder,
            serviceMethod: withService((service, request) => {
                const { params: { binderId, options: optionsSerialized } } = request;
                const options = optionsSerialized && optionsSerialized !== ":options" && JSON.parse(optionsSerialized);
                return service.getBinder(binderId, options)
            }),
            authentication: ApplicationToken,
            authorization: docRead("binderId")
        },
        extendChunks: {
            ...appRoutes.extendChunks,
            serviceMethod: withService((service, request) =>
                service.extendChunks(
                    request.body.binderOrPublication,
                    request.body.additionalChunks,
                    request.body.translated,
                )),
            authentication: Public,
            authorization: Allow
        },
        findBinderIdsByAccount: {
            ...appRoutes.findBinderIdsByAccount,
            serviceMethod: withService((service, request) =>
                service.findBinderIdsByAccount(request.body.accountId)
            )
        },
        findBindersBackend: {
            ...appRoutes.findBindersBackend,
            serviceMethod: withService((service, request) =>
                service.findBindersBackend(request.body.filter, request.body.options)
            )
        },
        createBinderInCollection: {
            ...appRoutes.createBinderInCollection,
            serviceMethod: withService((service, request) =>
                service.createBinderInCollection(request.body.binder, request.body.collectionId, request.body.accountId, request.user),
            ),
            authentication: ApplicationToken,
            authorization: docEdit("collectionId", true),
        },
        createBinderBackend: {
            ...appRoutes.createBinderBackend,
            serviceMethod: withService((service, request) =>
                service.createBinderBackend(request.body),
            ),
        },
        duplicateBinder: {
            ...appRoutes.duplicateBinder,
            serviceMethod: withService((service, request) =>
                service.duplicateBinder(
                    request.body.toDuplicate,
                    request.body.collectionId,
                    request.body.fromAccountId,
                    request.body.toAccountId,
                    request.user,
                )),
            authentication: ApplicationToken,
            authorization: MultiAuthorization([
                authorize(
                    ViewDocument(req => Promise.resolve(req.body.toDuplicate.id)),
                    azClient,
                    undefined,
                    undefined,
                    "fromAccountId"
                ),
                authorize(
                    EditDocument(req => Promise.resolve(req.body.collectionId)),
                    azClient,
                    undefined,
                    undefined,
                    "toAccountId"
                )
            ], true),
        },
        duplicateCollection: {
            ...appRoutes.duplicateCollection,
            serviceMethod: withService((service, request) =>
                service.duplicateCollection(
                    request.body.collectionId,
                    request.body.targetCollectionId,
                    request.body.targetDomainCollectionId,
                    request.body.fromAccountId,
                    request.body.toAccountId
                )),
            authentication: ApplicationToken,
            authorization: MultiAuthorization([
                MultiAuthorization([
                    authorize(
                        ViewDocument(req => Promise.resolve(req.body.collectionId)),
                        azClient,
                        undefined,
                        undefined,
                        "fromAccountId"
                    ),
                    authorize(
                        EditDocument(req => Promise.resolve(req.body.targetCollectionId)),
                        azClient,
                        undefined,
                        undefined,
                        "toAccountId"
                    )], true),
            ])
        },
        updateBinder: {
            ...appRoutes.updateBinder,
            serviceMethod: withService((service, request) =>
                service.updateBinder(
                    request.body,
                    request.user.userId,
                )),
            authentication: ApplicationToken,
            authorization: docEdit("binderId")
        },
        findPublications: {
            ...appRoutes.findPublications,
            serviceMethod: withService((service, request) =>
                service.findPublications(
                    request.params.binderId,
                    request.body.filter,
                    request.body.options,
                )),
            authentication: ApplicationTokenOrPublic,
            authorization: docRead("binderId"),
        },
        findPublicationsBackend: {
            ...appRoutes.findPublicationsBackend,
            serviceMethod: withService((service, request) =>
                service.findPublicationsBackend(request.body.filter, request.body.options),
            ),
        },
        publish: {
            ...appRoutes.publish,
            serviceMethod: withService((service, request) =>
                service.publish(
                    request.params.binderId,
                    request.body.languages,
                    request.body.sendNotification,
                    request.user.userId,
                    logAuditLogForPublishUpdate(request),
                )),
            authentication: ApplicationToken,
            authorization: MultiAuthorization([
                docPublish("binderId"),
                docTranslate("binderId", (req) => req.body["languages"])
            ])
        },
        unpublish: {
            ...appRoutes.unpublish,
            serviceMethod: withService((service, request) =>
                service.unpublish(
                    request.params.binderId,
                    request.body.languages,
                    logAuditLogForPublishUpdate(request),
                    request.user.userId,
                )),
            authentication: ApplicationToken,
            authorization: docEdit("binderId")
        },
        setPublicationsShowInOverview: {
            ...appRoutes.setPublicationsShowInOverview,
            serviceMethod: withService((service, request) =>
                service.setPublicationsShowInOverview(
                    request.params.binderId,
                    request.body.showInOverview,
                    request.user.userId,
                )),
            authentication: ApplicationToken,
            authorization: docEdit("binderId"),
        },
        updatePublicationsLanguages: {
            ...appRoutes.updatePublicationsLanguages,
            serviceMethod: withService((service, request) =>
                service.updatePublicationsLanguages(request.params.binderId, request.body.languageCode, request.body.order),
            ),
            authentication: ApplicationToken,
            authorization: docEdit("binderId")
        },
        getPublication: {
            ...appRoutes.getPublication,
            serviceMethod: withService((service, request) => {
                const { params: { publicationId, options: optionsSerialized } } = request;
                let options;
                try {
                    options = optionsSerialized && JSON.parse(optionsSerialized);
                } catch (e) {
                    options = {};
                }
                return service.getPublication(publicationId, options);
            }),
            authentication: ApplicationTokenOrPublic,
            authorization: publicationRead("publicationId")
        },
        createCollectionInCollection: {
            ...appRoutes.createCollectionInCollection,
            serviceMethod: withService((service, request) =>
                service.createCollectionInCollection(request.body.accountId, request.body.collectionId, request.body.title, request.body.languageCode, request.body.thumbnail, request.user),
            ),
            authentication: ApplicationToken,
            authorization: docEdit("collectionId", true),
        },
        createCollectionBackend: {
            ...appRoutes.createCollectionBackend,
            serviceMethod: withService((service, request) =>
                service.createCollectionBackend(request.body.accountId, request.body.title, request.body.languageCode, request.body.thumbnail, request.body.domainCollectionId),
            ),
        },
        createRootCollection: {
            ...appRoutes.createRootCollection,
            serviceMethod: withService((service, request) =>
                service.createRootCollection(request.body.accountId, request.body.accountName),
            ),
        },
        saveCollectionTitle: {
            ...appRoutes.saveCollectionTitle,
            serviceMethod: withService((service, request) =>
                service.saveCollectionTitle(request.params.collectionId, request.body.title, request.params.languageCode),
            ),
            authentication: ApplicationToken,
            authorization: docEdit("collectionId")
        },
        updateLanguageOfCollectionTitle: {
            ...appRoutes.updateLanguageOfCollectionTitle,
            serviceMethod: withService((service, request) =>
                service.updateLanguageOfCollectionTitle(
                    request.body.collectionId,
                    request.body.currentLanguageCode,
                    request.body.languageCode
                )),
            authentication: ApplicationToken,
            authorization: docEdit("collectionId", true)
        },
        removeCollectionTitle: {
            ...appRoutes.removeCollectionTitle,
            serviceMethod: withService((service, request) =>
                service.removeCollectionTitle(
                    request.params.domain,
                    request.params.collectionId,
                    request.params.languageCode
                )),
            authentication: ApplicationToken,
            authorization: docEdit("collectionId")
        },
        updateCollectionIsHidden: {
            ...appRoutes.updateCollectionIsHidden,
            serviceMethod: withService((service, request) =>
                service.updateCollectionIsHidden(request.params.collectionId, request.body.isHidden),
            ),
            authentication: ApplicationToken,
            authorization: docEdit("collectionId"),
        },
        updateCollectionThumbnail: {
            ...appRoutes.updateCollectionThumbnail,
            serviceMethod: withService((service, request) =>
                service.updateCollectionThumbnail(request.params.collectionId, request.body.thumbnail),
            ),
            authentication: ApplicationToken,
            authorization: docEdit("collectionId")
        },
        removeCollectionThumbnail: {
            ...appRoutes.removeCollectionThumbnail,
            serviceMethod: withService((service, request) =>
                service.removeCollectionThumbnail(request.params.collectionId, request.body.options),
            ),
            authentication: ApplicationToken,
            authorization: docEdit("collectionId")
        },
        updateCollectionShowInOverview: {
            ...appRoutes.updateCollectionShowInOverview,
            serviceMethod: withService((service, request) =>
                service.updateCollectionShowInOverview(request.params.collectionId, request.body.showInOverview),
            ),
            authentication: ApplicationToken,
            authorization: docEdit("collectionId"),
        },
        addElementToCollection: {
            ...appRoutes.addElementToCollection,
            serviceMethod: withService((service, request) =>
                service.addElementToCollection(request.params.collectionId, request.body.kind, request.body.key, request.body.accountId),
            ),
            authentication: ApplicationToken,
            authorization: docEdit("collectionId")
        },
        removeElementFromCollection: {
            ...appRoutes.removeElementFromCollection,
            serviceMethod: withService((service, request) =>
                service.removeElementFromCollection(request.params.collectionId, request.body.kind, request.body.key, request.body.accountId, request.body.permanent),
            ),
            authentication: ApplicationToken,
            authorization: docEdit("collectionId")
        },
        changeElementPosition: {
            ...appRoutes.changeElementPosition,
            serviceMethod: withService((service, request) =>
                service.changeElementPosition(request.params.collectionId, request.body.kind, request.body.key, request.body.newPosition),
            ),
            authentication: ApplicationToken,
            authorization: docEdit("collectionId")
        },
        findCollections: {
            ...appRoutes.findCollections,
            serviceMethod: withService((service, request) =>
                service.findCollections(request.body.filter, request.body.options),
            ),
        },
        findCollectionsFromClient: {
            ...appRoutes.findCollectionsFromClient,
            serviceMethod: withService((service, request) =>
                service.findCollectionsFromClient(
                    request.body.filter,
                    request.body.options,
                    request.user ? request.user.userId : undefined
                )),
            authentication: ApplicationTokenOrPublic,
            authorization: Allow,
        },
        getCollection: {
            ...appRoutes.getCollection,
            serviceMethod: withService((service, request) =>
                service.getCollection(
                    request.params.collectionId,
                    {
                        inheritAncestorThumbnails: request.query?.inheritAncestorThumbnails === "true",
                        cdnifyThumbnails: request.query?.cdnifyThumbnails === "true"
                    },
                )),
            authentication: ApplicationTokenOrPublic,
            authorization: docRead("collectionId")
        },
        getCollectionInfo: {
            ...appRoutes.getCollectionInfo,
            serviceMethod: withService((service, request) =>
                service.getCollectionInfo(request.params.collectionId)
            ),
            authentication: ApplicationTokenOrPublic,
            authorization: docRead("collectionId")
        },
        getCollectionsElements: {
            ...appRoutes.getCollectionsElements,
            serviceMethod: withService((service, request) =>
                service.getCollectionsElements(request.body.colIds, request.body.recursive)
            ),
        },
        getChildCollectionSummaries: {
            ...appRoutes.getChildCollectionSummaries,
            serviceMethod: withService((service, request) =>
                service.getChildCollectionSummaries(request.body.collectionIds),
            ),
            authentication: ApplicationToken,
            authorization: AccountMember,
        },
        deleteBinder: {
            ...appRoutes.deleteBinder,
            serviceMethod: withService((service, request) => {
                const auditLogger: AuditLogFn = async (trackingClient) => {
                    if (!request.body.permanent) return;
                    await trackingClient.logAuditLog(
                        AuditLogType.ITEM_HARD_DELETED,
                        request.user.userId,
                        request.body.accountId,
                        request["headers"] && request["headers"]["user-agent"],
                        {
                            binderId: request.body.binderId
                        },
                        getClientIps(request)
                    )
                }

                return service.deleteBinder(
                    request.params.binderId,
                    request.body.accountId,
                    request.body.permanent,
                    request.user?.userId,
                    auditLogger
                );
            }),
            authentication: ApplicationToken,
            authorization: MultiAuthorizationAnd([
                maybeAuth(
                    (req) => !req.body.permanent,
                    docEdit("binderId"),
                ),
                maybeAuth(
                    (req) => !!req.body.permanent,
                    docAdmin("binderId")
                )
            ]),
        },
        getDocumentResourceDetails: {
            ...appRoutes.getDocumentResourceDetails,
            serviceMethod: withService((service, request) =>
                service.getDocumentResourceDetails(request.params.documentId)
            ),
            authentication: ApplicationTokenOrPublic,
            authorization: docRead("documentId")
        },
        getDocumentResourceDetailsArray: {
            ...appRoutes.getDocumentResourceDetailsArray,
            serviceMethod: withService((service, request) =>
                service.getDocumentResourceDetailsArray(request.body.documentIds)
            ),
        },
        findItems: {
            ...appRoutes.findItems,
            serviceMethod: withService((service, request) =>
                service.findItems(request.body.filter, request.body.options)
            ),
        },
        findItemsForReader: {
            ...appRoutes.findItemsForReader,
            serviceMethod: (request) => serviceFactory.forRequest(request)
                .findItemsForReader(
                    request.body.filter,
                    request.body.options,
                    request.body.accountId,
                    request?.user?.userId,
                ),
            authentication: ApplicationTokenOrPublic,
            authorization: Allow,
        },
        findItemsForEditor: {
            ...appRoutes.findItemsForEditor,
            serviceMethod: (request) => serviceFactory.forRequest(request)
                .findItemsForEditor(
                    request.body.filter,
                    request.body.options,
                    request.body.accountId,
                    request.user.userId,
                ),
            authentication: ApplicationToken,
            authorization: AccountsEditorMember(azClient, (req) => [req.body.accountId]),
        },
        getSoftDeletedItems: {
            ...appRoutes.getSoftDeletedItems,
            serviceMethod: withService((service, request) =>
                service.getSoftDeletedItems(
                    request.body.accountId,
                    request.body.options,
                    request.body.filter,
                    request.user ? request.user.userId : undefined,
                )
            ),
            authentication: ApplicationToken,
            authorization: Allow, //MultiAuthorization([BackendUser, docRead("scopeCollectionId")]),
        },
        findPublicationsAndCollections: {
            ...appRoutes.findPublicationsAndCollections,
            serviceMethod: withService((service, request) =>
                service.findPublicationsAndCollections(
                    request.body.filter,
                    request.body.options,
                    request.body.accountId,
                    request.user ? request.user.userId : undefined)
            ),
            authentication: ApplicationTokenOrPublic,
            authorization: Allow
        },
        getCollectionElementsWithInfo: {
            ...appRoutes.getCollectionElementsWithInfo,
            serviceMethod: withService((service, request) =>
                service.getCollectionElementsWithInfo(
                    request.body.collectionId,
                    request.body.domain,
                    request.body.options,
                )
            ),
            authentication: ApplicationTokenOrPublic,
            authorization: docRead("collectionId", true),
        },
        deleteCollection: {
            ...appRoutes.deleteCollection,
            serviceMethod: withService((service, request) =>
                service.deleteCollection(
                    request.params.collectionId,
                    request.body.accountId,
                    request.user?.userId
                )
            ),
            authentication: ApplicationToken,
            authorization: docEdit("collectionId"),
        },
        findReaderItemsWithInfo: {
            ...appRoutes.findReaderItemsWithInfo,
            serviceMethod: withService((service, request) =>
                service.findReaderItemsWithInfo(request.body.filter, request.body.options,
                    request.user ? request.user.userId : undefined)
            ),
            authentication: ApplicationTokenOrPublic,
            authorization: Allow
        },
        getRootCollections: {
            ...appRoutes.getRootCollections,
            serviceMethod: withService((service, request) =>
                service.getRootCollections(request.body.accountIds, request.user)
            ),
            authentication: ApplicationToken,
            authorization: Allow
        },
        countAllPublicDocuments: {
            ...appRoutes.countAllPublicDocuments,
            serviceMethod: withService((service, request) =>
                service.countAllPublicDocuments(request.params.accountId)
            ),
            authentication: ApplicationToken,
            authorization: AccountMemberP
        },
        getAncestors: {
            ...appRoutes.getAncestors,
            serviceMethod: withService((service, request) =>
                service.getAncestors(request.params.itemId)
            ),
            authentication: ApplicationTokenOrPublic,
            authorization: docRead("itemId")
        },
        getItemsAncestors: {
            ...appRoutes.getItemsAncestors,
            serviceMethod: withService((service, request) =>
                service.getItemsAncestors(request.body.itemIds)
            ),
            authentication: ApplicationTokenOrPublic,
            authorization: Allow,
        },
        translate: {
            ...appRoutes.translate,
            serviceMethod: withService(async (service, request) =>
                service.translate(
                    request.body.accountId,
                    request.body.html,
                    request.body.sourceLanguageCode,
                    request.body.targetLanguageCode,
                    request.body.isHtml,
                    (await extractInterfaceLanguageFromRequest(request, { accountId: request.body.accountId })),
                )
            ),
            authentication: ApplicationTokenOrPublic,
            authorization: Allow
        },
        getTranslationsAvailable: {
            ...appRoutes.getTranslationsAvailable,
            serviceMethod: withService((service, request) =>
                service.getTranslationsAvailable(request.body.skipCache)
            ),
            authentication: ApplicationTokenOrPublic,
            authorization: Allow
        },
        getSupportedLanguagesByEngine: {
            ...appRoutes.getSupportedLanguagesByEngine,
            serviceMethod: withService((service, request) =>
                service.getSupportedLanguagesByEngine(request.body.skipCache)
            ),
            authentication: ApplicationToken,
            authorization: Allow
        },
        detectLanguage: {
            ...appRoutes.detectLanguage,
            serviceMethod: withService((service, request) =>
                service.detectLanguage(request.body.html)
            ),
            authentication: ApplicationTokenOrPublic,
            authorization: Allow
        },
        getAccountTotals: {
            ...appRoutes.getAccountTotals,
            serviceMethod: withService((service, request) =>
                service.getAccountTotals(request.params.accountId)
            ),
        },
        getMostUsedLanguages: {
            ...appRoutes.getMostUsedLanguages,
            serviceMethod: withService((service, request) =>
                service.getMostUsedLanguages(request.body.accountIds)
            ),
            authentication: ApplicationToken,
            authorization: AccountsMember
        },
        createOrUpdateFeedback: {
            ...appRoutes.createOrUpdateFeedback,
            serviceMethod: withService((service, req) => {
                return service.createOrUpdateFeedback(
                    req.query.accountId.toString(),
                    req.params.publicationId,
                    req.body.feedbackParams,
                    req.user?.userId,
                )
            }),
            authentication: ApplicationTokenOrPublic,
            authorization: canLeaveFeedback,
        },
        getMostRecentPublicationUserFeedback: {
            ...appRoutes.getMostRecentPublicationUserFeedback,
            serviceMethod: withService((service, req) => {
                return service.getMostRecentPublicationUserFeedback(
                    req.params.publicationId,
                    req.user?.userId,
                )
            }),
            authentication: ApplicationToken,
            authorization: asDeviceUserIfAvailable(publicationRead("publicationId")),
        },
        getBinderFeedbacks: {
            ...appRoutes.getBinderFeedbacks,
            serviceMethod: withService((service, req) => {
                return service.getBinderFeedbacks(
                    req.params.binderId,
                )
            }),
            authentication: ApplicationToken,
            authorization: docEdit("binderId"),
        },
        exportBinderFeedbacks: {
            ...appRoutes.exportBinderFeedbacks,
            serviceMethod: withService((service, req) =>
                service.exportBinderFeedbacks(req.params.binderId)),
            csvFormattingOrder: ["Id", "BinderId", "PublicationId", "Message", "Rating", "UserLogin", "UserName", "CreatedDate", "UpdatedDate"],
            authentication: ApplicationToken,
            authorization: docEdit("binderId"),
        },
        updateChunkApprovals: {
            ...appRoutes.updateChunkApprovals,
            serviceMethod: withService((service, req) =>
                service.updateChunkApprovals(
                    req.body.binderId,
                    req.body.filter,
                    req.body.approvalStatus,
                    req.user.userId,
                    logAuditLogForChunkApprovals(req),
                )
            ),
            authentication: ApplicationToken,
            authorization: MultiAuthorizationOr(
                [
                    docAdmin("binderId", "body"),
                    docReviewApprove("binderId"),
                    docTranslate("binderId", (req) => req.body["filter"]["chunkLanguageCodes"], true),
                    docEditResetApproval,
                ]
            ),
        },
        approveChunk: {
            ...appRoutes.approveChunk,
            serviceMethod: withService((service, req) =>
                service.approveChunk(
                    req.body.binderId,
                    req.body.chunkId,
                    req.body.chunkLastUpdate,
                    req.body.languageCode,
                    req.body.approval,
                    req.user.userId,
                    logAuditLogForChunkApprovals(req),
                )
            ),
            authentication: ApplicationTokenOrPublic,
            authorization: MultiAuthorization(
                [
                    docAdmin("binderId", "body"),
                    docReviewApprove("binderId"),
                    docTranslate("binderId", (req): string[] => req.body["languageCode"] ? [req.body["languageCode"]] : [], true),
                    docEditResetApproval,
                ]
            ),
        },
        fetchApprovalsForBinder: {
            ...appRoutes.fetchApprovalsForBinder,
            serviceMethod: withService((service, req) =>
                service.fetchApprovalsForBinder(
                    req.params.binderId,
                )
            ),
            authentication: ApplicationTokenOrPublic,
            authorization: docEdit("binderId"),
        },
        saveChecklistActivation: {
            ...appRoutes.saveChecklistActivation,
            serviceMethod: withService((service, req) =>
                service.saveChecklistActivation(
                    req.body.binderId,
                    req.body.chunkId,
                    req.body.isActive,
                    req.user?.userId
                )
            ),
            authentication: ApplicationToken,
            authorization: docEdit("binderId", true),
        },
        getChecklistConfigs: {
            ...appRoutes.getChecklistConfigs,
            serviceMethod: withService((service, req) =>
                service.getChecklistConfigs(req.params.binderId)
            ),
            authentication: ApplicationToken,
            authorization: docEdit("binderId"),
        },
        getMultiChecklistConfigs: {
            ...appRoutes.getMultiChecklistConfigs,
            serviceMethod: withService((service, req) =>
                service.getMultiChecklistConfigs(req.body.binderIds)
            ),
            authentication: ApplicationToken,
            authorization: MultiDocumentEdit(azClient, "binderIds")
        },
        getChecklists: {
            ...appRoutes.getChecklists,
            serviceMethod: withService((service, req) =>
                service.getChecklists(req.params.binderId)
            ),
            authentication: ApplicationToken,
            authorization: docRead("binderId"),
        },
        togglePerformed: {
            ...appRoutes.togglePerformed,
            serviceMethod: withService((service, req) =>
                service.togglePerformed(
                    req.body.id,
                    req.body.performed,
                    req.params.binderId,
                    req.body.publicationId,
                    req.user && req.user.userId
                )
            ),
            authentication: ApplicationToken,
            authorization: docRead("binderId"),
        },
        getChecklistsProgress: {
            ...appRoutes.getChecklistsProgress,
            serviceMethod: withService((service, req) =>
                service.getChecklistsProgress(req.body.binderIds)
            ),
            authentication: ApplicationToken,
            authorization: MultiDocumentView(azClient, "binderIds")
        },
        getChecklistsActions: {
            ...appRoutes.getChecklistsActions,
            serviceMethod: withService((service, req) =>
                service.getChecklistsActions(req.body.binderOrCollectionIds)
            ),
            authentication: ApplicationToken,
            authorization: MultiDocumentEdit(azClient, "binderOrCollectionIds")
        },
        invalidatePublicItemsForAccount: {
            ...appRoutes.invalidatePublicItemsForAccount,
            serviceMethod: withService((service, request) =>
                service.invalidatePublicItemsForAccount(request.body.accountId)
            ),
        },
        getAccountAncestorTree: {
            ...appRoutes.getAccountAncestorTree,
            serviceMethod: withService((service, request) =>
                service.getAccountAncestorTree(request.params.accountId, request.user)
            ),
        },
        getLanguageCodesUsedInCollection: {
            ...appRoutes.getLanguageCodesUsedInCollection,
            serviceMethod: withService((service, req) =>
                service.getLanguageCodesUsedInCollection(req.params.collectionId, req.body.shouldAddPublicationPossibilities)
            ),
            authentication: ApplicationToken,
            authorization: docPublish("collectionId"),
        },
        recursivePublish: {
            ...appRoutes.recursivePublish,
            serviceMethod: withService((service, req) => {
                return service.recursivePublish(
                    req.params.collectionId,
                    req.body.languages,
                    req.body.accountId,
                    req.user.userId,
                    req.user.isBackend,
                    logAuditLogForPublishUpdate(req)
                )
            }),
            authentication: ApplicationToken,
            authorization: docPublish("collectionId")
        },
        recursiveUnpublish: {
            ...appRoutes.recursiveUnpublish,
            serviceMethod: withService((service, req) =>
                service.recursiveUnpublish(
                    req.params.collectionId,
                    req.body.languageCodes,
                    req.body.accountId,
                    req.user.userId,
                    logAuditLogForPublishUpdate(req)
                )
            ),
            authentication: ApplicationToken,
            authorization: docPublish("collectionId"),
        },
        recursiveDelete: {
            ...appRoutes.recursiveDelete,
            serviceMethod: withService((service, req) =>
                service.recursiveDelete(
                    req.params.collectionId,
                    req.body.accountId,
                    req.body.parentCollectionId,
                    req.user.userId,
                )
            ),
            authentication: ApplicationToken,
            authorization: docPublish("collectionId"),

        },
        recursiveTranslate: {
            ...appRoutes.recursiveTranslate,
            serviceMethod: withService((service, req) =>
                service.recursiveTranslate(
                    req.params.collectionId,
                    req.body.targetLanguageCode,
                    req.body.accountId,
                    req.user.userId,
                )
            ),
            authentication: ApplicationToken,
            authorization: docPublish("collectionId")
        },
        validateRecursiveAction: {
            ...appRoutes.validateRecursiveAction,
            serviceMethod: withService((service, req) =>
                service.validateRecursiveAction(req.params.collectionId, req.body.operation)
            ),
            authentication: ApplicationToken,
            authorization: docPublish("collectionId")
        },
        getCustomerMetricsCsv: {
            ...appRoutes.getCustomerMetricsCsv,
            serviceMethod: withService((service) =>
                service.getCustomerMetricsCsv()
            ),
            authentication: (request) => buildUserTokenAuthentication(accountClient)(request),
            authorization: BindersMediaAdmin(azClient, UserIdFromUserToken, accountClient),
        },
        getSingleCustomerMetricsCsv: {
            ...appRoutes.getSingleCustomerMetricsCsv,
            serviceMethod: withService((service, req) =>
                service.getSingleCustomerMetricsCsv(req.query.accountId as string)
            ),
            authentication: (request) => buildUserTokenAuthentication(accountClient)(request),
            authorization: AccountAdminToken(azClient, accountClient),
        },
        generateTextToSpeech: {
            ...appRoutes.generateTextToSpeech,
            serviceMethod: withService((service, req) =>
                service.generateTextToSpeech(
                    req.body.paragraphs,
                    req.body.voiceOptions
                )
            ),
            authentication: Public,
            authorization: Allow
        },
        fetchTextToSpeechFile: {
            ...appRoutes.fetchTextToSpeechFile,
            serviceHandler: async (req, res) => (
                await serviceFactory
                    .forRequest(req)
                    .fetchTextToSpeechFile(
                        req.params.identifier,
                        res
                    )
            ),
            authentication: Public,
            authorization: Allow
        },
        listAvailableTTSLanguages: {
            ...appRoutes.listAvailableTTSLanguages,
            serviceMethod: withService((service) =>
                service.listAvailableTTSLanguages()
            ),
            authentication: Public,
            authorization: Allow
        },
        recoverDeletedItem: {
            ...appRoutes.recoverDeletedItem,
            serviceMethod: withService((service, req) =>
                service.recoverDeletedItem(
                    req.body.itemId,
                    req.body.accountId,
                    req.body.newParentCollectionId
                )
            ),
            authentication: ApplicationToken,
            authorization: MultiAuthorization([
                docEdit("itemId", true),
                docEdit("newParentCollectionId", true)
            ], true)
        },
        purgeRecycleBins: {
            ...appRoutes.purgeRecycleBins,
            serviceMethod: withService((service) => service.purgeRecycleBins()),
        },
        relabelBinderLanguage: {
            ...appRoutes.relabelBinderLanguage,
            serviceMethod: withService((service, req) =>
                service.relabelBinderLanguage(
                    req.body.accountId,
                    req.body.binderId,
                    req.body.fromLanguageCode,
                    req.body.toLanguageCode,
                    req.user.userId,
                )
            ),
            authentication: ApplicationToken,
            authorization: docEdit("binderId", true),
        },
        deleteAllForAccount: {
            ...appRoutes.deleteAllForAccount,
            serviceMethod: withService((service, req) =>
                service.deleteAllForAccount(req.params.accountId)
            ),
        },
        requestReview: {
            ...appRoutes.requestReview,
            serviceMethod: withService((service, req) =>
                service.requestReview(
                    req.body.accountId,
                    req.body.binderId,
                    req.user?.userId
                )
            ),
            authentication: ApplicationToken,
            authorization: docEdit("binderId", true)
        },
        getDescendantsMap: {
            ...appRoutes.getDescendantsMap,
            serviceMethod: withService((service, req) =>
                service.getDescendantsMap(
                    req.params.collectionId,
                )
            ),
        },
        findBindersStatuses: {
            ...appRoutes.findBindersStatuses,
            serviceMethod: withService((service, req) =>
                service.findBindersStatuses(
                    req.body.accountId,
                    req.body?.options ?? {} as FindBindersStatusesQueryParams,
                    req.user.userId,
                )
            ),
            authentication: ApplicationToken,
            authorization: AccountMember
        },
        calculateBindersStatuses: {
            ...appRoutes.calculateBindersStatuses,
            serviceMethod: withService((service, req) =>
                service.calculateBindersStatuses(
                    req.params.accountId,
                )
            ),
        },
        summarizePublicationsForAccount: {
            ...appRoutes.summarizePublicationsForAccount,
            serviceMethod: async (req) => {
                if (!req?.user?.isBackend) {
                    await requireLaunchDarklyFlagEnabled(launchDarklyService, LDFlags.ACCOUNT_ADMINS_CAN_GENERATE_ACCOUNT_REPORTS, req.logger);
                }
                return serviceFactory.forRequest(req).summarizePublicationsForAccount(req.params.accountId);
            },
            csvFormattingOrder: ["DocumentId", "Title", "Language", /^((?!(ParentTitle)).)*$/i, /ParentTitle[0-9]+/i],
            authentication: ApplicationToken,
            authorization: AccountAdminParams(azClient)
        },
        summarizeDraftsForAccount: {
            ...appRoutes.summarizeDraftsForAccount,
            serviceMethod: async (req) => {
                if (!req?.user?.isBackend) {
                    await requireLaunchDarklyFlagEnabled(launchDarklyService, LDFlags.ACCOUNT_ADMINS_CAN_GENERATE_ACCOUNT_REPORTS, req.logger);
                }
                return serviceFactory.forRequest(req).summarizeDraftsForAccount(req.params.accountId);
            },
            csvFormattingOrder: ["DocumentId", "Title", "Language", /^((?!(ParentTitle)).)*$/i, /ParentTitle[0-9]+/i],
            authentication: ApplicationToken,
            authorization: AccountAdminParams(azClient)
        },
        getOwnershipForItems: {
            ...appRoutes.getOwnershipForItems,
            serviceMethod: withService((service, req) =>
                service.getOwnershipForItems(req.body.itemIds, req.body.accountId, req.body.expandGroups === "true", req?.user?.userId)),
            authentication: ApplicationToken,
            authorization: multiDocRead("itemIds")
        },
        setOwnershipForItem: {
            ...appRoutes.setOwnershipForItem,
            serviceMethod: withService(async (service, req) => {
                const result = await service.setOwnershipForItem(req.body.itemId, req.body.ownership, req.body.accountId);
                trackingClient.logAuditLog(
                    AuditLogType.ITEM_OWNERSHIP_CHANGED,
                    req.user && req.user.userId,
                    req.body.accountId,
                    req["headers"] && req["headers"]["user-agent"],
                    {
                        itemId: req.body.itemId,
                        ownership: req.body.ownership,
                    },
                    getClientIps(req),
                );
                return result;
            }),
            authentication: ApplicationToken,
            authorization: docEdit("itemId", true)
        },
        removeOwnerIdFromItemOwnershipForAccount: {
            ...appRoutes.removeOwnerIdFromItemOwnershipForAccount,
            serviceMethod: withService((service, req) =>
                service.removeOwnerIdFromItemOwnershipForAccount(req.body.ownerId, req.body.accountId)),
        },
        getItemAndAncestorsReaderFeedbackConfigs: {
            ...appRoutes.getItemAndAncestorsReaderFeedbackConfigs,
            serviceMethod: (req) => serviceFactory.forRequest(req)
                .getItemAndAncestorsReaderFeedbackConfigs(req.body.itemId, req.user.userId),
            authentication: ApplicationToken,
            authorization: docAdmin("itemId", "body"),
        },
        getReaderFeedbackConfigForItems: {
            ...appRoutes.getReaderFeedbackConfigForItems,
            serviceMethod: (req) => serviceFactory.forRequest(req)
                .getReaderFeedbackConfigForItems(req.body.itemIds),
            authentication: ApplicationToken,
            authorization: multiDocAdmin("itemIds"),
        },
        updateReaderFeedbackConfig: {
            ...appRoutes.updateReaderFeedbackConfig,
            serviceMethod: (req) => serviceFactory.forRequest(req)
                .updateReaderFeedbackConfig(req.body.itemId, req.body.config),
            authentication: ApplicationToken,
            authorization: docAdmin("itemId", "body"),
        },
        getFeedbacks: {
            ...appRoutes.getFeedbacks,
            serviceMethod: withService(
                (service, request) => {
                    const feedbackFilter = request.body.feedbackFilter;
                    return service.getFeedbacks(feedbackFilter);
                }
            ),
        },
        getReaderItemContext: {
            ...appRoutes.getReaderItemContext,
            serviceMethod: withService(
                (service, request) => {
                    return service.getReaderItemContext(
                        request.body.itemId,
                        request.query.accountId as string,
                        request.body.options,
                        request.user?.userId,
                    );
                }
            ),
            authentication: ApplicationTokenOrPublic,
            authorization: docRead("itemId", true),
        },
        clearLastModifiedInfo: {
            ...appRoutes.clearLastModifiedInfo,
            serviceMethod: withService(
                (service, request) => {
                    return service.clearLastModifiedInfo(
                        request.body.accountId,
                        request.body.binderIds
                    );
                }
            ),
        },
        updateChunkVisualSettings: {
            ...appRoutes.updateChunkVisualSettings,
            serviceMethod: withService(
                (service, request) => {
                    return service.updateChunkVisualSettings(
                        request.body.binderId,
                        request.body.chunkIdx,
                        request.body.visualIdx,
                        request.body.visualSettings,
                    );
                }
            ),
            authentication: ApplicationToken,
            authorization: docEdit("binderId", true)
        },
        getUserActivities: {
            ...appRoutes.getUserActivities,
            serviceMethod: withService(
                async (service, request) => {
                    const accountId = request.body.accountId;
                    const languageCode = await extractInterfaceLanguageFromRequest(request, { accountId });
                    return service.getUserActivities(accountId, request.user?.userId, languageCode);
                }
            ),
            authentication: ApplicationToken,
            authorization: Allow,
        },
        restoreElasticDoc: {
            ...appRoutes.restoreElasticDoc,
            serviceMethod: withService(
                (service, request) => {
                    const indexName = request.body.indexName;
                    const documentId = request.body.documentId;
                    const document = request.body.document;
                    return service.restoreElasticDoc(indexName, documentId, document);
                }
            ),
        }
    };

}
