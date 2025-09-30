import {
    AccountServiceContract,
    FEATURE_APPROVAL_FLOW,
    FEATURE_CHECKLISTS,
    FEATURE_COLLECTION_HIDE,
    FEATURE_DOCUMENT_OWNER,
    FEATURE_DUPLICATE_ACLS
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    AccountTotals,
    ApprovedStatus,
    AuditLogFn,
    AuditLogUpdateApprovalFn,
    Binder,
    BinderApprovalStatus,
    BinderFilter,
    BinderFindResult,
    BinderModules,
    BinderOrDocumentCollection,
    BinderSearchResultOptions,
    BinderStatus,
    BinderStatusForAccount,
    BindersRepositoryServiceContract,
    ChunkApprovalFilter,
    CollectionElement,
    CollectionElementsWithInfoOptions,
    CollectionFilter,
    ContentChunkKind,
    DEFAULT_OWNERSHIP,
    DetailedItemOwnership,
    DocumentAncestors,
    DocumentCollection,
    DocumentResourceDetails,
    DraftSummaryItem,
    EditorItemSearchResult,
    ExportedBinderFeedback,
    FIND_BINDERS_STATUSES_MAX_ALLOWED_RESULTS,
    FeedbackFilter,
    FeedbackParams,
    FindBindersStatusesQueryParams,
    GetReaderItemContextOptions,
    IAzureTranslation,
    IBinderFeedback,
    IChecklist,
    IChecklistAction,
    IChecklistConfig,
    IChecklistProgress,
    IChunkApproval,
    ICollectionElementsWithInfo,
    ICollectionInfo,
    ICollectionSummary,
    IDescendantsMap,
    IDuplicationResult,
    IGetCollectionQueryOptions,
    IItemSearchOptions,
    IMultiSearchOptions,
    ITTSGenerateResponse,
    ITTSVoiceOptions,
    IThumbnail,
    InheritedOwnershipSettingsItem,
    ItemConfigAccessType,
    ItemFilter,
    ItemFilterFunction,
    ItemKind,
    ItemOwnership,
    LanguageSummary,
    MAXIMUM_NUMBER_OF_ITEMS,
    Owner,
    Ownership,
    Publication,
    PublicationFilter,
    PublicationFindResult,
    PublicationSummary,
    PublicationsSummaryItem,
    ReaderFeedbackConfig,
    ReaderFeedbackConfigs,
    ReaderItemContext,
    ReaderItemSearchResult,
    ReaderItemsFilter,
    RecursiveAction,
    RecursiveDeleteSummaryResult,
    RecursiveErrors,
    RecursiveOpeartionResult,
    RecursiveOperationError,
    RecursiveUnpublishSummaryResult,
    RelabelResult,
    SoftDeletedItemsFilter,
    Story,
    UserActivities,
    UserActivity,
    ValidationResult,
    VisualSettings,
    isOverriddenOwnership
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    AncestorBuilder,
    CachingAncestorBuilder,
    ElasticAncestorBuilder,
    PrefetchingAncestorBuilder
} from "./ancestors/ancestorBuilder";
import {
    AncestorTree,
    buildAncestorsList,
    hasAtLeastOneVisibleParentPath
} from "@binders/client/lib/ancestors";
import {
    AssigneeGroup,
    AssigneeType,
    AuthorizationServiceContract,
    PermissionName,
    ResourceGroup,
    ResourceType
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import {
    AuditLogType,
    EventPayload,
    EventType,
    IUserAction,
    IUserActionPublishData,
    PublishUpdateActionType,
    TrackingServiceContract,
    UserActionType
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import {
    AuthenticatedSession,
    DocumentType,
    Unauthorized
} from "@binders/client/lib/clients/model";
import {
    BackendAccountServiceClient,
    BackendCommentServiceClient,
    BackendImageServiceClient,
    BackendNotificationServiceClient,
    BackendRoutingServiceClient,
    BackendTrackingServiceClient,
    BackendUserServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import {
    BinderFeedbackModel,
    FeedbackRepositoryFactory,
    IFeedbackRepository
} from "./repositories/feedbackrepository";
import {
    BinderHasPublicationError,
    CircularPathError,
    CogtnitiveAPITimeout,
    CollectionNotEmpty,
    InvalidBinder,
    InvalidParam,
    InvalidPublication,
    InvalidRecursiveActionOpeartion,
    ItemInstanceAlreadyInCollectionError,
    MasterLanguageNotSet,
    MissingApprovals,
    MissingLanguage,
    MissingTitle,
    NonExistingDomainFilter,
    NonExistingItem,
    NothingToPublish,
    UnsupportedLanguageError,
    WillNotOrphan
} from "./model";
import {
    BinderStatusCacheRepository,
    BinderStatusCacheRepositoryFactory
} from "./repositories/binderStatusCacheRepository";
import { BindersRepository, ElasticBindersRepository } from "./repositories/binderrepository";
import {
    ChecklistAlreadyInThatStateError,
    NothingToUnpublish
} from "@binders/client/lib/clients/repositoryservice/v3/errors";
import {
    ChecklistConfigRepositoryFactory,
    IChecklistsConfigRepository
} from "./repositories/checklistconfigrepository";
import {
    ChecklistsRepositoryFactory,
    IChecklistsRepository
} from "./repositories/checklistsrepository";
import {
    ChunkApprovalRepositoryFactory,
    IChunkApprovalRepository
} from "./repositories/approvalrepository";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import {
    CollectionInvalidateEvent,
    DocumentInvalidateEvent
} from "@binders/binders-service-common/lib/cache/invalidating/invalidateevents";
import {
    CollectionRepository,
    ElasticCollectionsRepository
} from "./repositories/collectionrepository";
import {
    CommentThreadsRepositoryFactory,
    ICommentThreadsRepository
} from "../commentservice/repositories/commentthreads";
import {
    DATE_CHANGED_MARKER,
    DEFAULT_COVER_IMAGE,
    createDefaultCoverThumbnail
} from "@binders/client/lib/binders/defaults";
import { DefaultESQueryBuilderHelper, ESQueryBuilderHelper } from "./esquery/helper";
import {
    DomainFilter,
    ISemanticLinkRequest,
    RoutingServiceContract
} from "@binders/client/lib/clients/routingservice/v1/contract";
import { ElasticMultiRepository, MultiRepository } from "./repositories/multirepository";
import {
    ElasticPublicationsRepository,
    PublicationFindOptions,
    PublicationRepository
} from "./repositories/publicationrepository";
import {
    IItemsTransformerOptions,
    ItemsTransformer,
    multiTransformItems
} from "@binders/binders-service-common/lib/itemstransformers";
import { IOperationLog, OperationLogServiceFactory } from "./operation-log";
import {
    IReaderFeedbackConfigRepository,
    ReaderFeedbackConfigRepositoryFactory
} from "./repositories/readerFeedbackConfigRepository";
import {
    IRedirectionPolicy,
    ItemLock,
    ItemRelease,
    NotificationKind,
    NotificationServiceContract,
    PublishNotification,
    ReviewRequestNotification,
    RoutingKeyType,
    ServiceNotificationType
} from "@binders/client/lib/clients/notificationservice/v1/contract";
import { ISearchService, SearchService } from "./search";
import { ITTSRepository, TTSRepositoryFactory } from "./repositories/ttsrepository";
import { ITrashService, SoftDeletedItemsSearchResult, TrashService } from "./trash";
import InheritedThumbnailTransformer, {
    InheritedThumbnailTransformerOptions
} from "./itemstransformers/InheritedThumbnails";
import { Item, filterItemIdsByPermission } from "./repositoryfilters";
import { JWTSignConfig, buildSignConfig } from "@binders/binders-service-common/lib/tokens/jwt";
import { Logger, LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { RedisClient, RedisClientBuilder } from "@binders/binders-service-common/lib/redis/client";
import {
    ServerEvent,
    captureServerEvent
} from "@binders/binders-service-common/lib/tracking/capture";
import { SortOrder, dateSorterDesc, sortByDate } from "@binders/client/lib/util/date";
import {
    UpdatePatchFn,
    addMissingLanguage,
    translateChunks,
    translateCollectionTitle,
    translateTitle
} from "./recursive-actions/translate";
import {
    User,
    UserServiceContract,
    Usergroup
} from "@binders/client/lib/clients/userservice/v1/contract";
import {
    addCollectionElement,
    changeCollectionElementPosition,
    removeCollectionElement,
    removeCollectionTitle as removeTitle,
    setTitle,
    updateIsHidden,
    updateLanguageTitle,
    updateOwnership,
    updateShowInOverview,
    updateThumbnail
} from "./patching/collections";
import {
    any,
    assoc,
    flatten,
    groupBy,
    intersection,
    omit,
    partition,
    sum,
    uniq,
    uniqBy,
    without
} from "ramda";
import {
    appendFeedbackChunk,
    appendMadeByManualToChunk,
    appendReadConfirmationChunk,
    prependTitleChunk
} from "./helper";
import {
    applyBatchItemFilters,
    chunkIdFromIndex,
    countBinderChunks,
    extractTitle,
    extractTitleForLanguage,
    getAllParentsFromDocumentAncestors,
    getBinderIdFromItem,
    getBinderLastModifiedDate,
    sortLanguagesUsed,
    toBinderStories
} from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import {
    create as createBinder,
    curriedMultiUpdate
} from "@binders/client/lib/binders/custom/class";
import {
    deserializeEditorStatesForTranslate,
    serializeEditorStates
} from "@binders/client/lib/draftjs/helpers";
import {
    getBinderMasterLanguage,
    getBinderTitleMap,
    idsFromDescendantsMap,
    toOriginalSortOrder
} from "./util";
import { getUserName, isUsergroup } from "@binders/client/lib/clients/userservice/v1/helpers";
import hasDraft, { hasDraftInSummaries } from "@binders/client/lib/util/hasDraft";
import { isBefore, isDate } from "date-fns";
import {
    isBinder,
    isCollectionItem,
    isDocumentCollection,
    isPublicationItem,
    validateBinder,
    validatePublication
} from "@binders/client/lib/clients/repositoryservice/v3/validation";
import {
    isNoReaderFeedbackFeatureEnabled,
    resolveReaderFeedbackConfig
} from "./readerfeedback/resolve";
import { normalizeChunkCount, removeEmptyLastChunks } from "./patching/binder";
import {
    relabelPublicationLanguage,
    setMasterLanguage,
    setPriorityForPublication
} from "./patching/publications";
import {
    BackendAuthorizationServiceClient
} from "@binders/binders-service-common/lib/authorization/backendclient";
import BinderHtmlSanitizer from "./BinderHtmlSanitizer";
import { BinderOperations } from "../contentservice/internal/BinderOperations";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { CommentServiceContract } from "@binders/client/lib/clients/commentservice/v1/contract";
import { CommentThread } from "../commentservice/repositories/models/commentThread";
import { Config } from "@binders/client/lib/config/config";
import { ES_MAX_RESULTS } from "./const";
import {
    FEEDBACK_COUNTER_LABEL
} from "@binders/binders-service-common/lib/monitoring/prometheus/htmlSanitizing";
import HasPublicationsResolver from "./publicationflags";
import HtmlSanitizer from "@binders/binders-service-common/lib/html/sanitizer";
import { IObjectStorage } from "@binders/binders-service-common/lib/storage/object_storage";
import ImageFormatsTransformer from "@binders/binders-service-common/lib/itemstransformers/ImageFormats";
import { ImageServiceContract } from "@binders/client/lib/clients/imageservice/v1/contract";
import { InvalidOperation } from "@binders/client/lib/util/errors";
import { InvalidatorManager } from "@binders/binders-service-common/lib/cache";
import { ItemsTransformersFactory } from "./itemstransformers/factory";
import LastEditedUsernameTransformer from "./itemstransformers/lastEditedUsername";
import LaunchDarklyService from "@binders/binders-service-common/lib/launchdarkly/server";
import { Maybe } from "@binders/client/lib/monad";
import { MostUsedLanguagesCache } from "./cache/mostUsedLanguagesCache";
import {
    ObjectStorageFactory
} from "@binders/binders-service-common/lib/storage/object_storage_factory";
import ProvideImageStatusTransformer from "@binders/binders-service-common/lib/itemstransformers/ProvideImageStatus";
import { PublicItemsCache } from "./cache/publicItemsCache";
import { PublicationNotFound } from "@binders/client/lib/clients/publicapiservice/v1/contract";
import { RecursiveActionValidator } from "./recursive-actions/validator";
import { Response } from "express";
import { TTSMeta } from "./repositories/models/ttsmeta";
import { TextToSpeech } from "@binders/binders-service-common/lib/tts/text_to_speech";
import Translator from "./translation/translator";
import { UNDEFINED_LANG } from "@binders/client/lib/util/languages";
import UUID from "@binders/client/lib/util/uuid";
import { UrlToken } from "@binders/binders-service-common/lib/tokens";
import { buildAncestorTree } from "./ancestors/documenttree";
import buildCustomerMetrics from "./customerMetrics";
import { deduplicateChunkIds } from "@binders/client/lib/binders/deduplicatechunkids";
import { deduplicateTextModuleKeys } from "./patching/deduplicatetextmodulekeys";
import { elementsToItems } from "./repositories/operations";
import { flattenDescendants } from "./recursive-actions/helper";
import getAppRoutes from "@binders/client/lib/clients/repositoryservice/v3/routes";
import { getEditorLocationForAccount } from "@binders/binders-service-common/lib/util/url";
import { getExistingPublicationFilter } from "./repositories/helpers";
import { getUniqueAncestorsArray } from "./ancestors/helpers";
import { isBackendSession } from "@binders/binders-service-common/lib/middleware/authentication";
import { isProduction } from "@binders/client/lib/util/environment";
import { isVideoId } from "@binders/client/lib/clients/imageservice/v1/visuals";
import slugify from "@binders/client/lib/util/slugify";

const DAYS_BEFORE_BIN_PURGE = 180;
const MS_BEFORE_BIN_PURGE = 1000 * 3600 * 24 * DAYS_BEFORE_BIN_PURGE;

const processId = UUID.random().toString();

export interface ReadScope {
    scope: string;
    domain: string;
}

type AncestorInfo = {
    id: string,
    title: string,
    ownerIds: string[]
};

export class BindersRepositoryService implements BindersRepositoryServiceContract {
    private trashService: ITrashService;
    private readonly invalidator: InvalidatorManager;

    constructor(
        private readonly bindersRepository: BindersRepository,
        private readonly publicationRepository: PublicationRepository,
        private readonly collectionRepository: CollectionRepository,
        private readonly multiRepository: MultiRepository,
        private readonly commentThreadsRepository: ICommentThreadsRepository,
        private readonly ancestorBuilder: AncestorBuilder,
        private readonly authorizationContract: AuthorizationServiceContract,
        private readonly routingServiceContract: RoutingServiceContract,
        private readonly trackingServiceContract: TrackingServiceContract,
        private readonly imageServiceContract: ImageServiceContract,
        private readonly accountServiceContract: AccountServiceContract,
        private readonly userServiceContract: UserServiceContract,
        private readonly notificationServiceClient: NotificationServiceContract,
        private readonly jwtConfig: JWTSignConfig,
        private readonly logger: Logger,
        private readonly translator: Translator,
        private readonly imageServiceHost: string,
        private readonly approvalRepository: IChunkApprovalRepository,
        private readonly checklistRepository: IChecklistsRepository,
        private readonly checklistConfigRepository: IChecklistsConfigRepository,
        private readonly feedbackRepository: IFeedbackRepository,
        private readonly publicItemsCache: PublicItemsCache,
        private readonly mostUsedLanguagesCache: MostUsedLanguagesCache,
        private readonly recursiveActionsValidator: RecursiveActionValidator,
        private readonly searchService: ISearchService,
        getTrashService: (bindersRepositoryContract: BindersRepositoryServiceContract) => ITrashService,
        private readonly audioStorage: IObjectStorage,
        private readonly textToSpeech: TextToSpeech,
        private readonly ttsRepository: ITTSRepository,
        private readonly readerFeedbackConfigRepository: IReaderFeedbackConfigRepository,
        private readonly binderStatusCacheRepository: BinderStatusCacheRepository,
        private readonly itemsTransformersFactory: ItemsTransformersFactory,
        private readonly commentServiceContract: CommentServiceContract,
        redisClient?: RedisClient,
    ) {
        this.trashService = getTrashService(this);
        this.invalidator = new InvalidatorManager(redisClient);
    }

    buildImageFormatTransformer(options?: IItemsTransformerOptions): ImageFormatsTransformer {
        return new ImageFormatsTransformer(this.imageServiceContract, this.jwtConfig, options);
    }

    buildLastEditedUsernameTransformer(): LastEditedUsernameTransformer {
        return new LastEditedUsernameTransformer(this.userServiceContract);
    }

    buildProvideImageStatusTransformer(binderId: string): ProvideImageStatusTransformer {
        return new ProvideImageStatusTransformer(this.imageServiceContract, { binderId });
    }

    buildInheritedThumbnailTransformer(options?: InheritedThumbnailTransformerOptions): InheritedThumbnailTransformer {
        return new InheritedThumbnailTransformer(
            options?.ancestorBuilder || this.ancestorBuilder,
            this.collectionRepository,
            this.jwtConfig,
            this.multiRepository,
            options
        );
    }

    private async countPublishedBinders(binderIds: string[]) {
        const filter: PublicationFilter = {
            binderIds,
            isActive: 1
        };
        const options = {
            maxResults: ES_MAX_RESULTS,
            summary: true
        }
        const publications = await this.findPublicationsBackend(filter, options);
        let publishedBinderIds = new Set<string>();
        for (const publication of publications) {
            publishedBinderIds = publishedBinderIds.add(publication.binderId);
        }
        return publishedBinderIds.size;
    }

    async countAllActivePublications(itemIds: string[]): Promise<number> {
        const processed = new Set<string>();
        const getItems = async (ids: string[]) => {
            if (ids.length === 0) {
                return []
            }
            return this.findItems({ binderIds: ids }, { maxResults: ES_MAX_RESULTS });
        }
        const countPublishedBinders = async (ids: string[]) => {
            const toFetch = ids.filter(id => !processed.has(id));
            const count = await this.countPublishedBinders(toFetch);
            for (const processedId of ids) {
                processed.add(processedId);
            }
            return count;
        }
        const processItems = async (ids: string[]) => {
            const items = await getItems(ids);
            let count = 0;
            const collections = items.filter(i => (i as DocumentCollection).elements !== undefined) as DocumentCollection[];
            const collectionItemIds = collections.reduce(
                (acc, collection: DocumentCollection) => {
                    return [
                        ...acc,
                        ...(collection.elements.map(el => el.key))
                    ];
                }, []
            )
            const binders = items.filter(i => (i as DocumentCollection).elements === undefined);
            if (binders.length > 0) {
                count += await countPublishedBinders(uniq(binders.map(b => b.id)));
            }
            if (collections.length > 0) {
                const toProcess = collectionItemIds.filter(id => !processed.has(id));
                count += await processItems(toProcess);
                for (const processedId of ids) {
                    processed.add(processedId);
                }
            }
            return count;
        }
        return processItems(itemIds);
    }

    async countAllPublicDocuments(accountId: string): Promise<number> {
        let count = await this.publicItemsCache.getPublicItemCount(accountId);
        if (count !== undefined) {
            return count;
        }
        count = await this.doCountAllPublicDocumentsForAccount(accountId);
        await this.publicItemsCache.setPublicItemCount(accountId, count);
        return count;
    }

    async doCountAllPublicDocumentsForAccount(accountId: string): Promise<number> {
        const allAcls = await this.authorizationContract.accountAcls(accountId);
        const publicItemsIdsSet = new Set<string>();
        allAcls.forEach(acl => {
            if (any((assignee: AssigneeGroup) => assignee.type === AssigneeType.PUBLIC, acl.assignees)) {
                const itemIds: string[] = flatten(acl.rules.map(rule => rule.resource.ids))
                itemIds.forEach(itemId => {
                    publicItemsIdsSet.add(itemId);
                });
            }
        });
        const publicItemIds = Array.from(publicItemsIdsSet);
        return this.countAllActivePublications(publicItemIds);
    }

    async searchBindersAndCollections(
        queryString: string,
        options: IItemSearchOptions,
        accountId: string,
        multiSearchOptions: IMultiSearchOptions = {},
        userId?: string,
    ): Promise<EditorItemSearchResult> {
        const transformers = this.itemsTransformersFactory.build({
            accountId,
            transformImages: { cdnnify: options.cdnnify, thumbnailsOnly: true },
            inheritThumbnailOptions: { cdnnify: options.cdnnify },
            addHasPublications: false
        });

        return await this.searchService.search(
            { accountId, queryString, options, userId, transformers },
            [ItemKind.Binder, ItemKind.Collection],
            multiSearchOptions.isReadOnlyMode ? PermissionName.VIEW : PermissionName.EDIT,
            multiSearchOptions.prioritizedScopeCollectionId,
        ) as EditorItemSearchResult;
    }

    async searchPublicationsAndCollections(
        queryString: string,
        options: IItemSearchOptions,
        domain: string,
        multiSearchOptions: IMultiSearchOptions = {},
        userId?: string,
    ): Promise<ReaderItemSearchResult> {
        const [accountId] = await this.routingServiceContract.getAccountIdsForDomain(domain);

        const transformers = this.itemsTransformersFactory.build({
            accountId,
            userId,
            filterCollectionsWithoutPublications: true,
            filterPublicNonAdvertised: true,
            filterItemsWithHiddenAncestors: !!options.binderSearchResultOptions?.showIsHidden,
            inheritThumbnailOptions: { cdnnify: options.cdnnify },
            transformImages: { cdnnify: options.cdnnify, thumbnailsOnly: true },
        });

        return await this.searchService.search(
            { accountId, queryString, options, userId, transformers },
            [ItemKind.Publication, ItemKind.Collection],
            PermissionName.VIEW,
            multiSearchOptions.prioritizedScopeCollectionId
        ) as ReaderItemSearchResult;
    }

    async getBinder(binderId: string, options?: IItemSearchOptions): Promise<Binder> {
        let binder = await this.bindersRepository.getBinder(binderId);
        const [publishedBinderIds, idsOfMultiOccurrences] = await Promise.all([
            this.publicationRepository.filterPublicationlessBinders([binderId]),
            this.collectionRepository.getIdsOfMultiElements([binderId]),
        ]);
        binder.hasPublications = publishedBinderIds && publishedBinderIds.length > 0;
        binder.isInstance = idsOfMultiOccurrences && idsOfMultiOccurrences.length > 0;
        const skipPopulateVisuals = options && options.skipPopulateVisuals;
        const cdnnify = options ? options.cdnnify : undefined;
        const urlTokens: { [id: string]: UrlToken } = await UrlToken.buildMany([binder.id], this.jwtConfig, 1);
        const urlToken = urlTokens[binder.id] && urlTokens[binder.id].key;

        const transformers: ItemsTransformer[] = [
            this.buildImageFormatTransformer({ cdnnify, urlToken, thumbnailsOnly: skipPopulateVisuals }),
            this.buildLastEditedUsernameTransformer(),
        ]
        if (options?.includeVisualsStatus) {
            transformers.push(this.buildProvideImageStatusTransformer(binderId));
        }

        const [transformedBinder] = await multiTransformItems(
            [binder],
            transformers
        ) as Array<Binder>;
        binder = transformedBinder;
        return binder;
    }

    async extendChunks(
        binderOrPublication: Binder | Publication,
        additionalChunks: ContentChunkKind[],
        translated: string,
    ): Promise<BinderModules> {
        const shouldRenderMadeByManualToChunk = additionalChunks.includes(ContentChunkKind.MadeByManualTo);
        const shouldRenderFeedbackChunk = additionalChunks.includes(ContentChunkKind.Feedback);
        const shouldRenderTitleChunk = additionalChunks.includes(ContentChunkKind.TitleChunk);
        const shouldRenderReadConfirmationChunk = additionalChunks.includes(ContentChunkKind.ReadConfirmation);
        let binderModules = binderOrPublication.modules;
        if (shouldRenderTitleChunk) {
            const totalVideoDurationSecs = await this.calculateTotalVideoDuration(binderOrPublication);
            binderModules = await prependTitleChunk(binderOrPublication, { totalVideoDurationSecs });
        }
        if (shouldRenderReadConfirmationChunk) {
            binderModules = await appendReadConfirmationChunk({ ...binderOrPublication, modules: binderModules });
        }
        if (shouldRenderFeedbackChunk) {
            binderModules = await appendFeedbackChunk(binderModules);
        }
        return appendMadeByManualToChunk(
            binderModules,
            shouldRenderMadeByManualToChunk,
            translated,
        );
    }

    private async calculateTotalVideoDuration(binderOrPublication: Binder | Publication) {
        const thumbnail = binderOrPublication.thumbnail;
        const visuals = binderOrPublication.modules.images.chunked.at(0).chunks.flat();
        const videoIds = uniq([thumbnail.id, ...visuals.map(v => v.id)]).filter(x => x && isVideoId(x));
        const videoDurations = await this.imageServiceContract.queryVideoDurations(videoIds);
        const totalVideoDuration = videoDurations?.durations ? sum(Object.values(videoDurations.durations)) / 1000 : 0;
        return totalVideoDuration;
    }

    findBindersBackend(
        filter: BinderFilter,
        options: BinderSearchResultOptions,
    ): Promise<Array<BinderFindResult>> {
        return this.bindersRepository.findBinders(filter, options);
    }

    findBinderIdsByAccount(accountId: string): Promise<string[]> {
        return this.bindersRepository.findBinderIdsByAccount(accountId)
    }

    async findItems(
        filter: BinderFilter,
        options: BinderSearchResultOptions,
    ): Promise<Array<Binder | DocumentCollection>> {
        const items = await this.multiRepository.findItems(filter, options);
        const itemIds = items.map(item => item.id);
        const [publishedBinderIds, idsOfMultiOccurrences] = await Promise.all([
            this.publicationRepository.filterPublicationlessBinders(itemIds),
            this.collectionRepository.getIdsOfMultiElements(itemIds),
        ]);
        return items.map(item => ({
            ...item,
            hasPublications: publishedBinderIds.indexOf(item.id) !== -1,
            isInstance: idsOfMultiOccurrences.indexOf(item.id) !== -1,
        }));
    }


    async getSoftDeletedItems(
        accountId: string,
        options: IItemSearchOptions,
        filter?: SoftDeletedItemsFilter,
        userId?: string
    ): Promise<SoftDeletedItemsSearchResult> {
        let scopeCollectionId = filter?.scopeCollectionId;
        if (!scopeCollectionId) {
            const [domainFilter] = await this.routingServiceContract.getDomainFiltersForAccounts([accountId]);
            if (!domainFilter) {
                throw new InvalidParam([`No domain collection for given accountId ${accountId}`]);
            }
            scopeCollectionId = domainFilter.domainCollectionId;
        }


        const { cdnnify } = options;
        this.trashService.trashItemsTransformer = [this.buildImageFormatTransformer({ cdnnify, thumbnailsOnly: true })]
        const deletedItems = await this.trashService.getSoftDeletedItemsForScope(
            accountId,
            scopeCollectionId,
            userId,
            options,
            filter
        );

        const usersIds = deletedItems.map(item => item.deletedById).filter(i => !!i);
        const usersObjects = await this.userServiceContract.findUserDetailsForIds(usersIds);
        const itemIds = deletedItems.map(({ id }) => id);
        const urlTokens: { [key: string]: UrlToken } = await UrlToken.buildMany(Array.from(itemIds), this.jwtConfig, 1);
        deletedItems.forEach(deletedItem => {
            const idToUse = deletedItem.id;
            const urlToken: string = urlTokens[idToUse] && urlTokens[idToUse].key;
            deletedItem.thumbnail = { ...deletedItem.thumbnail, urlToken };
        });
        const ancestors = await this.ancestorBuilder.getAncestors(itemIds);
        const parents = ancestors.getFilteredItems();

        return {
            items: deletedItems,
            parents,
            users: usersObjects
        };
    }

    async findItemsForReader(
        filter: BinderFilter,
        options: IItemSearchOptions,
        accountId: string,
        userId?: string,
    ): Promise<BinderOrDocumentCollection[]> {
        const foundItems = await this.findItemsForEditor(filter, options, accountId, userId);
        return foundItems.filter(item => item.hasPublications);
    }

    async findItemsForEditor(
        filter: BinderFilter,
        options: IItemSearchOptions,
        accountId: string,
        userId?: string,
    ): Promise<BinderOrDocumentCollection[]> {
        const {
            binderSearchResultOptions,
            ancestorThumbnailsOptions,
            skipPopulateVisuals,
            skipInstanceDetermination,
            cdnnify,
            includeTotalPublicDocumentsCount,
        } = options;
        let account = accountId;
        if (!account) {
            const { accountId: accountIdFromDomain } = await this.getAccountIdAndRequestingUserId(filter.domain, userId);
            account = accountIdFromDomain;
        }
        const ancestorBuilder = new PrefetchingAncestorBuilder(this.ancestorBuilder);
        if (filter?.binderIds != null && filter.binderIds.length > 0) {
            await ancestorBuilder.getParents(filter.binderIds);
        }
        const allItems = await this.multiRepository.findItems(filter, binderSearchResultOptions);
        const allowedItemIds = await filterItemIdsByPermission(
            allItems.map(item => getBinderIdFromItem(item)),
            PermissionName.VIEW,
            this.authorizationContract,
            ancestorBuilder,
            account,
            userId,
            options.isReadOnlyMode);
        let items = allItems.filter(item => allowedItemIds.has(item.id)) as (Binder | DocumentCollection)[];
        const itemIds = items.map(item => item.id);
        const [publishedBinderIds, idsOfMultiOccurrences] = await Promise.all([
            this.publicationRepository.filterPublicationlessBinders(itemIds),
            ...(skipInstanceDetermination ? [Promise.resolve(undefined)] : [this.collectionRepository.getIdsOfMultiElements(itemIds)]),
        ]);
        let urlTokens: { [id: string]: UrlToken };
        const shouldGetInheritedThumbs = ancestorThumbnailsOptions && ancestorThumbnailsOptions.inheritAncestorThumbnails && !skipPopulateVisuals;

        const transformers: ItemsTransformer[] = [
            shouldGetInheritedThumbs ? this.buildInheritedThumbnailTransformer({ cdnnify, ancestorBuilder }) : undefined,
            this.buildImageFormatTransformer({ cdnnify, thumbnailsOnly: true }),
            this.buildLastEditedUsernameTransformer(),
        ].filter(t => !!t);

        if (!shouldGetInheritedThumbs && !cdnnify) {
            urlTokens = await UrlToken.buildMany(items.map(i => i.id), this.jwtConfig, 1);
        }

        items = await multiTransformItems(items, transformers) as Array<Binder | DocumentCollection>;

        const result: BinderOrDocumentCollection[] = [];
        for (let item of items) {
            if (item["kind"] !== "collection") {
                item = item as Binder;
                item.hasPublications = publishedBinderIds.includes(item.id);
                item.languages = item.languages || [];
                item.languages = item.languages.sort(({ priority: p1 }, { priority: p2 }) => p1 - p2)
            }
            if (!shouldGetInheritedThumbs && !cdnnify) {
                item.thumbnail.urlToken = urlTokens[item.id] && urlTokens[item.id].key;
            }
            if (item["isRootCollection"] === true && includeTotalPublicDocumentsCount) {
                item = item as DocumentCollection;
                item.totalPublicDocuments = await this.countAllPublicDocuments(accountId);
            }
            if (!skipInstanceDetermination) {
                item.isInstance = idsOfMultiOccurrences.includes(item.id);
            }
            result.push(item);
        }

        return result;
    }

    async getCollectionElementsWithInfo(
        collectionId: string,
        domain: string,
        options: CollectionElementsWithInfoOptions,
    ): Promise<ICollectionElementsWithInfo> {
        const collection = await this.collectionRepository.getCollection(collectionId);
        const { preferredLanguageCodes } = options;

        const binderSearchResultOptions = {
            maxResults: ES_MAX_RESULTS,
        };
        const ancestorThumbnailsOptions = {
            inheritAncestorThumbnails: true,
            directParentCollectionId: collectionId,
        };


        const domainFilter = await this.routingServiceContract.getDomainFilterByDomain(domain);
        const domainCollectionId = domainFilter ? domainFilter.domainCollectionId : undefined;

        if (collection.elements.length === 0) {
            return {
                items: [],
                languagesUsed: [],
            };
        }

        const filter = collection.elements.reduce<BinderFilter>((acc, elem) => {
            if (elem.kind === "collection") {
                return { ...acc, ids: [...(acc.ids || []), elem.key] };
            }
            return { ...acc, binderIds: [...(acc.binderIds || []), elem.key] };
        }, {
            summary: true,
            preferredLanguages: (preferredLanguageCodes === undefined || preferredLanguageCodes.length === 0) ?
                [] :
                preferredLanguageCodes
            ,
            domain,
        });

        const { items: foundItems, languagesUsed } = await this.multiRepository.getPublicationsAndCollectionsWithInfo(
            filter,
            binderSearchResultOptions,
            domainCollectionId
        );

        let items = foundItems.filter((itm) => !itm.isHidden && itm["hasPublications"] !== false);

        const itemsTransformers = [];
        if (ancestorThumbnailsOptions && ancestorThumbnailsOptions.inheritAncestorThumbnails) {
            const directParentCollectionId = ancestorThumbnailsOptions && ancestorThumbnailsOptions.directParentCollectionId;
            itemsTransformers.push(this.buildInheritedThumbnailTransformer({ directParentCollectionId }));
        }

        itemsTransformers.push(this.buildImageFormatTransformer({ cdnnify: options.cdnnify, thumbnailsOnly: true }));
        items = await multiTransformItems(items, itemsTransformers) as Array<Story>;

        const sortedItems = toOriginalSortOrder(
            items.reduce((reduced, story) => {
                if (story.kind === "publication") {
                    return [...reduced, ...toBinderStories([story as Publication])];
                } else {
                    return [...reduced, story];
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            }, [] as Array<any>),
            collection.elements,
        );
        return {
            items: sortedItems,
            languagesUsed: sortLanguagesUsed(collection, languagesUsed),
        };
    }

    async findPublicationsAndCollections(
        filter: BinderFilter,
        options: BinderSearchResultOptions,
        accountId: string,
        userId?: string
    ): Promise<Array<Publication | DocumentCollection>> {
        const permissionFilter = (item: Publication | DocumentCollection) => {
            const itemId = (isPublicationItem(item) && item.binderId) ?? item.id;
            return filterItemIdsByPermission(
                [itemId],
                PermissionName.VIEW,
                this.authorizationContract,
                this.ancestorBuilder,
                accountId,
                userId,
            ).then(itemIds => itemIds.size > 0);
        };
        if (filter.domain) {
            const domainFilter = await this.routingServiceContract.getDomainFilterByDomain(filter.domain);
            const domainCollectionId = domainFilter ? domainFilter.domainCollectionId : undefined;
            return this.multiRepository.findPublicationsAndCollections(filter, options, domainCollectionId, permissionFilter);
        }
        return Promise.resolve([]);
    }

    private async createBinder(toCreate: Binder, _accountId?: string, auth?: AuthenticatedSession): Promise<Binder> {
        const accountIds = await this.fetchAccountIdsFromUser(auth?.userId);
        const fail = (message: string) => {
            this.logger.error(message, "binder-create");
            throw new InvalidOperation(message);
        };
        if (!accountIds) {
            fail("Cannot create a new document, no account id available for user.");
        }
        if (!toCreate.accountId) {
            fail("Each new documents should have an account id");
        }
        if (!(accountIds.includes(toCreate.accountId))) {
            fail("Can only create documents in your own account.");
        }
        const binder = await this.withValidBinder(toCreate, (b: Binder) => this.bindersRepository.createBinder(b));
        this.logItemEvent(EventType.ITEM_CREATED, binder, auth.userId);
        captureServerEvent(ServerEvent.DocumentCreated, {
            accountId: _accountId as string,
            userId: auth?.userId as string
        }, { itemId: binder.id });
        return binder;
    }

    async createBinderInCollection(
        toCreate: Binder,
        collectionId: string,
        accountId?: string,
        auth?: AuthenticatedSession
    ): Promise<Binder> {
        const binder = await this.createBinder(toCreate, accountId, auth);
        await this.addElementToCollection(collectionId, "document", binder.id, accountId);
        return binder;
    }

    createBinderBackend(toCreate: Binder): Promise<Binder> {
        const create = this.bindersRepository.createBinder.bind(this.bindersRepository);
        return this.withValidBinder(toCreate, create);
    }

    private withValidBinder<T>(binderCandidate: Binder, f: (b: Binder) => Promise<T>): Promise<T> {
        const validationErrors = validateBinder(binderCandidate);
        if (validationErrors.length === 0) {
            const normalizedBinderCandidate = normalizeChunkCount(binderCandidate, this.logger);
            return f(normalizedBinderCandidate);
        }
        return Promise.reject(new InvalidBinder(validationErrors));
    }

    async duplicateBinder(
        binder: Binder,
        targetCollectionId: string,
        fromAccountId: string,
        toAccountId: string,
        auth?: AuthenticatedSession
    ): Promise<Binder> {
        const { duplicatedItem, duplicatedItemsIdPairs } = await this.duplicateBinderObject(
            binder,
            targetCollectionId,
            [],
            toAccountId);
        if (toAccountId === fromAccountId) {
            const accountFeatures = await this.accountServiceContract.getAccountFeatures(toAccountId);
            if (accountFeatures.includes(FEATURE_DUPLICATE_ACLS)) {
                await this.authorizationContract.duplicateResourceAcls(duplicatedItemsIdPairs, ResourceType.DOCUMENT, toAccountId);
            }
        }
        this.logItemEvent(EventType.ITEM_CREATED, binder, auth.userId);
        captureServerEvent(ServerEvent.DocumentCreated, {
            accountId: toAccountId,
            userId: auth?.userId,
        }, { itemId: binder.id });
        return duplicatedItem;
    }

    private async duplicateBinderObject(binder: Binder, targetCollectionId: string, duplicatedItemsIdPairs: string[][], accountId?: string): Promise<IDuplicationResult<Binder>> {
        const { ownership: _ = undefined, ...toDuplicate } = {
            ...binder,
            ...(accountId ? { accountId } : {}),
        };
        const duplicateFn = this.bindersRepository.duplicateBinder.bind(this.bindersRepository);
        const duplicated: Binder = await this.withValidBinder<Binder>(toDuplicate, duplicateFn);
        if (!targetCollectionId) {
            const [rootCollection] = await this.getRootCollections([toDuplicate.accountId]);
            targetCollectionId = rootCollection.id;
        }
        const destinationAccountId = accountId || binder.accountId;
        await this.addElementToCollection(
            targetCollectionId,
            "document",
            duplicated.id,
            destinationAccountId,
        );
        return {
            duplicatedItem: duplicated,
            duplicatedItemsIdPairs: [...duplicatedItemsIdPairs, [binder.id, duplicated.id]],
        };
    }

    async duplicateCollection(
        collectionId: string,
        targetCollectionId: string,
        targetDomainCollectionId: string,
        fromAccountId: string,
        toAccountId: string
    ): Promise<DocumentCollection> {
        const collection = await this.collectionRepository.getCollection(collectionId);
        const duplicationResult = await this.duplicateCollectionObject(collection, targetCollectionId, targetDomainCollectionId, [], toAccountId);
        const duplicatedCollection = duplicationResult.duplicatedItem;
        const accountFeatures = toAccountId && await this.accountServiceContract.getAccountFeatures(toAccountId);
        if (accountFeatures.includes(FEATURE_DUPLICATE_ACLS) && (fromAccountId === toAccountId)) {
            await this.authorizationContract.duplicateResourceAcls(duplicationResult.duplicatedItemsIdPairs, ResourceType.DOCUMENT, toAccountId);
        }
        return duplicatedCollection;
    }

    private async duplicateCollectionObject(
        collection: DocumentCollection,
        targetCollectionId: string,
        targetDomainCollectionId: string,
        duplicatedItemsIdPairs: string[][],
        accountId?: string,
    ): Promise<IDuplicationResult<DocumentCollection>> {
        const { ownership: _ = undefined, ...toDuplicate } = {
            ...collection,
            domainCollectionId: targetDomainCollectionId,
            ...(accountId ? { accountId } : {}),
            isRootCollection: false,
        };
        const duplicatedCollection = await this.collectionRepository.duplicateCollectionWithoutElements(toDuplicate);
        const { elements } = toDuplicate;
        const elementItems = await elementsToItems(elements, this.bindersRepository, this.collectionRepository);
        for (const { key, kind } of elements) {
            const item = elementItems.find(({ id }) => id === key);
            if (!item) {
                continue;
            }
            let elementDuplicationResult: IDuplicationResult<Binder | DocumentCollection>;
            if (kind === "collection") {
                elementDuplicationResult = await this.duplicateCollectionObject(item, duplicatedCollection.id, targetDomainCollectionId, duplicatedItemsIdPairs, accountId);
            } else {
                elementDuplicationResult = await this.duplicateBinderObject(item, duplicatedCollection.id, duplicatedItemsIdPairs, accountId);
            }
            duplicatedItemsIdPairs = elementDuplicationResult.duplicatedItemsIdPairs;
        }
        if (!targetCollectionId) {
            const [rootCollection] = await this.getRootCollections([collection.accountId]);
            targetCollectionId = rootCollection.id;
        }
        const destinationAccountId = accountId || collection.accountId;
        await this.addElementToCollection(
            targetCollectionId,
            "collection",
            duplicatedCollection.id,
            destinationAccountId,
        );
        const destinationDomainFilter = await this.getAccountDomainFilter(destinationAccountId);
        const destinationDomain = destinationDomainFilter?.domain;
        const languageCodes = duplicatedCollection.titles.map(title => title.languageCode);
        await this.ensureSemanticLinksForItem(duplicatedCollection, DocumentType.COLLECTION, languageCodes, destinationDomain);
        return {
            duplicatedItem: duplicatedCollection,
            duplicatedItemsIdPairs: [...duplicatedItemsIdPairs, [collection.id, duplicatedCollection.id]],
        }
    }

    updateBinder(toUpdate: Binder, userId: string): Promise<Binder> {
        toUpdate = deduplicateChunkIds(toUpdate);
        toUpdate = deduplicateTextModuleKeys(toUpdate, userId);

        const updatedMeta = [...toUpdate.modules.meta].map(({ lastModifiedDate, lastModifiedBy, ...rest }) => {
            if (lastModifiedDate === DATE_CHANGED_MARKER) {
                lastModifiedDate = new Date();
                lastModifiedBy = userId;
            }
            return {
                ...omit(["lastModifiedByName"], rest),
                lastModifiedDate,
                lastModifiedBy,
            }
        });
        toUpdate.modules.meta = updatedMeta;
        const safeAuthorIds = toUpdate.authorIds || [];
        toUpdate.authorIds = safeAuthorIds.includes(userId) ? safeAuthorIds : safeAuthorIds.concat([userId]);
        delete toUpdate.lastModifiedByName;
        const update = this.bindersRepository.updateBinder.bind(this.bindersRepository);

        toUpdate.modules.images.chunked[0].chunks = toUpdate.modules.images.chunked[0].chunks.map(chunkArray => {
            return chunkArray.map(el => ({ ...omit(["formats", "formatUrls", "manifestUrls"], el) }))
        });
        toUpdate = new BinderHtmlSanitizer(this.logger).sanitize(toUpdate);
        return this.withValidBinder(toUpdate, update);
    }

    async deleteBinder(
        binderId: string,
        accountId: string,
        permanent?: boolean,
        userId?: string,
        auditLogger?: AuditLogFn,
        deletedGroupCollectionId?: string,
        allowGroupDeletion = false
    ): Promise<Binder> {

        const binder = await this.bindersRepository.getBinder(binderId);
        if (!binder) {
            throw new Error("Can't delete null Binder");
        }
        if (binder.deletedGroupCollectionId && permanent && !allowGroupDeletion) {
            throw new Error("Can't hard delete binders that are part of a deleted group");
        }
        const hasPublications = await this.findBinderHasPublications(binderId);
        if (hasPublications) {
            throw new BinderHasPublicationError();
        }
        if (auditLogger) {
            await auditLogger(this.trackingServiceContract);
        }

        if (permanent) {
            await Promise.all([
                this.routingServiceContract.deleteSemanticLinks({ binderId }),
                this.approvalRepository.deleteApprovalsForBinder(binderId)
            ]);
        }

        this.removeAsCollectionElements(binderId, { permanent });
        await this.ancestorBuilder.flushCache(binderId);
        await this.bindersRepository.deleteBinder(
            binder,
            permanent,
            userId,
            deletedGroupCollectionId
        );
        await this.authorizationContract.removeResourceFromAcls(binderId);
        this.publicItemsCache.invalidateForAccount(accountId);
        this.logItemEvent(
            permanent ? EventType.ITEM_HARD_DELETED : EventType.ITEM_DELETED,
            binder,
            userId
        );
        return binder;
    }

    async deleteCollection(
        collectionId: string,
        accountId: string,
        userId?: string,
        deletedGroupCollectionId?: string,
        deletedGroupCount?: number
    ): Promise<DocumentCollection> {
        const collection = await this.getCollection(collectionId);
        if (!collection) {
            throw new Error("Can't delete null DocumentCollection");
        }
        if (collection.elements.length > 0) {
            // we check if the elements in this collection point to no longer existing items, if they do, proceed with the delete
            const binderElements = await this.multiRepository.findItems({ ids: collection.elements.map(e => e.key) }, { maxResults: 1 });
            if (binderElements.length) {
                throw new CollectionNotEmpty(collectionId);
            } else {
                this.logger.error(`Corrupt collection detected during delete: collection ${collectionId} has ${collection.elements.length} elements but none of them exist any longer. Proceeding with delete`, "delete-collection");
            }
        }
        await this.removeAsCollectionElements(collectionId, { isColl: true, permanent: false });
        const updatedCollection = await this.collectionRepository.deleteCollection(
            collectionId,
            false,
            userId,
            deletedGroupCollectionId,
            deletedGroupCount
        );
        await this.authorizationContract.removeResourceFromAcls(collectionId);
        this.publicItemsCache.invalidateForAccount(accountId);
        this.logItemEvent(EventType.ITEM_DELETED, collection, userId);
        return updatedCollection;
    }

    private async removeAsCollectionElements(
        elementId: string,
        options?: {
            isColl?: boolean,
            permanent?: boolean
        }
    ) {
        const collections = await this.findCollectionsContainingElement(elementId);
        for (const collection of collections) {
            const removeCollectionFn = coll => removeCollectionElement(
                coll,
                options?.isColl ? "collection" : "document",
                elementId,
                options?.permanent
            );
            await this.collectionRepository.patchCollection(collection.id, removeCollectionFn);
        }
    }

    private async findCollectionsContainingElement(id: string): Promise<Array<DocumentCollection>> {
        const itemIds: string[] = [id];
        const filter: CollectionFilter = { itemIds, softDelete: { show: "show-all" } };
        const options: BinderSearchResultOptions = { maxResults: 100 };
        return await this.findCollections(filter, options);
    }

    private async findBinderHasPublications(binderId: string): Promise<boolean> {
        const find = this.publicationRepository.getPublications.bind(this.publicationRepository);
        const publications: Publication[] = await find(binderId, 10, 1);
        return publications.length && publications.length > 0;
    }

    async getRootCollections(accountIds: string[], user?: AuthenticatedSession): Promise<Array<DocumentCollection>> {
        if (!accountIds || accountIds.length === 0) {
            throw new Error("No account ids");
        }
        const { logger } = this;
        let allowedAccountIds: string[];
        if (isBackendSession(user)) {
            allowedAccountIds = accountIds;
        } else {
            const { userId } = user;
            const userAccounts = await this.accountServiceContract.getAccountsForUser(userId, { checkForAdminPermission: false });
            const userAccountIds = userAccounts.map(acc => acc.id);
            allowedAccountIds = accountIds.filter(accountId => userAccountIds.includes(accountId));
            if (!allowedAccountIds.length) {
                throw new Unauthorized("Requesting user is not a member of any of the requested account ids");
            }
            if (allowedAccountIds.length < accountIds.length) {
                logger.warn(`Requesting user isn't a member of requested account ids ${without(allowedAccountIds, accountIds)}, filtering them out`, "account-root-collections");
            }
        }
        const filter: CollectionFilter = { rootCollections: allowedAccountIds };
        const options: BinderSearchResultOptions = { maxResults: 2000 };
        const rootCollections = await this.findCollections(filter, options);

        if (allowedAccountIds.length !== rootCollections.length) {
            logger.warn(
                `Mismatch: found ${rootCollections.length} root collections for ${allowedAccountIds.length}`,
                "account-root-collections",
                {
                    collectionIds: rootCollections.map(c => c.id),
                    accountIds: allowedAccountIds,
                }
            );
        }
        return rootCollections;
    }

    private extractLanguageFromBinder(binder: Binder, languageCode: string) {
        const filteredLanguages = binder.languages.filter(language => language.iso639_1 === languageCode);
        if (filteredLanguages.length !== 1) {
            const message = `Could not extract language ${languageCode} from binder ${binder.id} because it is ${filteredLanguages.length >
                1 ?
                "occurring multiple times" :
                "missing"}`;
            this.logger.error(message, "publish");

            throw new MissingLanguage(binder.id, languageCode);
        }
        return filteredLanguages[0];
    }

    private getBinderTitleInLanguageOrFirst(binder: Binder, languageCode: string): string {
        const language = binder.languages.find(language => language.iso639_1 === languageCode);
        return language?.storyTitle ?? binder.languages.at(0).storyTitle;
    }

    private extractModules(binder: Binder, moduleKeys: string[]): BinderModules {
        const textModules = binder.modules.text.chunked.filter(module => (moduleKeys.includes(module.key)));
        return {
            meta: binder.modules.meta,
            images: binder.modules.images,
            text: { chunked: textModules }
        };
    }

    private buildPublication(binder: Binder, languageCode: string, domainCollectionId: string, userId: string, isActive: boolean): Publication {
        const language = this.extractLanguageFromBinder(binder, languageCode);
        const modules = this.extractModules(binder, language.modules);
        if (!language.storyTitle) {
            throw new MissingTitle(binder.id, language.iso639_1)
        }

        const now = new Date();
        const publication = {
            binderId: binder.id,
            ancestorIds: binder.ancestorIds,
            accountId: binder.accountId,
            binderLog: binder.binderLog,
            domainCollectionId,
            bindersVersion: binder.bindersVersion,
            thumbnail: binder.thumbnail,
            language,
            links: binder.links,
            modules,
            lastModified: binder.lastModified,
            publicationDate: now,
            publishedBy: userId,
            isActive,
            isMaster: language.priority === 0,
            showInOverview: binder.showInOverview,
            authorIds: binder.authorIds,
        };
        const validationErrors = validatePublication(publication);
        if (validationErrors.length > 0) {
            throw new InvalidPublication(validationErrors, `Invalid publication made for binder ${binder.id} and language ${languageCode} - not inserted`);
        }
        return publication;
    }

    private buildPublications(binder: Binder, languageCodes: string[], domainCollectionId: string, userId: string): Publication[] {
        return languageCodes.map(
            languageCode => this.buildPublication(binder, languageCode, domainCollectionId, userId, true)
        );
    }

    async publish(
        binderId: string,
        languageCodes: string[],
        sendNotification = true,
        userId: string,
        logAuditLog?: (
            binderId: string,
            accountId: string,
            publicationId: string,
            publishUpdateAction: PublishUpdateActionType,
            languageCode: string,
        ) => void,
        fetchedPublications?: PublicationFindResult[]
    ): Promise<Array<PublicationSummary>> {
        const documentAncestors = await this.getAncestors(binderId);
        const uniqueAncestors = uniq(
            Object.keys(documentAncestors).filter(a => a !== binderId)
        );
        const binder = removeEmptyLastChunks(
            await this.bindersRepository.getBinder(binderId),
        );
        const existingPublicationFilter = getExistingPublicationFilter(binderId, languageCodes)
        const existingPublications = fetchedPublications && fetchedPublications.length > 0 ?
            fetchedPublications :
            await this.publicationRepository.find(existingPublicationFilter, { maxResults: 150 })

        const savedPublications = existingPublications
            .filter(publication => hasDraft(binder.modules.meta, publication.language.iso639_1, [publication as Publication]))
            .map(pub => ({
                ...pub,
                isActive: false,
                unpublishDate: new Date()
            }));
        const latestPublishDatePerLanguageCode = existingPublications.reduce(
            (res, item) => dateSorterDesc(res[item.language.iso639_1], item.publicationDate ? new Date(item.publicationDate) : null) > 0 ?
                res :
                ({ ...res, [item.language.iso639_1]: new Date(item.publicationDate) }),
            {} as Record<string, Date | null>)
        const accountFeatures = await this.accountServiceContract.getAccountFeatures(binder.accountId);
        const hasApprovalFlow = accountFeatures.includes(FEATURE_APPROVAL_FLOW);
        if (hasApprovalFlow) {
            await this.checkApprovalsForLanguages(binder, languageCodes);
        }

        const domainFilters = await this.routingServiceContract.getDomainFiltersForAccounts([binder.accountId]);
        const domainFilter = domainFilters.length > 0 ? domainFilters.pop() : undefined;
        const [domainCollectionId, domain] = domainFilter ? [domainFilter.domainCollectionId, domainFilter.domain] : [undefined, undefined];
        const publicationLanguageCodesContainingDraftsOrNoActivePublication = languageCodes.filter(langCode => {
            const noActivePublicationYet = existingPublications.find(pub => pub.language.iso639_1 === langCode) === undefined;
            return noActivePublicationYet || hasDraft(binder.modules.meta, langCode, existingPublications as Publication[])
        })
        const publicationsToSave = this.buildPublications(binder, publicationLanguageCodesContainingDraftsOrNoActivePublication, domainCollectionId, userId);
        let publicationsUpdates = this.buildPublicationUpdates(publicationsToSave, <Publication[]>savedPublications);
        publicationsUpdates = await this.buildPublicationAncestorIdsUpdates(publicationsUpdates);

        if (publicationsUpdates?.length > 0) {
            await this.publicationRepository.bulk(publicationsUpdates, [], true);
            if (uniqueAncestors.length > 0) {
                await this.markAncestorsHavePublications(uniqueAncestors);
            }
        } else {
            throw new NothingToPublish(binderId, languageCodes[0])
        }
        const summaries = await this.publicationRepository.find({ binderId, isActive: 1 }, { maxResults: 250 }) as PublicationSummary[];
        const updatedSummaries = summaries.filter(summary => summary.language?.iso639_1 && languageCodes.includes(summary.language.iso639_1));

        this.trackingServiceContract.multiInsertUserAction(
            updatedSummaries.map(summary => this.getPublishAction(binder, summary, userId)),
            binder.accountId
        );
        updatedSummaries.forEach(summary =>
            logAuditLog?.(binderId, binder.accountId, summary.id, PublishUpdateActionType.PUBLISHED_DOCUMENT, summary.language.iso639_1));

        const hasChecklists = accountFeatures.includes(FEATURE_CHECKLISTS);
        if (hasChecklists) {
            const checklistConfigs = await this.checklistConfigRepository.getChecklistsConfig(binderId)
            await this.checklistRepository.uspertChecklists(binderId, checklistConfigs)
        }
        this.publicItemsCache.invalidateForAccount(binder.accountId);
        await this.ensureSemanticLinksForItem(binder, DocumentType.DOCUMENT, languageCodes, domain);
        if (sendNotification) {
            for (const publication of publicationsToSave) {
                this.sendPublishNotification(publication, userId);
            }
        }
        const now = new Date().getTime();
        for (const languageCode of languageCodes) {
            const latestPublish = latestPublishDatePerLanguageCode[languageCode]?.getTime() ?? 0;
            captureServerEvent(ServerEvent.DocumentPublished, {
                userId,
                accountId: binder.accountId
            }, {
                binderId: binder.id,
                languageCode,
                lastPublishedSecondsAgo: latestPublish ? now - latestPublish : 0,
            });
        }
        return summaries;
    }

    private getPublishAction(binder: Binder, summary: PublicationSummary, userId: string): IUserAction<IUserActionPublishData> {
        const eventDate = new Date();
        return {
            data: {
                binderId: binder.id,
                publicationId: summary.id,
                languageCode: summary.language.iso639_1,
            },
            accountId: binder.accountId,
            userId,
            userActionType: UserActionType.DOCUMENT_PUBLISHED,
            start: eventDate,
            end: eventDate,
        };
    }

    private async sendPublishNotification(publication: Publication, userId) {
        const notification = {
            accountId: publication.accountId,
            kind: NotificationKind.PUBLISH,
            itemId: publication.binderId,
            actorId: userId,
            publicationId: publication.id,
            publicationLanguageCode: publication.language.iso639_1,
            publicationTitle: publication.language.storyTitle
        } as PublishNotification;
        await this.notificationServiceClient.sendNotification(notification);
    }

    async ensureSemanticLinksForItem(
        item: Binder | DocumentCollection,
        documentType: DocumentType,
        languageCodes: string[],
        domain: string,
    ): Promise<void> {
        const itemId = item.id;
        const semanticLinkRequests = languageCodes.reduce((reduced, languageCode) => {
            const title = extractTitleForLanguage(item, languageCode);
            const slug = slugify(title || "", { lower: true, strict: true });
            if (!slug) {
                return reduced;
            }
            return reduced.concat({
                slug,
                semanticLink: {
                    binderId: itemId,
                    languageCode,
                    documentType,
                    domain,
                }
            });
        }, [] as ISemanticLinkRequest[]);
        await this.routingServiceContract.ensureSemanticLinks(semanticLinkRequests);
    }

    private async checkApprovalsForLanguages(binder: Binder, languages: string[]) {
        for (const languageCode of languages) {
            const allApproved = await this.checkIfBinderHasChunksApproved(binder, languageCode);
            if (!allApproved) {
                throw new MissingApprovals()
            }
        }
    }

    private async checkIfBinderHasChunksApproved(binder: Binder, languageCode: string): Promise<boolean> {
        const { id: binderId } = binder;
        const { current: logEntries = [] } = binder.binderLog;
        const approvals = await this.approvalRepository.listChunkApprovalsForBinder(binderId);
        const approvalsForLanguage = approvals.filter(a => a.chunkLanguageCode === languageCode);
        const { meta, text } = binder.modules;
        const languageMeta = meta && meta.find(m => m.iso639_1 === languageCode);
        const chunkObj = languageMeta && text.chunked.find(c => c.key === languageMeta.key);
        if (!chunkObj) {
            return true;
        }
        return logEntries.every(entry => {
            const approval = approvalsForLanguage.find(a => a.chunkId === entry.uuid);
            return !!approval && approval.approved === ApprovedStatus.APPROVED;
        });
    }

    private async buildPublicationAncestorIdsUpdates(publications: Publication[]): Promise<Publication[]> {
        if (publications.length === 0) return publications;
        const binderIds = uniq(publications.map(p => p.binderId));
        const documentAncestors = await this.getItemsAncestors(binderIds);

        return publications.map(publication => ({
            ...publication,
            ancestorIds: getAllParentsFromDocumentAncestors(publication.binderId, documentAncestors)
        }));
    }

    private buildPublicationUpdates(publicationsToSave: Publication[], savedPublications: Publication[]): Publication[] {
        return publicationsToSave.reduce((reduced, toSave) => {
            const matchingSavedPublications = savedPublications.filter(saved => {
                return (
                    saved.language.iso639_1 === toSave.language.iso639_1
                );
            });
            if (matchingSavedPublications.length > 0) {
                return reduced
                    .concat(matchingSavedPublications)
                    .concat([{ ...toSave, publicationDate: new Date() }]);
            } else {
                return reduced.concat([toSave]);
            }
        }, []);
    }

    private async resolvePublishedByUser(publications: PublicationFindResult[]): Promise<PublicationFindResult[]> {
        const UIdToDisplayNameMap: { [publishedById: string]: string } = {};
        const resolvedPublications: PublicationFindResult[] = [];
        for (const publication of publications) {
            const publishedByUId = publication.publishedBy;
            if (!publishedByUId) {
                resolvedPublications.push(publication);
            } else {
                if (UIdToDisplayNameMap[publishedByUId] == null) {
                    try {
                        const user = await this.userServiceContract.getUser(publishedByUId);
                        UIdToDisplayNameMap[publishedByUId] = user.displayName;
                    } catch (e) {
                        this.logger.warn("Failed to resolve user", publishedByUId);
                        UIdToDisplayNameMap[publishedByUId] = "";
                    }
                }
                resolvedPublications.push({ ...publication, publishedBy: UIdToDisplayNameMap[publishedByUId] });
            }
        }
        return resolvedPublications;
    }

    async findPublications(binderId: string, filter: PublicationFilter, options: IItemSearchOptions): Promise<PublicationFindResult[]> {
        const {
            binderSearchResultOptions = {} as BinderSearchResultOptions,
            cdnnify,
            skipPopulateVisuals,
            resolvePublishedBy
        } = options;
        try {
            await this.bindersRepository.getBinder(binderId);
        } catch (e) {
            throw new NonExistingItem(binderId);
        }

        let publications = await this.publicationRepository.find({ ...filter, binderId }, binderSearchResultOptions);
        if (!skipPopulateVisuals) {
            const urlTokens: { [id: string]: UrlToken } = await UrlToken.buildMany([binderId], this.jwtConfig, 1);
            const urlToken = urlTokens[binderId] && urlTokens[binderId].key;

            const itemsTransformers = [
                this.buildInheritedThumbnailTransformer(),
                this.buildImageFormatTransformer({ cdnnify, urlToken }),
                this.buildProvideImageStatusTransformer(binderId),
            ];
            publications = await multiTransformItems(publications, itemsTransformers) as PublicationFindResult[];
        }

        if (filter.isActiveOrHasViews || binderSearchResultOptions.includeViews) {
            const viewStats = await this.trackingServiceContract.viewStatsForPublications(publications.map(p => p.id));
            let allowedPublications = filter.isActiveOrHasViews ?
                publications.filter(publicationResult => {
                    return publicationResult.isActive || !!viewStats[publicationResult.id];
                }) :
                publications;
            if (binderSearchResultOptions.includeViews) {
                allowedPublications = allowedPublications.map(publicationResult => {
                    return {
                        ...publicationResult,
                        viewsSummary: viewStats[publicationResult.id],
                    } as PublicationFindResult;
                });
            }
            publications = allowedPublications;
        }
        if (resolvePublishedBy) {
            return this.resolvePublishedByUser(publications);
        }
        return publications;
    }

    async findPublicationsBackend(
        filter: PublicationFilter,
        options: BinderSearchResultOptions,
        publicationFindOptions: PublicationFindOptions = {},
    ): Promise<Array<PublicationFindResult>> {
        const filterWithCollection = await this.getDomainCollectionFilter(filter);
        return this.publicationRepository.find(filterWithCollection, options, publicationFindOptions);
    }

    async markAncestorsHavePublications(uniqueAncestors: string[]): Promise<void> {
        await this.collectionRepository.multisetFlag(uniqueAncestors, "hasPublications", true);
    }

    async verifyAncestorsStillHavePublications(itemId: string, includeSelf = false): Promise<void> {
        const documentAncestors = await this.getAncestors(itemId);
        const directAncestorIds = [...documentAncestors[itemId], ...(includeSelf ? [itemId] : [])];
        if (!directAncestorIds || !directAncestorIds.length) {
            return;
        }
        const directAncestors = await this.collectionRepository.findCollections({ ids: directAncestorIds }, { maxResults: ES_MAX_RESULTS });
        const hasPublicationsResolver = new HasPublicationsResolver(this.publicationRepository, this.collectionRepository, this.logger);
        await Promise.all(directAncestors.map(ancestor => hasPublicationsResolver.resolveCollection(ancestor)));
    }

    async unpublish(
        binderId: string,
        languageCodes: string[],
        logAuditLog?: (
            binderId: string,
            accountId: string,
            publicationId: string,
            publishUpdateAction: PublishUpdateActionType,
            languageCode: string,
        ) => void,
        userId?: string,
    ): Promise<Array<PublicationSummary>> {
        const publicationRepo = this.publicationRepository;
        const publicationFilter = {
            binderId,
            isActive: 1
        } as BinderFilter;
        if (languageCodes && languageCodes.length > 0) {
            publicationFilter.languageCodes = languageCodes;
        }
        const savedPublications = await publicationRepo.find(publicationFilter, { maxResults: 150 }) as Publication[];
        let accountId: string | undefined;
        if (savedPublications.length > 0) {
            accountId = savedPublications[0].accountId;
            savedPublications.forEach(pub => {
                pub.isActive = false;
                pub.unpublishDate = new Date();
                pub.ancestorIds = null;
            });
            this.trackingServiceContract.multiInsertUserAction(
                savedPublications.map(publication => this.getUnpublishAction(publication, userId)),
                accountId
            );
            savedPublications.forEach(publication => {
                logAuditLog?.(
                    binderId,
                    publication.accountId,
                    publication.id,
                    PublishUpdateActionType.UNPUBLISHED_DOCUMENT,
                    publication.language.iso639_1,
                );
            });
            await publicationRepo.bulk(savedPublications, [], true);
        } else {
            throw new NothingToUnpublish(binderId, languageCodes[0]);
        }
        await this.verifyAncestorsStillHavePublications(binderId);
        if (accountId) {
            this.publicItemsCache.invalidateForAccount(accountId);
        }
        return publicationRepo.find({ binderId, isActive: 1 }, { maxResults: ES_MAX_RESULTS }) as Promise<Array<PublicationSummary>>;
    }

    private getUnpublishAction(publication: Publication, userId: string): IUserAction<IUserActionPublishData> {
        const eventDate = new Date();
        return {
            data: {
                binderId: publication.binderId,
                publicationId: publication.id,
                languageCode: publication.language.iso639_1,
            },
            accountId: publication.accountId,
            userId,
            userActionType: UserActionType.DOCUMENT_UNPUBLISHED,
            start: eventDate,
            end: eventDate,
        };
    }

    async setPublicationsShowInOverview(binderId: string, showInOverview: boolean, userId: string): Promise<PublicationSummary[]> {
        const binderFilter = {
            binderId,
            isActive: 1
        };
        const [activePublications, binder] = await Promise.all([
            this.publicationRepository.find(binderFilter, { maxResults: 150 }),
            this.bindersRepository.getBinder(binderId)
        ]);
        // Without explicitly grating public read access, it won't appear in overview
        await this.authorizationContract.grantPublicReadAccess(binder.accountId, binderId);
        await this.updateBinder({ ...binder, showInOverview: showInOverview }, userId);
        if (activePublications.length > 0) {
            activePublications.forEach(publication => publication.showInOverview = showInOverview);
            await this.publicationRepository.bulk(activePublications, [], "wait_for");
        }
        return await this.publicationRepository.find(binderFilter, { maxResults: 250 }) as PublicationSummary[];
    }

    updatePublicationsLanguages(binderId: string, languageCode: string, order: string[]): Promise<Array<PublicationSummary>> {
        const publicationRepo = this.publicationRepository;
        const publicationFilter = {
            binderId,
            isActive: 1,
        };
        const orderObject = order.reduce((obj, o, i) => ({ ...obj, [o]: i }), {});
        return publicationRepo.find(publicationFilter, { maxResults: 150 }).then((allPublications: Publication[]) => {
            if (allPublications.length === 0) {
                return allPublications;
            }
            const updatedPublications = allPublications.map(publication => {
                const pub = setMasterLanguage(publication, publication.language.iso639_1 === languageCode)
                return setPriorityForPublication(pub, orderObject[publication.language.iso639_1]);
            }
            );
            // // deep copy of the object
            const updatedPublicationsCopy = JSON.parse(JSON.stringify(updatedPublications));

            return publicationRepo.bulk(updatedPublications, []).then((result: { errors: string }) => {
                if (result["errors"]) {
                    this.logger.error(result["errors"], "publications-update");
                    return [];
                }
                // case we delete the ID within the bulk
                return updatedPublicationsCopy;
            });
        });
    }

    private async getDomainCollectionFilter(filter: PublicationFilter): Promise<PublicationFilter> {
        if (!filter.domain) {
            return filter;
        }
        const domainAccounts = await this.routingServiceContract.getAccountIdsForDomain(filter.domain);
        const domainCollection = (await this.getRootCollections(domainAccounts))
            .map(collection => collection.id);
        return Object.assign({}, filter, { domainCollection });
    }

    private async filterChildrenOfHiddenAncestor(items: Story[], accountId?: string) {
        const features = accountId ?
            await this.accountServiceContract.getAccountFeatures(accountId) :
            [];
        if (!features.includes(FEATURE_COLLECTION_HIDE)) {
            return items;
        }
        return items.reduce(async (prev, item) => {
            const previous = await prev;
            const itemId = item["binderId"] || item.id;
            const result = await this.checkIfHiddenInAncestors(itemId);
            // to be sure it is boolean
            if (result === false) {
                previous.push(item);
            }
            return previous;
        }, Promise.resolve([] as Story[]));
    }

    private async getAccountIdAndRequestingUserId(domain?: string, userId?: string): Promise<{ accountId: string, userId: string }> {
        if (!domain) {
            return Promise.resolve({
                accountId: undefined,
                userId,
            });
        }
        const [accountId] = await this.routingServiceContract.getAccountIdsForDomain(domain);
        let requestingUserId = undefined;
        if (userId) {
            requestingUserId = await this.normalizeRequestingUserId(userId, accountId);
        }
        return {
            accountId,
            userId: requestingUserId,
        };
    }

    private async normalizeRequestingUserId(userId: string, accountId: string): Promise<string> {
        // Check if the user is a member of the account they're trying to access. If not, return undefined as userId to force public view
        if (!userId) {
            return undefined;
        }
        const accounts = await this.accountServiceContract.getAccountsForUser(userId);
        const forcePublic = !accounts.some(a => a.id === accountId);
        return forcePublic ? undefined : userId;
    }

    async getPublication(publicationId: string, options: IItemSearchOptions = {}): Promise<Publication> {
        const skipPopulateVisuals = options && options.skipPopulateVisuals;
        const cdnnify = options ? options.cdnnify : undefined;
        let publication = await this.publicationRepository.getPublication(publicationId);
        if (!skipPopulateVisuals) {
            const urlTokens: { [id: string]: UrlToken } = await UrlToken.buildMany([publication.binderId], this.jwtConfig, 1);
            const urlToken = urlTokens[publication.binderId] && urlTokens[publication.binderId].key;
            const [transformedPub] = await multiTransformItems(
                [publication],
                [
                    this.buildInheritedThumbnailTransformer(),
                    this.buildImageFormatTransformer({ cdnnify, urlToken }),
                ]
            ) as Array<Publication>;
            publication = transformedPub;
        }
        return publication;
    }

    async createCollectionInCollection(
        accountId: string,
        collectionId: string,
        title: string,
        languageCode: string,
        thumbnail: IThumbnail,
        auth?: AuthenticatedSession,
    ): Promise<DocumentCollection> {
        const collection = await this.createCollection(accountId, title, languageCode, thumbnail, auth);
        await this.addElementToCollection(collectionId, "collection", collection.id, accountId);
        return collection;
    }

    private async createCollection(
        accountId: string,
        title: string,
        languageCode: string,
        thumbnail: IThumbnail,
        auth?: AuthenticatedSession,
    ): Promise<DocumentCollection> {
        const accountIds = await this.fetchAccountIdsFromUser(auth && auth.userId);

        const fail = (message: string) => {
            this.logger.error(message, "collection-create");
            throw new InvalidOperation(message);
        };
        if (!accountIds) {
            fail("Cannot create a new collection, no account id available for user.");
        }
        if (!accountId) {
            fail("Each new collection should have an account id");
        }
        if (!(accountIds.includes(accountId))) {
            fail("Can only create collections in your own account.");
        }
        const domainFilter = await this.getAccountDomainFilter(accountId);
        const { domain, domainCollectionId } = domainFilter ?? {};
        const collection = await this.collectionRepository.createCollection(
            accountId,
            { title, languageCode },
            thumbnail,
            false,
            domainCollectionId
        );
        await this.ensureSemanticLinksForItem(collection, DocumentType.COLLECTION, [languageCode], domain);
        this.logItemEvent(EventType.ITEM_CREATED, collection, auth.userId);
        captureServerEvent(ServerEvent.CollectionCreated, {
            accountId,
            userId: auth?.userId as string,
        }, { itemId: collection.id });
        return collection;
    }

    private async getAccountDomainFilter(accountId: string): Promise<DomainFilter | undefined> {
        const [domainFilter] = await this.routingServiceContract.getDomainFiltersForAccounts([accountId]);
        return domainFilter;
    }

    private logItemEvent(type: EventType, item: Binder | DocumentCollection, userId: string): void {
        this.logEventAsync({
            eventType: type,
            accountId: item.accountId,
            data: {
                itemId: item.id,
                itemKind: isCollectionItem(item) ? ItemKind.Collection : ItemKind.Binder,
                itemTitle: isCollectionItem(item) ? extractTitle(item) : undefined
            },
            userId: userId,
        }, userId);
    }

    async createCollectionBackend(
        accountId: string,
        title: string,
        languageCode: string,
        thumbnail: IThumbnail,
        domainCollectionId: string,
    ): Promise<DocumentCollection> {
        return this.collectionRepository.createCollection(accountId, { title, languageCode }, thumbnail, false, domainCollectionId);
    }

    async fetchAccountIdsFromUser(userId: string): Promise<string[]> {
        if (!userId) {
            return [];
        }
        const accounts = await this.accountServiceContract.getAccountsForUser(userId);
        return accounts.map(account => account.id);
    }

    async createRootCollection(accountId: string, accountName: string): Promise<DocumentCollection> {
        const title = accountName;
        const thumbnail = {
            medium: DEFAULT_COVER_IMAGE,
            bgColor: "#fff",
            fitBehaviour: "fit"
        };
        const domainFilters = await this.routingServiceContract.getDomainFiltersForAccounts([accountId]);
        const domainCollectionId = domainFilters.length > 0 ? domainFilters.pop().domainCollectionId : undefined;
        const collection = await this.collectionRepository.createCollection(accountId, { title, languageCode: "en" }, thumbnail, true, domainCollectionId);
        if (domainCollectionId !== undefined) {
            return collection;
        }
        collection.domainCollectionId = collection.id;
        return this.collectionRepository.updateCollection(collection);
    }

    async saveCollectionTitle(collectionId: string, title: string, languageCode: string): Promise<DocumentCollection> {
        const collection = await this.collectionRepository.patchCollection(collectionId, coll => setTitle(coll, languageCode, title));
        const domainFilters = await this.routingServiceContract.getDomainFiltersForAccounts([collection.accountId]);
        const domainFilter = domainFilters.length > 0 ? domainFilters.pop() : undefined;
        const domain = domainFilter?.domain;
        await this.ensureSemanticLinksForItem(collection, DocumentType.COLLECTION, [languageCode], domain);
        return collection;
    }

    updateLanguageOfCollectionTitle(collectionId: string, currentLanguageCode: string, languageCode: string): Promise<DocumentCollection> {
        return this.collectionRepository.patchCollection(
            collectionId,
            collection => updateLanguageTitle(collection, currentLanguageCode, languageCode));
    }

    async removeCollectionTitle(domain: string, collectionId: string, languageCode: string): Promise<DocumentCollection> {
        const deletedCollection = await this.collectionRepository.patchCollection(collectionId, coll => removeTitle(coll, languageCode));
        this.routingServiceContract.deleteSemanticLinks({ domain, binderId: collectionId, languageCode });
        return deletedCollection;
    }

    async updateCollectionIsHidden(collectionId: string, isHidden: boolean): Promise<DocumentCollection> {
        const updatedCollection = await this.collectionRepository.patchCollection(
            collectionId,
            collection => updateIsHidden(collection, isHidden),
        );
        for (const { key } of updatedCollection.elements) {
            await this.ancestorBuilder.flushCache(key);
        }
        return updatedCollection;
    }

    updateCollectionThumbnail(collectionId: string, thumbnail: IThumbnail): Promise<DocumentCollection> {
        return this.collectionRepository.patchCollection(collectionId, coll => updateThumbnail(coll, thumbnail));
    }

    async removeCollectionThumbnail(
        collectionId: string,
        options: IGetCollectionQueryOptions
    ): Promise<DocumentCollection> {
        const newThumbnail = createDefaultCoverThumbnail();
        let collection = await this.updateCollectionThumbnail(collectionId, newThumbnail);

        if (options?.inheritAncestorThumbnails) {
            const [item] = await this.buildInheritedThumbnailTransformer().items([collection]);
            collection = item as DocumentCollection;
        }
        if (options?.cdnifyThumbnails) {
            const [item] = await this.buildImageFormatTransformer({ cdnnify: true, thumbnailsOnly: true })
                .items([collection]);
            collection = item as DocumentCollection;
        }

        return collection;
    }

    async updateCollectionShowInOverview(collectionId: string, showInOverview: boolean): Promise<DocumentCollection> {
        const updatedCollection = await this.collectionRepository.patchCollection(
            collectionId,
            collection => updateShowInOverview(collection, showInOverview),
        );
        // Without explicitly grating public read access, it won't appear in overview
        await this.authorizationContract.grantPublicReadAccess(updatedCollection.accountId, collectionId);
        for (const { key } of updatedCollection.elements) {
            await this.ancestorBuilder.flushCache(key);
        }
        return updatedCollection;
    }

    private async updateItemAncestorIds(itemId: string) {
        const items = await this.multiRepository.getItemsById([itemId]);
        if (items.length === 0) return;
        const [item] = items;

        const documentAncestors = await this.getAncestors(itemId);
        const ancestorIds = getAllParentsFromDocumentAncestors(itemId, documentAncestors).reverse();

        if (isDocumentCollection(item)) {
            await this.collectionRepository.updateCollection({ ...item, ancestorIds });
        } else if (isBinder(item)) {
            await this.bindersRepository.updateBinder({ ...item, ancestorIds });
        } else {
            throw new Error(`Item ${itemId} is neither a binder nor a collection`);
        }
    }

    private async updatePublicationsAncestorIdsByBinderIds(binderIds: string[]) {
        const publications = await this.findPublicationsBackend({ binderIds, isActive: 1 }, { maxResults: 9999, summary: true });
        const binderIdsWithPublications = uniq(publications.map(p => p.binderId));

        if (binderIdsWithPublications.length === 0) return;

        const documentAncestors = await this.getItemsAncestors(binderIdsWithPublications);

        const updates: Partial<Publication>[] = publications.map(publication => ({
            id: publication.id,
            binderId: publication.binderId,
            ancestorIds: getAllParentsFromDocumentAncestors(publication.binderId, documentAncestors)
        }));

        await this.publicationRepository.bulk(updates, [], true);
    }

    async addElementToCollection(collectionId: string, kind: string, key: string, accountId: string): Promise<DocumentCollection> {
        await this.ensureNoInstancesAtDestination(collectionId, key, kind);
        const ancestors = await this.getAncestors(collectionId);
        if (Object.keys(ancestors).some(ancestorsKey => ancestors[ancestorsKey].indexOf(key) >= 0)) {
            throw new CircularPathError();
        }
        const uniqueAncestors = getUniqueAncestorsArray(ancestors, [key]);
        if (kind === "collection") {
            const { hasPublications } = await this.collectionRepository.getCollection(key);
            if (hasPublications !== false) {
                await this.markAncestorsHavePublications(uniqueAncestors);
            }
        } else {
            const publishedBinders = await this.publicationRepository.filterPublicationlessBinders([key]);
            if (publishedBinders.length === 1) {
                await this.markAncestorsHavePublications(uniqueAncestors);
            }
        }
        this.publicItemsCache.invalidateForAccount(accountId);
        const updatedCollection = await this.collectionRepository.patchCollection(collectionId, coll => addCollectionElement(coll, kind, key)).then(collection => {
            return this.ancestorBuilder.flushCache(key).then(() => collection);
        });
        await this.invalidateItemAndDescendents(key, kind as "collection" | "document", "onDelete");
        if (kind === "collection") {
            const allChildrenIncludingCollection = await this.collectionRepository.recursivelyGetDescendants(key, false);
            for (const child of Object.keys(allChildrenIncludingCollection)) {
                await this.updateItemAncestorIds(child);
            }
            await this.updatePublicationsAncestorIdsByBinderIds(Object.keys(allChildrenIncludingCollection));
        } else {
            await this.updateItemAncestorIds(key);
            await this.updatePublicationsAncestorIdsByBinderIds([key]);
        }
        return updatedCollection;
    }

    private async ensureNoInstancesAtDestination(destinationCollectionId: string, key: string, kind: string) {
        const destinationCollection = await this.collectionRepository.getCollection(destinationCollectionId);
        if (destinationCollection.elements.some(element => element.key === key && element.kind === kind)) {
            throw new ItemInstanceAlreadyInCollectionError();
        }
    }

    async removeElementFromCollection(collectionId: string, kind: string, itemToRemoveId: string, accountId: string, permanent?: boolean): Promise<DocumentCollection> {
        const collection = await this.collectionRepository.getCollection(collectionId);
        const updatedCollection: DocumentCollection = removeCollectionElement(collection, kind, itemToRemoveId, permanent);
        const itemToRemoveExists = (await this.multiRepository.findItems({ ids: [itemToRemoveId] }, { maxResults: 1 })).length === 1;
        const occurrencesLeft = updatedCollection.elements.some(e => e.key === itemToRemoveId);
        if (itemToRemoveExists && !occurrencesLeft) {
            const ancestors = await this.getAncestors(itemToRemoveId);
            if (ancestors[itemToRemoveId].length <= 1) {
                throw new WillNotOrphan();
            }
        }
        const savedCollection = await this.collectionRepository.updateCollection(updatedCollection);
        await this.ancestorBuilder.flushCache(itemToRemoveId);
        await this.verifyAncestorsStillHavePublications(collectionId, true);
        this.publicItemsCache.invalidateForAccount(accountId);
        await this.invalidateItemAndDescendents(itemToRemoveId, kind as "collection" | "document", "onDelete");

        return savedCollection;
    }

    private async invalidateItemAndDescendents(
        itemId: string,
        kind: "collection" | "document",
        action: "onDelete" | "onUpdate" | "onCreate"
    ) {
        if (kind === "document") {
            await this.invalidator[action]([{
                name: "document",
                documentId: itemId
            }])
        }
        const descendantsMap = await this.collectionRepository.buildDescendantsMap(itemId);
        const descendants: CollectionElement[] = flatten(Object.values(descendantsMap));

        const invalidateEvents = descendants.map<DocumentInvalidateEvent | CollectionInvalidateEvent>(descendant => ({
            name: descendant.kind === "collection" ? "collection" : "document",
            collectionId: descendant.key,
            documentId: descendant.key
        }));
        await this.invalidator[action](invalidateEvents);
    }

    changeElementPosition(collectionId: string, kind: string, key: string, newPosition: number): Promise<DocumentCollection> {
        return this.collectionRepository.patchCollection(collectionId, coll =>
            changeCollectionElementPosition(coll, kind, key, newPosition)
        );
    }

    findCollections(
        filter: CollectionFilter,
        options: BinderSearchResultOptions,
    ): Promise<Array<DocumentCollection>> {
        return this.collectionRepository.findCollections(filter, options);
    }

    findCollectionsFromClient(
        filter: CollectionFilter,
        options: BinderSearchResultOptions,
        userId?: string,
    ): Promise<Array<DocumentCollection>> {
        const permissionFilter: ItemFilterFunction<Item> = {
            process: async (collections: DocumentCollection[]) => {
                const allowedIds = await filterItemIdsByPermission(
                    collections.map(c => c.id),
                    PermissionName.VIEW,
                    this.authorizationContract,
                    this.ancestorBuilder,
                    collections[0].accountId,
                    userId
                );
                return collections.filter(c => allowedIds.has(c.id));
            },
            batchProcessing: true,
        };
        return this.collectionRepository.findCollections(filter, options, permissionFilter as ItemFilterFunction<DocumentCollection>);
    }

    async getCollectionsElements(colIds: string[], recursive = false, acc: CollectionElement[] = []): Promise<CollectionElement[]> {
        if (colIds.length === 0) {
            return acc;
        }
        const elementsObject = await this.collectionRepository.getCollectionsElements(colIds);
        const elementsArray = Object.keys(elementsObject).reduce((acc, k) => {
            return [...acc, ...elementsObject[k]];
        }, []);
        if (!recursive) {
            return elementsArray;
        }
        const collectionsInElements = elementsArray.filter(({ kind }) => kind === "collection").map(({ key }) => key);
        return await this.getCollectionsElements(collectionsInElements, recursive, [...acc, ...elementsArray]);
    }

    async getCollectionInfo(collectionId: string): Promise<ICollectionInfo> {
        const collection = await this.collectionRepository.getCollection(collectionId);
        const collectionElementIds = collection.elements.filter(el => el.kind === "collection").map(el => el.key);
        const childCollectionSummaries = await this.getChildCollectionSummaries(collectionElementIds);
        const childCollectionSummariesMap = childCollectionSummaries.reduce((out, info) => {
            return { ...out, [info.collectionId]: info };
        }, {});
        return {
            collection,
            childCollectionSummaries: childCollectionSummariesMap,
        };
    }

    async getChildCollectionSummaries(collectionsIds: string[]): Promise<ICollectionSummary[]> {
        const collectionElementsMap = await this.collectionRepository.getCollectionsElements(collectionsIds);
        const splitedCollectionsAndDocumentsMap = Object.keys(collectionElementsMap).reduce((acc, colId) => {
            let elements = collectionElementsMap[colId];
            if (!elements) {
                elements = Object.keys(collectionElementsMap).reduce((out, key) => {
                    return [...out, ...collectionElementsMap[key]];
                }, [] as CollectionElement[]);
            }
            const collections = elements.filter(el => (el && el.kind === "collection"));
            const documents = elements.filter(el => (el && el.kind === "document"));
            acc[colId] = { documents: documents.map(document => document.key), collections: collections.map(col => col.key) };
            return acc;
        }, {} as { [collectionId: string]: { documents: string[], collections: string[] } });

        const allDocs = flatten(Object.keys(splitedCollectionsAndDocumentsMap).map(colId => splitedCollectionsAndDocumentsMap[colId].documents));
        const publishedDocuments = await this.publicationRepository.filterPublicationlessBinders(
            allDocs
        );

        const results = Object.keys(splitedCollectionsAndDocumentsMap).map((colId: string) => {
            const elem = splitedCollectionsAndDocumentsMap[colId];
            const publishedDocs = intersection(elem.documents, publishedDocuments);
            return {
                collectionId: colId,
                collections: elem.collections.length,
                publishedDocuments: publishedDocs.length,
                unpublishedDocuments: elem.documents.length - publishedDocs.length,
            };
        });

        return Promise.all(results)
    }

    async getCollection(
        collectionId: string,
        options?: IGetCollectionQueryOptions
    ): Promise<DocumentCollection> {
        const collection = await this.collectionRepository.getCollection(collectionId);
        const elementKeys = collection.elements.map(el => el.key);
        const idsOfMultiOccurrences = await this.collectionRepository.getIdsOfMultiElements(elementKeys);
        collection.elements = collection.elements.map(el => { return { ...el, isInstance: idsOfMultiOccurrences.indexOf(el.key) !== -1 }; });

        let result = collection;
        if (options?.inheritAncestorThumbnails) {
            const [item] = await this.buildInheritedThumbnailTransformer().items([result]);
            result = item as DocumentCollection;
        }
        if (options?.cdnifyThumbnails) {
            const [item] = await this.buildImageFormatTransformer({ cdnnify: true, thumbnailsOnly: true }).items([result]);
            result = item as DocumentCollection;
        }
        return result;
    }

    getDocumentResourceDetails(documentId: string): Promise<DocumentResourceDetails> {
        return this.multiRepository.getBinderOrCollection(documentId).then(doc => {
            return this.getAncestors(doc.id).then(ancestorDocuments => {
                return {
                    id: documentId,
                    accountId: doc.accountId,
                    ancestorDocuments
                };
            });
        });
    }

    async getDocumentResourceDetailsArray(documentIds: string[]): Promise<DocumentResourceDetails[]> {
        const resources = await this.multiRepository.getItemsById(documentIds);
        const ancestors = await this.getItemsAncestors(documentIds);
        const result = resources.reduce((prev, res) => {
            return [
                ...prev,
                {
                    id: res.id,
                    accountId: res.accountId,
                    ancestorDocuments: ancestors,
                },
            ];
        }, []);
        return Promise.resolve(result);
    }

    async getAncestors(id: string): Promise<DocumentAncestors> {
        const ans = await this.ancestorBuilder.getAncestors([id]);
        return ans.toDocumentAncestors(false);
    }

    async getItemsAncestors(itemIds: string[]): Promise<DocumentAncestors> {
        const ans = await this.ancestorBuilder.getAncestors(itemIds);
        return ans.toDocumentAncestors(false);
    }

    async getDescendantsMap(collectionId: string): Promise<IDescendantsMap> {
        return await this.collectionRepository.buildDescendantsMap(collectionId);
    }

    async checkIfHiddenInAncestors(id: string): Promise<boolean> {
        const ancestors = await this.ancestorBuilder.getAncestors([id]);
        return !hasAtLeastOneVisibleParentPath(ancestors, [id], []);
    }

    private async fetchResourceGroupIdsWithViewPermission(
        accountId: string,
        userId?: string,
        skipCache = false,
    ): Promise<{ id: string, isPublic?: boolean }[]> {
        const fetchUserResourceGroup = async () => userId ?
            this.authorizationContract.findAllowedResourceGroups(userId, ResourceType.DOCUMENT, PermissionName.VIEW, true, accountId, skipCache) :
            [] as ResourceGroup[];

        const fetchPublicResourceGroup = async () => {
            const permissionMaps = await this.authorizationContract.findPublicResourceGroups(ResourceType.DOCUMENT, [PermissionName.VIEW], [accountId], skipCache);
            return permissionMaps[0]?.resources ?? [];
        };

        const [userResourceGroups, publicResourceGroups] = await Promise.all([
            fetchUserResourceGroup(),
            fetchPublicResourceGroup()
        ]);
        const userResourceGroupIds = this.extractResourceGroupIds(userResourceGroups);
        const publicResourceGroupIds = this.extractResourceGroupIds(publicResourceGroups);

        return [
            ...without(userResourceGroupIds, publicResourceGroupIds).map(id => ({ id, isPublic: true })),
            ...userResourceGroupIds.map(id => { return { id, isPublic: false }; }),
        ];
    }

    private extractResourceGroupIds(resourceGroups: ResourceGroup[]) {
        const resourceGroupIds = resourceGroups.flatMap(resourceGroup => resourceGroup.ids);
        return uniq(resourceGroupIds);
    }

    async expandResourceGroupsForReader(
        idInfos: Array<{ id: string, isPublic?: boolean }>,
        filter: ItemFilter,
    ): Promise<ICollectionElementsWithInfo> {
        if (idInfos.length === 0) {
            return Promise.resolve({
                items: [],
                languagesUsed: [],
            });
        }
        if (filter.domain) {
            if (filter.domain !== "staging-reader.dev.binders.media" &&
                filter.domain !== "localhost") {
                const domainFilter = await this.routingServiceContract.getDomainFilterByDomain(filter.domain);
                if (!domainFilter) {
                    this.logger.error(`No domain filter found for domain ${filter.domain}`, "get-domainfilter");
                    throw new NonExistingDomainFilter(filter.domain);
                }
                const domainCollectionId = domainFilter ? domainFilter.domainCollectionId : undefined;
                if (domainCollectionId) {
                    filter.domainCollection = domainCollectionId;
                }
            }
            else {
                delete filter.domain;
            }
        }
        const publicationFilter = Object.assign({}, filter, { binderIds: idInfos.map(idInfo => idInfo.id), isActive: 1 });
        const collectionFilter = Object.assign({}, filter, { ids: idInfos.map(idInfo => idInfo.id) });
        const options = {
            maxResults: 2000
        };
        const [pubsWithInfo, collections] = await Promise.all([
            this.publicationRepository.findWithInfo(publicationFilter, options),
            this.collectionRepository.findCollections(collectionFilter, options)
        ]);
        const { publications, languagesUsed: pubsLanguagesUsed } = pubsWithInfo;
        const languagesUsedInCollections = collections.reduce((langs, col) => {
            return uniq(langs.concat(...col.titles.map(t => t.languageCode)));
        }, [] as string[]);
        const languagesUsed = uniq([...pubsLanguagesUsed, ...languagesUsedInCollections]);
        const allResults = (<Array<PublicationFindResult | DocumentCollection>>publications).concat(collections);
        const filteredResults = allResults.reduce((reduced, item) => { // public ids that do not have showInOverview set, are not returned
            const idToMatch = item["binderId"] || item.id;
            if (idInfos.some(idInfo => idInfo.id === idToMatch && idInfo.isPublic === true)) {
                if (!item["showInOverview"] || item["isHidden"]) {
                    return reduced;
                }
            }
            return reduced.concat(item);
        }, []);
        return {
            items: filteredResults,
            languagesUsed,
            accountHasPublications: filteredResults.length > 0 ? true : await this.doesDomainHavePublications(filter.domain)
        };
    }

    private async ensureCollectionIdForScope(readScope: ReadScope): Promise<string> {
        const { domain, scope } = readScope;
        try {
            await this.collectionRepository.getCollection(scope);
            return scope;
        } catch (err) {
            if (err.status !== 404) {
                throw err;
            }
        }
        const links = await this.routingServiceContract.getSemanticLinkById(domain, scope);
        if (links.length !== 1) {
            const prefix = links.length === 0 ? "No" : "Multiple";
            this.logger.error(`${prefix} semantic links for scope ${readScope.scope} on ${readScope.domain}`, "read-scope");
            return undefined;
        }
        return links[0].binderId;
    }

    async filterItemsByScope(allItems: { id: string }[], scope: ReadScope | undefined): Promise<{ id: string }[]> {
        if (!scope) {
            return allItems;
        }
        const collectionId = await this.ensureCollectionIdForScope(scope);
        if (!collectionId) {
            return [];
        }
        const ancestors = await this.ancestorBuilder.getAncestors(allItems.map(({ id }) => id));
        function isInScope(id: string) {
            const itemAncestorIds = ancestors.get(id).map(({ id }) => id);
            if (itemAncestorIds.length === 0) {
                return false;
            }
            if (any(
                id => id === collectionId,
                itemAncestorIds
            )) {
                return true;
            }
            return any(
                isInScope,
                itemAncestorIds
            )
        }
        return allItems.filter(({ id }) => isInScope(id));
    }

    async findReaderItemsWithInfo(
        filter: ReaderItemsFilter,
        options: IItemSearchOptions,
        userId?: string,
    ): Promise<ICollectionElementsWithInfo> {
        const { cdnnify, skipPopulateVisuals, readerScope, skipCache } = options;
        if (!filter.domain) {
            throw new Error("Domain is required when fetching reader items.");
        }
        const readScope: ReadScope = readerScope ?
            {
                domain: filter.domain,
                scope: readerScope
            } :
            undefined;
        const { accountId, userId: requestingUserId } = await this.getAccountIdAndRequestingUserId(filter.domain, userId);
        const resourceGroupIds = await this.fetchResourceGroupIdsWithViewPermission(accountId, requestingUserId, skipCache);
        const resourcesInScope = await this.filterItemsByScope(resourceGroupIds, readScope);
        const pubInfo = await this.expandResourceGroupsForReader(resourcesInScope, filter);
        const { items: unfilteredItems, languagesUsed } = pubInfo;
        const items = await this.filterChildrenOfHiddenAncestor(unfilteredItems, accountId);
        const permissionFilter = {
            process: async (items: Array<Publication | DocumentCollection>) => {
                const allowedIds = await filterItemIdsByPermission(
                    items.map(item => (<Publication>item).binderId ?? item.id),
                    PermissionName.VIEW,
                    this.authorizationContract,
                    this.ancestorBuilder,
                    accountId,
                    requestingUserId,
                    false,
                    skipCache,
                );
                return items.filter(item => allowedIds.has(isCollectionItem(item) ? item.id : item.binderId));
            },
            batchProcessing: true,
        };
        const itemsWithPublications = items.filter(item => item["hasPublications"] !== false);
        let filteredItems = await applyBatchItemFilters([permissionFilter.process], itemsWithPublications) as Story[];
        if (!skipPopulateVisuals) {
            const itemsTransformers = [
                this.buildInheritedThumbnailTransformer(),
                this.buildImageFormatTransformer({ cdnnify, thumbnailsOnly: true }),
            ];
            filteredItems = await multiTransformItems(filteredItems, itemsTransformers) as Story[];
        }
        return {
            items: filteredItems,
            languagesUsed,
            accountHasPublications: itemsWithPublications.length > 0 ? true : (await this.doesAccountHavePublications(accountId))
        };
    }

    async doesDomainHavePublications(domain: string): Promise<boolean> {
        if (!domain) {
            return false;
        }
        const [accountId] = await this.routingServiceContract.getAccountIdsForDomain(domain);
        return this.doesAccountHavePublications(accountId);
    }

    async doesAccountHavePublications(accountId: string): Promise<boolean> {
        if (!accountId) {
            return false;
        }
        const rootColFilter: CollectionFilter = { rootCollections: [accountId] };
        const rootColOptions: BinderSearchResultOptions = { maxResults: 2000 };
        const [rootCollection] = await this.findCollections(rootColFilter, rootColOptions);
        const hasPublicationsResolver = new HasPublicationsResolver(this.publicationRepository, this.collectionRepository, this.logger);
        return hasPublicationsResolver.resolveCollection(rootCollection);
    }

    async getAccountTotals(accountId: string): Promise<AccountTotals> {
        const [collectionCount, documentCount] = await Promise.all([
            this.collectionRepository.countCollections(accountId),
            this.bindersRepository.countBinders(accountId)
        ]);
        return {
            documentCount,
            collectionCount
        };
    }

    async translate(
        accountId: string,
        html: string,
        sourceLanguageCode: string,
        targetLanguageCode: string,
        isHtml = false,
        interfaceLanguage?: string
    ): Promise<string> {
        const accountSettings = await this.accountServiceContract.getAccountSettings(accountId);
        return this.translator
            .withPreferredEngine(sourceLanguageCode, targetLanguageCode, accountSettings.mt)
            .translate(html, sourceLanguageCode, targetLanguageCode, isHtml, interfaceLanguage);
    }

    async getTranslationsAvailable(skipCache = false): Promise<IAzureTranslation[]> {
        return this.translator.getSupportedLanguages(skipCache);
    }

    async getSupportedLanguagesByEngine(skipCache = false): Promise<{ [engineType: string]: string[] }> {
        return this.translator.getSupportedLanguagesByEngine(skipCache);
    }

    async detectLanguage(html: string): Promise<string> {
        return this.translator.detectLanguage(html)
    }

    async getMostUsedLanguages(accountIds: string[]): Promise<string[]> {
        const accountIdsCsv = accountIds.join(",");
        const cachedLanguages = await this.mostUsedLanguagesCache.getMostUsedLanguages(accountIdsCsv);
        if (cachedLanguages) {
            return cachedLanguages;
        }
        const binderLanguages = await this.bindersRepository.getMostUsedLanguages(accountIds);
        const collectionLanguages = await this.collectionRepository.getMostUsedLanguages(accountIds);
        for (const colKey of Object.keys(collectionLanguages)) {
            if (binderLanguages[colKey]) {
                binderLanguages[colKey] = binderLanguages[colKey] + collectionLanguages[colKey];
            } else {
                binderLanguages[colKey] = collectionLanguages[colKey];
            }
        }
        const languages = Object.keys(binderLanguages);
        languages.sort((a, b) => binderLanguages[b] - binderLanguages[a]);
        await this.mostUsedLanguagesCache.setMostUsedLanguages(accountIdsCsv, languages);
        return languages;
    }

    async createOrUpdateFeedback(accountId: string, publicationId: string, feedbackParams: FeedbackParams, userId?: string): Promise<IBinderFeedback> {
        const publication = await this.publicationRepository.getPublication(publicationId);
        if (!publication) throw new Error(`Missing publication ${publicationId}`);

        if (feedbackParams.message) {
            feedbackParams.message = new HtmlSanitizer(this.logger, FEEDBACK_COUNTER_LABEL).sanitizeHtml(feedbackParams.message);
        }

        const existingFeedbackForPublication = userId && await this.feedbackRepository.getFeedbackByPublicationUser(publicationId, userId);
        if (existingFeedbackForPublication != null) {
            captureServerEvent(ServerEvent.RatingUpdated, {
                accountId,
                userId
            }, {
                publicationId,
                binderId: publication.binderId,
                rating: feedbackParams.rating,
                message: feedbackParams.message,
            });
            return this.feedbackRepository.updateFeedback({
                id: existingFeedbackForPublication.id,
                ...feedbackParams,
            });
        } else {
            captureServerEvent(ServerEvent.RatingCreated, {
                accountId,
                userId
            }, {
                publicationId,
                binderId: publication.binderId,
                rating: feedbackParams.rating,
                message: feedbackParams.message,
            })
            return this.feedbackRepository.createFeedback(
                accountId,
                publication.binderId,
                publicationId,
                userId,
                feedbackParams,
            );
        }
    }

    async getMostRecentPublicationUserFeedback(publicationId: string, userId?: string): Promise<IBinderFeedback | null> {
        if (userId == null) throw new Unauthorized("Missing userId");
        const publication = await this.publicationRepository.getPublication(publicationId);
        if (!publication) {
            throw new PublicationNotFound(`Missing publication ${publicationId}`);
        }
        const feedbacks = await this.feedbackRepository.getBinderUserFeedbacksOrderedDesc(publication.binderId, userId);

        const exactPublicationFeedback = feedbacks.find(feedback => feedback.publicationId === publicationId);
        if (exactPublicationFeedback != null) {
            return exactPublicationFeedback;
        }
        return this.findMostRecentFeedbackForLanguage(feedbacks, publication.language.iso639_1, new Date(publication.publicationDate));
    }

    private async findMostRecentFeedbackForLanguage(
        orderedFeedbacks: BinderFeedbackModel[],
        publicationLanguage: string,
        publicationDate: Date,
    ): Promise<IBinderFeedback | null> {
        const orderedFeedbacksBeforePublicationDate = orderedFeedbacks
            .filter(feedback => isBefore(feedback.created, publicationDate));
        if (orderedFeedbacksBeforePublicationDate.length === 0) {
            return null;
        }
        const publications = await this.publicationRepository.find({
            ids: orderedFeedbacksBeforePublicationDate.map(feedback => feedback.publicationId),
            languageCodes: [publicationLanguage]
        }, { maxResults: 1000 });
        const publicationIds = publications
            .map(pub => pub.id)
            .reduce((aggregator, pub) => aggregator.add(pub), new Set<string>());
        return orderedFeedbacksBeforePublicationDate
            .find(feedback => publicationIds.has(feedback.publicationId)) ?? null;
    }

    async getBinderFeedbacks(binderId: string): Promise<IBinderFeedback[]> {
        const feedbacks = await this.feedbackRepository.getBinderFeedbacks(binderId);
        const userIds = feedbacks
            .filter(feedback => !feedback.isAnonymous)
            .reduce((res, feedback) => res.add(feedback.userId), new Set<string>());
        const users = await this.userServiceContract.findUserDetailsForIds(Array.from(userIds));
        const usersById = users.reduce((byId, user) => byId.set(user.id, user), new Map<string, User>());
        const anonymizedUserIds = feedbacks.reduce((res, f) => {
            if (!res.has(f.userId)) {
                res.set(f.userId, `anonymous-${res.size}`);
            }
            return res;
        }, new Map<string, string>());
        return feedbacks.map(feedback => {
            const user = usersById.get(feedback.userId);
            if (!user || feedback.isAnonymous) return {
                ...feedback,
                userId: anonymizedUserIds.get(feedback.userId),
            };
            return {
                ...feedback,
                userName: getUserName(user),
                userLogin: user.login,
            }
        });
    }

    async exportBinderFeedbacks(binderId: string): Promise<ExportedBinderFeedback[]> {
        const allBinderFeedbacks = await this.getBinderFeedbacks(binderId);
        return allBinderFeedbacks.map(this.asExportedBinderFeedback);
    }

    private asExportedBinderFeedback = (feedback: IBinderFeedback): ExportedBinderFeedback => ({
        Id: feedback.id,
        BinderId: feedback.binderId,
        PublicationId: feedback.publicationId,
        UserLogin: feedback.isAnonymous ? "" : feedback.userLogin,
        UserName: feedback.isAnonymous ? "" : feedback.userName,
        Message: feedback.message ?? null,
        Rating: feedback.rating ?? null,
        CreatedDate: feedback.created.toISOString(),
        UpdatedDate: feedback.updated.toISOString(),
    });

    async approveChunk(
        binderId: string,
        chunkId: string,
        chunkLastUpdate: number,
        languageCode: string,
        approval: ApprovedStatus,
        userId?: string,
        auditLog?: AuditLogUpdateApprovalFn,
    ): Promise<IChunkApproval[]> {
        await this.approvalRepository.upsertChunkApproval(
            binderId,
            chunkId,
            chunkLastUpdate,
            languageCode,
            approval,
            userId,
        );
        const binder = await this.getBinder(binderId);
        auditLog(binderId, binder.accountId, chunkId, chunkLastUpdate, languageCode, approval);
        return this.approvalRepository.listChunkApprovalsForBinder(binderId);
    }

    async updateChunkApprovals(
        binderId: string,
        filter: ChunkApprovalFilter,
        approvalStatus: ApprovedStatus,
        userId?: string,
        auditLog?: AuditLogUpdateApprovalFn,
    ): Promise<IChunkApproval[]> {
        const { chunkIndices } = filter;
        const binder = await this.getBinder(binderId);
        const binderObject = createBinder(binder);
        const chunkIds = chunkIndices.map(index => chunkIdFromIndex(binderObject, index));
        const updatedChunkApprovals = await this.approvalRepository.updateChunkApprovals(
            binderId,
            { ...filter, chunkIds },
            { approved: approvalStatus },
            userId,
        );
        for (const chunkApproval of updatedChunkApprovals) {
            auditLog(binderId, binder.accountId, chunkApproval.chunkId, chunkApproval.chunkLastUpdate, chunkApproval.chunkLanguageCode, approvalStatus);
        }
        return this.approvalRepository.listChunkApprovalsForBinder(binderId);
    }

    async fetchApprovalsForBinder(binderId: string): Promise<IChunkApproval[]> {
        return this.approvalRepository.listChunkApprovalsForBinder(binderId);
    }

    async saveChecklistActivation(
        binderId: string,
        chunkId: string,
        isActive: boolean,
        userId?: string
    ): Promise<IChecklistConfig> {
        return this.checklistConfigRepository.saveChecklistActivation(binderId, chunkId, isActive, userId)
    }

    async getChecklistConfigs(binderId: string): Promise<IChecklistConfig[]> {
        return this.checklistConfigRepository.getChecklistsConfig(binderId)
    }

    async getMultiChecklistConfigs(binderIds: string[]): Promise<IChecklistConfig[]> {
        return this.checklistConfigRepository.getChecklistsConfigs(binderIds);
    }

    async getChecklistsActions(
        binderOrCollectionIds: string[]
    ): Promise<IChecklistAction[]> {
        const descendantsMap = await this.collectionRepository.recursivelyGetDescendants(
            binderOrCollectionIds[0],
            false
        );
        const descendants = Object.keys(descendantsMap);

        return await this.checklistRepository.getChecklistActions(descendants);
    }

    async getChecklists(binderId: string): Promise<IChecklist[]> {
        const checklists = await this.checklistRepository.getChecklists(binderId, false)
        const userIds = this.getUserIdsFromChecklistHistory(checklists)
        if (userIds.length > 0) {
            const displayNamesMap = await this.getUserDisplayNames(userIds)
            return checklists.map(checklist => {
                return {
                    ...checklist,
                    performedHistory: checklist.performedHistory.map((history) => ({ ...history, lastPerformedByUserName: displayNamesMap[history.lastPerformedByUserId] }))
                }
            })
        }
        return checklists
    }

    private async getChecklistSteps(binderId: string) {
        const checklistConfigs = await this.checklistConfigRepository
            .getChecklistsConfigs([binderId], false);
        const publications = await this.findPublications(
            binderId,
            {
                binderId,
                isActive: 1,
            },
            {
                includeTotalPublicDocumentsCount: false,
                skipInstanceDetermination: true,
                skipPopulateVisuals: true,
                binderSearchResultOptions: {
                    maxResults: 1
                },
            }
        );
        if (publications.length === 0) {
            return null;
        }
        const publication = publications[0] as Publication;

        const chunkIdsWithChecklistSet = new Set(checklistConfigs.map(c => c.chunkId));

        const binderLogs = publication.binderLog.current;
        const logsWithChecklist = binderLogs.filter(log => chunkIdsWithChecklistSet.has(log.uuid));
        const sortedLogs = [...logsWithChecklist].sort((a, b) => a.position - b.position);

        return sortedLogs.reduce<Record<string, number>>((map, log, index) => {
            map[log.uuid] = index;
            return map;
        }, {});
    }

    async togglePerformed(
        id: string,
        performed: boolean,
        binderId: string,
        publicationId: string,
        userId?: string
    ): Promise<IChecklist> {
        if (!userId) {
            throw new Unauthorized("Cannot toggle checklist item (unauthenticated)")
        }
        const checklist = await this.checklistRepository.getChecklistById(id);
        const checklistSteps = await this.getChecklistSteps(binderId);
        if (performed === checklist.performed) {
            throw new ChecklistAlreadyInThatStateError(
                await this.addChecklistDisplayNames(checklist)
            );
        }

        const updatedChecklist = await this.checklistRepository.togglePerformed(
            id,
            performed,
            userId,
            checklistSteps[checklist.chunkId] ?? null,
            publicationId
        );
        await this.maybeResetTasks(updatedChecklist.binderId);
        return this.addChecklistDisplayNames(updatedChecklist);
    }

    private async addChecklistDisplayNames(checklist: IChecklist) {
        const userIds = this.getUserIdsFromChecklistHistory([checklist]);
        if (userIds.length === 0) return checklist;
        const displayNamesMap = await this.getUserDisplayNames(userIds)
        return {
            ...checklist,
            performedHistory: checklist.performedHistory.map((history) => (
                { ...history, lastPerformedByUserName: displayNamesMap[history.lastPerformedByUserId] }
            ))
        }
    }

    private async maybeResetTasks(binderId: string) {
        const checklists = await this.checklistRepository.getChecklists(binderId, false);
        const allTasksPerformed = checklists.every(chk => chk.performed);

        if (allTasksPerformed) {
            const checklistSteps = await this.getChecklistSteps(binderId);
            this.checklistRepository.resetPerformedTasks(binderId, checklistSteps);
        }
    }

    async getChecklistsProgress(binderIds: string[]): Promise<IChecklistProgress[]> {
        return this.checklistRepository.getChecklistProgress(binderIds)
    }

    private getUserIdsFromChecklistHistory(checklists: IChecklist[]): string[] {
        const userIds = new Set<string>();
        for (const checklist of checklists) {
            for (const historyItem of checklist.performedHistory) {
                if (historyItem.lastPerformedByUserId != null) {
                    userIds.add(historyItem.lastPerformedByUserId);
                }
            }
        }
        return Array.from(userIds);
    }

    private async getUserDisplayNames(userIds: string[]) {
        const userDetails = await this.userServiceContract.findUserDetailsForIds(userIds)
        return userDetails.reduce((acc, curr) => {
            acc[curr.id] = curr.displayName || curr.login
            return acc
        }, {})
    }

    async invalidatePublicItemsForAccount(accountId: string): Promise<void> {
        return this.publicItemsCache.invalidateForAccount(accountId);
    }

    async getAccountAncestorTree(accountId: string, user?: AuthenticatedSession): Promise<AncestorTree> {
        const [rootCollection] = await this.getRootCollections([accountId], user);
        if (rootCollection === undefined) {
            throw new Error(`Root collection for account ${accountId} not found.`);
        }
        return buildAncestorTree(this.collectionRepository, rootCollection.id);
    }

    // shouldAddPublicationPossibilities - for language l,
    // so we know if there is at least one document with something to publish in l
    // and if there is at least one document that can have active publication unpublished in language l
    async getLanguageCodesUsedInCollection(collectionId: string, shouldAddPublicationPossibilities?: boolean): Promise<LanguageSummary[]> {
        const omitRoot = true
        const descendantsMap = await this.collectionRepository.buildDescendantsMap(collectionId, omitRoot)
        const descendantBinderIds = idsFromDescendantsMap(descendantsMap, "document");
        if (descendantBinderIds.length > 0) {

            if (shouldAddPublicationPossibilities) {
                return this.bindersRepository.getLanguagesUsedInBindersWithPublicationInfo(descendantBinderIds, this.publicationRepository)
            }
            return this.bindersRepository.getLanguagesUsedInBinders(descendantBinderIds)
        }
        return [];
    }

    private async addTitleToRecursiveErrors(errors: RecursiveOperationError[]) {
        const faultyBinderIds = Array.from(new Set(errors.map(({ itemId }) => itemId)));
        const faultyBinders = await this.findBindersBackend({ binderIds: faultyBinderIds }, { maxResults: MAXIMUM_NUMBER_OF_ITEMS });
        const titleMap = getBinderTitleMap(faultyBinders as Binder[]);
        return errors.map((error: RecursiveOperationError) => ({
            ...error,
            itemTitle: !error.itemTitle ? titleMap[error.itemId] : error.itemTitle
        })) as RecursiveOperationError[]
    }

    async recursivePublish(
        collectionId: string,
        languageCodes: string[],
        accountId: string,
        userId?: string,
        userIsBackend?: boolean,
        logAuditLog?: (
            binderId: string,
            accountId: string,
            publicationId: string,
            publishUpdateAction: PublishUpdateActionType,
            languageCode: string,
        ) => void,
    ): Promise<RecursiveOpeartionResult<PublicationSummary>> {
        if (!userId) {
            throw new Unauthorized("Missing userId.");
        }
        const userForLock = userIsBackend ?
            { id: "uid-backend", login: "backend", displayName: "backend" } as User :
            await this.userServiceContract.getUser(userId);
        try {
            const { valid, errors } = await this.recursiveActionsValidator.validateRecursivePublish(collectionId)
            if (!valid) {
                return {
                    errors,
                    results: []
                }
            }
            this.lockItemForRecursiveAction(accountId, collectionId, "..", true, userForLock);
            const descendantsMap = await this.collectionRepository.buildDescendantsMap(collectionId, true)
            const descendants = flattenDescendants(descendantsMap);
            const bindersIds = descendants.filter(el => el.kind === "document").map(el => el.key)
            const results: PublicationSummary[] = []
            const publicationErrors: RecursiveOperationError[] = []
            for (const binderId of bindersIds) {
                const existingPublicationFilter = getExistingPublicationFilter(binderId, languageCodes)
                const existingPublications = await this.publicationRepository.find(existingPublicationFilter, { maxResults: 150 })
                for (const languageCode of languageCodes) {
                    try {
                        const publicationSummaries = await this.publish(
                            binderId,
                            [languageCode],
                            false,
                            userId,
                            logAuditLog,
                            existingPublications
                        );
                        results.push(...publicationSummaries.filter(pub => pub.language.iso639_1 === languageCode));
                    } catch (err) {
                        this.logger.error(`Error during recursive publish: ${err}`, "recursive-publish")
                        if (err.name === MissingLanguage.name) {
                            const languageCode = (err as MissingLanguage).languageCode
                            if (languageCode !== UNDEFINED_LANG) {
                                publicationErrors.push({ itemId: binderId, error: RecursiveErrors.MISSING_LANGUAGE, languageCode, isBinder: true })
                            }
                        }
                        else if (err.name === InvalidPublication.name) {
                            publicationErrors.push({ itemId: binderId, error: RecursiveErrors.INVALID_PUBLICATION, languageCode, isBinder: true })
                        }
                        else if (err.name === MissingTitle.name) {
                            publicationErrors.push({ itemId: binderId, error: RecursiveErrors.MISSING_TITLE, languageCode, isBinder: true })
                        }
                        else if (err.name === NothingToPublish.name) {
                            publicationErrors.push({ itemId: binderId, error: RecursiveErrors.NOTHING_TO_PUBLISH, languageCode, isBinder: true })
                        }
                        else if (err.name === MissingApprovals.name) {
                            publicationErrors.push({ itemId: binderId, error: RecursiveErrors.MISSING_APPROVALS, languageCode, isBinder: true })
                        }
                        else {
                            publicationErrors.push({ itemId: binderId, error: RecursiveErrors.UNKNOWN_ERROR, languageCode, isBinder: true })
                        }
                    }
                }
            }

            if (publicationErrors.length > 0) {
                try {
                    const errors = await this.addTitleToRecursiveErrors(publicationErrors);
                    return { results, errors, totaldocumentsInSubtree: bindersIds.length }
                } catch (error) {
                    this.logger.error(`Unexpected error during recursive translate: ${errors}`, "recursive-translate")
                    return {
                        errors: publicationErrors,
                        results,
                        totaldocumentsInSubtree: bindersIds.length,
                    }
                }
            }
            return { results, errors: [], totaldocumentsInSubtree: bindersIds.length }
        } catch (ex) {
            this.logger.error(`Unexpected error during recursive publish: ${ex}`, "recursive-publish")
            throw ex
        } finally {
            this.releaseItemForRecursiveAction(accountId, collectionId, undefined, false, userForLock);
        }
    }

    async recursiveUnpublish(
        collectionId: string,
        languageCodes: string[],
        accountId: string,
        userId?: string,
        logAuditLog?: (
            binderId: string,
            accountId: string,
            publicationId: string,
            publishUpdateAction: PublishUpdateActionType,
            languageCode: string,
        ) => void): Promise<RecursiveOpeartionResult<RecursiveUnpublishSummaryResult>> {
        if (!userId) {
            throw new Unauthorized("Unknown user.");
        }
        const user = await this.userServiceContract.getUser(userId);
        try {
            const { valid, errors } = await this.recursiveActionsValidator.validateRecursiveUnpublish(collectionId)
            if (!valid) {
                return {
                    errors,
                    results: [],
                    totaldocumentsInSubtree: 0,
                }
            }
            if (user) {
                this.lockItemForRecursiveAction(accountId, collectionId, "..", true, user);
            }
            const descendantsMap = await this.collectionRepository.buildDescendantsMap(collectionId, true)
            const descendants = flattenDescendants(descendantsMap)
            const bindersIds = descendants.filter(el => el.kind === "document").map(el => el.key)
            const results: RecursiveUnpublishSummaryResult[] = []
            const publicationErrors: RecursiveOperationError[] = []

            for (const binderId of bindersIds) {
                try {
                    const publicationSummaries = await this.unpublish(binderId, languageCodes, logAuditLog, userId);
                    if (publicationSummaries.filter(pub => languageCodes.includes(pub.language.iso639_1)).length === 0) {
                        results.push(...languageCodes.map(l => ({ binderId, languageCode: l })))
                    }
                } catch (err) {
                    this.logger.error(`Error during recursive unpublish: ${err}`, "recursive-unpublish")

                    if (err.name === NothingToUnpublish.name) {
                        const languageCode = (err as NothingToUnpublish).languageCode
                        publicationErrors.push({ itemId: binderId, error: RecursiveErrors.NOTHING_TO_UNPUBLISH, languageCode, isBinder: true })
                    } else {
                        publicationErrors.push({ itemId: binderId, error: RecursiveErrors.UNKNOWN_ERROR, isBinder: true })
                    }
                }
            }

            if (publicationErrors.length > 0) {
                try {
                    const errors = await this.addTitleToRecursiveErrors(publicationErrors);
                    return { results, errors, totaldocumentsInSubtree: bindersIds.length }
                } catch (error) {
                    this.logger.error(`Unexpected error during recursive translate: ${errors}`, "recursive-translate")
                    return {
                        errors: publicationErrors,
                        results,
                        totaldocumentsInSubtree: bindersIds.length,
                    }
                }
            }

            return {
                errors: [],
                results,
                totaldocumentsInSubtree: bindersIds.length,
            }
        } catch (ex) {
            this.logger.error(`Unexpected error during recursive unpublish: ${ex}`, "recursive-unpublish")
            throw ex;
        } finally {
            if (user) {
                this.releaseItemForRecursiveAction(accountId, collectionId, undefined, false, user);
            }
        }
    }

    lockItemForRecursiveAction(accountId: string, targetItemId: string, redirectCollectionId: string, restrictRedirectionToComposer: boolean, user: User): void {
        this.handleRecursiveActionEditLocking(accountId, targetItemId, redirectCollectionId, restrictRedirectionToComposer, user, ServiceNotificationType.ITEM_LOCKED);
    }

    releaseItemForRecursiveAction(accountId: string, targetItemId: string, redirectCollectionId: string, restrictRedirectionToComposer: boolean, user: User): void {
        this.handleRecursiveActionEditLocking(accountId, targetItemId, redirectCollectionId, restrictRedirectionToComposer, user, ServiceNotificationType.ITEM_RELEASED);
    }

    handleRecursiveActionEditLocking(
        accountId: string,
        targetItemId: string,
        redirectCollectionId: string,
        restrictRedirectionToComposer: boolean,
        user: User,
        serviceNotificationType: ServiceNotificationType.ITEM_LOCKED | ServiceNotificationType.ITEM_RELEASED,
    ): void {
        const redirectionPolicy: IRedirectionPolicy = {
            targetItemId,
            redirectCollectionId,
            restrictRedirectionToComposer,
        };

        const serviceNotificationBody: ItemLock | ItemRelease = serviceNotificationType === ServiceNotificationType.ITEM_LOCKED ?
            {
                itemId: targetItemId,
                user: {
                    id: user.id,
                    login: user.login,
                    displayName: user.displayName,
                },
                redirectionPolicy,
                lockVisibleByInitiator: true,
                windowId: processId
            } :
            {
                itemId: targetItemId,
                userId: user.id,
                redirectionPolicy,
                lockVisibleByInitiator: true,
                windowId: processId
            };

        this.notificationServiceClient.dispatch(
            {
                type: RoutingKeyType.ACCOUNT,
                value: accountId,
            },
            serviceNotificationType,
            serviceNotificationBody,
        )
    }

    async recursiveDelete(
        collectionId: string,
        accountId: string,
        parentCollectionId?: string,
        userId?: string,
    ): Promise<RecursiveOpeartionResult<RecursiveDeleteSummaryResult>> {
        if (!userId) {
            throw new Unauthorized("Unknown user.");
        }
        const user = await this.userServiceContract.getUser(userId);
        try {
            const { valid, errors } = await this.recursiveActionsValidator.validateRecursiveDelete(collectionId)
            if (!valid) {
                return {
                    errors,
                    results: [],
                    totaldocumentsInSubtree: 0,
                }
            }
            if (user) {
                this.lockItemForRecursiveAction(accountId, collectionId, "..", false, user);
            }
            const results: RecursiveDeleteSummaryResult[] = [];
            const descendantsMap = await this.collectionRepository.buildDescendantsMap(collectionId, true)
            const descendants = flattenDescendants(descendantsMap)
            const bindersIds = descendants.filter(el => el.kind === "document").map(el => el.key)
            const collectionIds = descendants
                .filter(el => el.kind === "collection")
                .map(el => el.key)
                .reverse()

            const deleteErrors: RecursiveOperationError[] = []
            for (const binderId of bindersIds) {
                let deletedBinder: Binder;
                try {
                    deletedBinder = await this.deleteBinder(
                        binderId,
                        accountId,
                        false,
                        userId,
                        undefined,
                        collectionId
                    );
                    results.push({ binderId });
                } catch (err) {
                    this.logger.error(`Error during recursive delete: ${err}`, "recursive-delete")
                    if (err.name === BinderHasPublicationError.name) {
                        deleteErrors.push({ itemId: binderId, error: RecursiveErrors.BINDER_HAS_PUBLICATIONS, isBinder: true, itemTitle: getBinderMasterLanguage(deletedBinder)?.storyTitle })
                    } else {
                        deleteErrors.push({ itemId: binderId, error: RecursiveErrors.UNKNOWN_ERROR, isBinder: true, itemTitle: getBinderMasterLanguage(deletedBinder)?.storyTitle })
                    }
                }
            }

            for (const id of [...collectionIds, collectionId]) {
                let deletedCollection: DocumentCollection;
                try {
                    deletedCollection = await this.deleteCollection(
                        id,
                        accountId,
                        userId,
                        collectionId,
                        id === collectionId ? bindersIds.length + collectionIds.length + 1 : undefined
                    );
                } catch (err) {
                    this.logger.error(`Error during recursive delete: ${err}`, "recursive-delete")
                    if (err.name === CollectionNotEmpty.name) {
                        deleteErrors.push({ itemId: id, error: RecursiveErrors.COLLECTION_NOT_EMPTY, isBinder: false, itemTitle: deletedCollection?.titles[0].title })
                    } else {
                        deleteErrors.push({ itemId: id, error: RecursiveErrors.UNKNOWN_ERROR, isBinder: false, itemTitle: deletedCollection?.titles[0].title })
                    }
                }
            }
            return {
                errors: deleteErrors,
                results: results,
                totaldocumentsInSubtree: bindersIds.length,
            }
        } catch (ex) {
            this.logger.error(`Unexpected error during recursive delete: ${ex}`, "recursive-delete")
            throw ex
        } finally {
            if (user) {
                this.releaseItemForRecursiveAction(accountId, collectionId, parentCollectionId, false, user);
            }
        }
    }

    async recursiveTranslate(
        collectionId: string,
        targetLanguageCode: string,
        accountId: string,
        userId?: string,
    ): Promise<RecursiveOpeartionResult<Binder>> {
        if (!userId) {
            throw new Unauthorized("Unknown user.");
        }
        const user = await this.userServiceContract.getUser(userId);
        try {
            const { valid, errors } = await this.recursiveActionsValidator.validateRecursiveTranslate(collectionId)
            if (!valid) {
                return {
                    errors,
                    results: [],
                    totaldocumentsInSubtree: 0,
                }
            }
            this.lockItemForRecursiveAction(accountId, collectionId, "..", true, user);
            const descendantsMap = await this.collectionRepository.buildDescendantsMap(collectionId, true)
            const descendants = flattenDescendants(descendantsMap)
            const bindersIds = descendants.filter(el => el.kind === "document").map(el => el.key);
            const collectionIds = [collectionId, ...descendants.filter(el => el.kind !== "document").map(el => el.key)];
            const binders = await this.findBindersBackend({ binderIds: bindersIds }, { maxResults: MAXIMUM_NUMBER_OF_ITEMS });

            const collections = await this.findCollections({
                ids: collectionIds,
            }, {
                maxResults: MAXIMUM_NUMBER_OF_ITEMS
            });

            const translateErrors = []
            const translatedItems = []


            for (let i = 0; i < collections.length; i++) {
                const collection = collections[i];
                const collectionTitle = collection.titles;
                if (collectionTitle.length === 1 && collectionTitle[0].languageCode === UNDEFINED_LANG) {
                    translateErrors.push({ itemId: collection.id, error: RecursiveErrors.MASTER_LANGUAGE_NOT_SET, isBinder: false, itemTitle: collectionTitle[0]?.title });
                } else {
                    const translatedCollection = await this.translateCollection(collection, targetLanguageCode);
                    translatedItems.push(translatedCollection);
                }
            }

            const BATCH_SIZE = 10
            while (binders.length > 0) {
                const bindersBatch = binders.splice(0, BATCH_SIZE)
                const promiseTranslatedBinders = bindersBatch.map(async (binder: Binder) =>
                    this.translateBinder(accountId, binder as Binder, userId, targetLanguageCode))
                const translationResults = await Promise.allSettled(promiseTranslatedBinders)
                const successfullyTranslatedBinders = translationResults
                    .filter(result => result.status === "fulfilled")
                    .map((successfulResult: PromiseFulfilledResult<Binder>) => successfulResult.value)

                if (successfullyTranslatedBinders?.length > 0) {
                    translatedItems.push(...successfullyTranslatedBinders)
                }

                translationResults.map((translationResult, index) => {
                    const { status } = translationResult
                    if (status === "rejected") {
                        const err = (translationResult as PromiseRejectedResult).reason
                        this.logger.error(`Error during recursive translate, : ${err}`, "recursive-trasnlate")
                        const itemId = bindersBatch[index]?.id
                        if (!itemId) {
                            this.logger.error(`Can't get itemId for index: ${index} in batch ${bindersBatch}. Trasnalted results ${translationResults}`, "recursive-trasnlate")
                        }

                        if (err?.name === CogtnitiveAPITimeout.name) {
                            this.logger.error(`Timeout coginitive API during recursive translate, : ${err}`, "recursive-trasnlate")
                            translateErrors.push({ itemId, error: RecursiveErrors.COGNITIVE_API_TIMEOUT, isBinder: true });
                        }
                        else if (err?.name === MasterLanguageNotSet.name) {
                            this.logger.error(`MasterLanguageNotSet during recursive translate, : ${err}`, "recursive-trasnlate")
                            translateErrors.push({ itemId, error: RecursiveErrors.MASTER_LANGUAGE_NOT_SET, isBinder: true, languageCode: targetLanguageCode });
                        }
                        else if (err?.name === UnsupportedLanguageError.name) {
                            this.logger.error(`UnsupportedLanguageError during recursive translate, : ${err}`, "recursive-trasnlate")
                            translateErrors.push({ itemId, error: RecursiveErrors.UNSUPORTED_LANGUAGE, isBinder: true, languageCode: targetLanguageCode });
                        } else {
                            translateErrors.push({ itemId, error: RecursiveErrors.UNKNOWN_ERROR, isBinder: true });
                        }
                    }
                })

            }
            if (translateErrors.length > 0) {
                try {
                    const errors = await this.addTitleToRecursiveErrors(translateErrors);
                    return { results: translatedItems, errors, totalItemsInSubtree: bindersIds.length + collectionIds.length }
                } catch (error) {
                    this.logger.error(`Unexpected error during recursive translate: ${errors}`, "recursive-translate")
                    return {
                        errors: translateErrors,
                        results: translatedItems,
                        totaldocumentsInSubtree: bindersIds.length,
                    }
                }
            }
            return {
                errors: [],
                results: translatedItems,
                totaldocumentsInSubtree: bindersIds.length,
            }
        } catch (ex) {
            this.logger.error(`Unexpected error during recursive translate: ${ex}`, "recursive-translate")
            throw (ex);
        } finally {
            this.releaseItemForRecursiveAction(accountId, collectionId, undefined, false, user);
        }

    }

    async validateRecursiveAction(collectionId: string, operation: RecursiveAction): Promise<ValidationResult> {
        switch (operation) {
            case RecursiveAction.DELETE:
                return this.recursiveActionsValidator.validateRecursiveDelete(collectionId)
            case RecursiveAction.PUBLISH:
                return this.recursiveActionsValidator.validateRecursivePublish(collectionId)
            case RecursiveAction.UNPUBLISH:
                return this.recursiveActionsValidator.validateRecursiveUnpublish(collectionId)
            case RecursiveAction.TRANSLATE:
                return this.recursiveActionsValidator.validateRecursiveTranslate(collectionId)
            default:
                throw new InvalidRecursiveActionOpeartion(operation)
        }
    }


    private async translateCollection(collection: DocumentCollection, targetLanguageCode: string): Promise<DocumentCollection> {
        if (collection.titles.length === 1 && collection.titles[0].languageCode === UNDEFINED_LANG) {
            throw new MasterLanguageNotSet();
        }

        const sourceLanguageCode = collection.titles[0]?.languageCode;
        if (sourceLanguageCode) {
            const translateFn = this.translator.translate.bind(this.translator)
            const translatedCollectionTitle = await translateCollectionTitle(collection, sourceLanguageCode, targetLanguageCode, translateFn);
            return this.saveCollectionTitle(collection.id, translatedCollectionTitle, targetLanguageCode);
        } else {
            throw new MasterLanguageNotSet();
        }

    }

    private async translateBinder(
        accountId: string,
        binder: Binder,
        userId: string,
        targetLanguageCode: string
    ): Promise<Binder> {
        const calledFromServer = true
        const bumpContentVersion = true
        const editorStates = deserializeEditorStatesForTranslate(binder, calledFromServer);
        let binderObject = createBinder(editorStates);
        const targetLanguageWasDeleted = binderObject.isLanguageDeleted(targetLanguageCode);

        const firstLanguage = binderObject.getFirstLanguage()
        if (firstLanguage?.iso639_1 === UNDEFINED_LANG && firstLanguage?.priority === 0) {
            throw new MasterLanguageNotSet()
        }
        const targetLang = binderObject.getLanguageByIso(targetLanguageCode)
        if (!targetLang) {
            const missingLanguagePatch = addMissingLanguage(binderObject, targetLanguageCode)
            const toBinderUpdate = curriedMultiUpdate([missingLanguagePatch], bumpContentVersion, binderObject)
            const serializedBinder = serializeEditorStates(toBinderUpdate, calledFromServer)
            const updatedBinder = await this.updateBinder(serializedBinder, userId)
            const updatedEditorStates = deserializeEditorStatesForTranslate(updatedBinder, calledFromServer);
            binderObject = createBinder(updatedEditorStates);
        }

        const sourceLanguageCode = firstLanguage?.iso639_1;

        const accountSettings = await this.accountServiceContract.getAccountSettings(accountId);
        const translateFn = this.translator.withPreferredEngine(sourceLanguageCode, targetLanguageCode, accountSettings.mt).translate.bind(this.translator);
        const translatePatch = await translateTitle(
            binderObject,
            sourceLanguageCode,
            targetLanguageCode,
            translateFn,
            targetLanguageWasDeleted
        )
        const patches: UpdatePatchFn[] = []
        if (translatePatch) {
            patches.push(translatePatch)
        }
        const targetModuleKey = targetLang?.modules[0] || binderObject.getLanguageByIso(targetLanguageCode).modules[0]
        const params = {
            binderObject,
            sourceModuleKey: firstLanguage.modules[0],
            sourceLanguageCode,
            targetModuleKey,
            targetLanguageCode,

        }

        const patchFns = await translateChunks(
            params,
            translateFn,
            targetLanguageWasDeleted
        );
        if (patchFns?.length > 0) {
            patches.push(...patchFns)
        }

        if (patches?.length > 0) {
            const toBinderUpdate = curriedMultiUpdate(patches, bumpContentVersion, binderObject)
            const serializedBinder = serializeEditorStates(toBinderUpdate, calledFromServer)
            return this.updateBinder(serializedBinder, userId)
        }

        return binder
    }

    async getCustomerMetricsCsv(): Promise<string> {
        return await buildCustomerMetrics(this.accountServiceContract, this.trackingServiceContract);
    }

    async listAvailableTTSLanguages(): Promise<string[]> {
        const voices = await this.textToSpeech.fetchAvailableVoices();
        return voices.map(v => v.language);
    }

    async getSingleCustomerMetricsCsv(accountId: string): Promise<string> {
        return await buildCustomerMetrics(this.accountServiceContract, this.trackingServiceContract, "account", accountId);
    }

    async generateTextToSpeech(
        paragraphs: string[],
        voiceOptions: ITTSVoiceOptions
    ): Promise<ITTSGenerateResponse> {
        const id = TTSMeta.createId(voiceOptions.language, paragraphs);
        const fileName = id + ".mp3";
        const audioFileUrl = getAppRoutes()
            .fetchTextToSpeechFile
            .path
            .replace(":identifier", fileName);

        const existingFile = await this.ttsRepository.fetchTTSMeta(id);
        if (existingFile != null) {
            return {
                audioFileUrl,
                boundaries: existingFile.boundaries
            }
        }

        const boundaries = await this.textToSpeech.generateToFile(
            paragraphs,
            fileName,
            {
                voice: voiceOptions
            }
        );
        const storeFile = async () => {
            await this.audioStorage.uploadLocalFile(
                fileName,
                `${this.textToSpeech.getStoragePath()}/${fileName}`
            );
        }
        const storeMeta = async () => {
            const ttsFile = new TTSMeta(
                id,
                voiceOptions.language,
                paragraphs,
                boundaries,
                fileName
            )
            await this.ttsRepository.storeTTSMeta(ttsFile);
        }

        await Promise.all([
            storeFile(),
            storeMeta()
        ])

        return {
            audioFileUrl,
            boundaries
        }
    }

    async fetchTextToSpeechFile(
        fileName: string,
        response: Response
    ): Promise<void> {
        await this.audioStorage.streamToExpress(
            fileName,
            response
        );
    }

    private async recoverDeletedGroup(
        collection: DocumentCollection,
        newParentCollectionId: string
    ): Promise<void> {
        if (
            collection.deletedGroupCollectionId != null &&
            collection.id !== collection.deletedGroupCollectionId
        ) {
            throw new Error("Can only recover recursively deleted items from the top collection");
        }

        const parentCollection = await this.collectionRepository.getCollection(newParentCollectionId);
        const deletedItems = await this.multiRepository.findItems({
            deletedGroupCollectionId: collection.id,
            softDelete: {
                show: "show-deleted"
            }
        }, { maxResults: 9999 });

        const recoveredItems = [];
        for (const item of deletedItems) {
            if (isDocumentCollection(item)) {
                const recovered = await this.collectionRepository.recoverCollection(item);
                recoveredItems.push(recovered);
            } else if (isBinder(item)) {
                const recovered = await this.bindersRepository.recoverBinder(item);
                recoveredItems.push(recovered);
            } else {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                throw new Error(`Item with id ${(item as any).id} is neither a binder nor a collection.`);
            }
        }

        const recoveredItemsSet = new Set(recoveredItems.map(item => item.id));
        const recoveredCollections = recoveredItems.filter(isDocumentCollection);
        for (const item of recoveredCollections) {
            const deletedElements = item.deletedElements ?? [];
            const updatedCollection = {
                ...item,
                deletedElements: deletedElements.filter(
                    el => !recoveredItemsSet.has(el.key)
                ),
                elements: [
                    ...item.elements,
                    ...deletedElements.filter(el => recoveredItemsSet.has(el.key))
                ]
            }
            await this.collectionRepository.updateCollection(updatedCollection);
        }

        await this.removeAsCollectionElements(collection.id, { permanent: true, isColl: true });
        await this.collectionRepository.updateCollection(
            addCollectionElement(
                parentCollection,
                "collection",
                collection.id
            )
        );
    }

    async recoverDeletedItem(
        itemId: string,
        accountId: string,
        newParentCollectionId: string
    ): Promise<void> {
        const item = await this.multiRepository.getBinderOrCollection(itemId);
        if (item.deletionTime == null) return;
        const parentCollection = await this.collectionRepository.getCollection(newParentCollectionId);

        if (item.deletedGroupCollectionId != null) {
            return await this.recoverDeletedGroup(
                item as DocumentCollection,
                newParentCollectionId
            );
        }

        if (isDocumentCollection(item)) {
            await this.collectionRepository.recoverCollection(item);
        } else if (isBinder(item)) {
            await this.bindersRepository.recoverBinder(item);
        } else {
            throw new Error(`Error in validating item with id ${itemId}. Skipping restore`);
        }

        await this.removeAsCollectionElements(item.id, {
            permanent: true,
            isColl: isDocumentCollection(item)
        });

        await this.collectionRepository.updateCollection(
            addCollectionElement(
                parentCollection,
                isDocumentCollection(item) ? "collection" : "document",
                item.id
            )
        )
    }

    async relabelBinderLanguage(
        accountId: string,
        binderId: string,
        fromLanguageCode: string,
        toLanguageCode: string,
        userId: string,
    ): Promise<RelabelResult> {

        // Note: the relabeling of the language in the binder itself is handled by the handleBinderUpdate flow in the editor
        // This function takes care of effects of this change

        // Change language in publications
        const publications = await this.publicationRepository.find({ binderId, languageCodes: [fromLanguageCode] }, {
            maxResults: ES_MAX_RESULTS
        }) as Publication[];

        const updatedPublications = publications.map(pub => relabelPublicationLanguage(pub, toLanguageCode));
        if (updatedPublications.length > 0) {
            await this.publicationRepository.bulk(updatedPublications, [], true);
        }
        await this.commentThreadsRepository.changeThreadsLanguage(binderId, fromLanguageCode, toLanguageCode);
        await this.approvalRepository.changeApprovalsLanguage(binderId, fromLanguageCode, toLanguageCode);

        // Change language in semantic links
        const [domainFilter] = await this.routingServiceContract.getDomainFiltersForAccounts([accountId]);
        const semanticLinks = await this.routingServiceContract.relabelLanguageInSemanticLinks(
            domainFilter.domain,
            binderId,
            fromLanguageCode,
            toLanguageCode
        );

        // Raise a re-label event which will result in an update to the useractions via the event aggregations
        const relabelEvent: EventPayload = {
            eventType: EventType.RELABEL_LANGUAGE,
            accountId,
            userId,
            data: { itemId: binderId, fromLanguageCode, toLanguageCode }
        };
        this.logEventAsync(relabelEvent, userId);

        return {
            publications: updatedPublications,
            semanticLinks,
        };
    }

    private logEventAsync(event: EventPayload, userId: string): void {
        (async () => {
            try {
                await this.trackingServiceContract.log([event], userId);
            } catch (error) {
                this.logger.error("Failed to async log event", "log-event", { event, error });
            }
        })();
    }

    async purgeRecycleBins(): Promise<void> {
        const bindersToPurge = await this.bindersRepository.getItemsToPurge(MS_BEFORE_BIN_PURGE);
        const deletedGroups: Record<string, true> = {};
        for (const binder of bindersToPurge) {
            const { id, accountId } = binder;
            const deletedBinder = await this.deleteBinder(
                id,
                accountId,
                true,
                "uid-purge-bins",
                undefined,
                undefined,
                true
            );
            if (deletedBinder.deletedGroupCollectionId) {
                deletedGroups[deletedBinder.deletedGroupCollectionId] = true;
            }
            await this.trackingServiceContract.logAuditLog(
                AuditLogType.ITEM_HARD_DELETED,
                "uid-purge-bins",
                accountId,
                "backend",
                { binderId: id },
                "backend"
            );
        }
        const collectionsToPurge = await this.collectionRepository.getItemsToPurge(
            MS_BEFORE_BIN_PURGE
        );
        const accountIds = [];
        for (const collection of collectionsToPurge) {
            await this.removeAsCollectionElements(
                collection.id,
                { isColl: true, permanent: true }
            );
            const deletedColl = await this.collectionRepository.hardDeleteCollection(collection.id);
            if (deletedColl.deletedGroupCollectionId) {
                deletedGroups[deletedColl.deletedGroupCollectionId] = true;
            }
            await this.authorizationContract.removeResourceFromAcls(collection.id);
            accountIds.push(collection.accountId);
            await this.trackingServiceContract.logAuditLog(
                AuditLogType.ITEM_HARD_DELETED,
                "uid-purge-bins",
                collection.accountId,
                "backend",
                { collectionId: collection.id },
                "backend"
            );
        }

        await this.bindersRepository.permanentlyDeleteGroups(Object.keys(deletedGroups));
        await this.collectionRepository.permanentlyDeleteGroups(Object.keys(deletedGroups));

        const accountIdsNoDuplicates = this.removeDuplicatesFromStringArray(accountIds);
        accountIdsNoDuplicates.forEach(
            accountId => this.publicItemsCache.invalidateForAccount(accountId)
        );
    }

    private removeDuplicatesFromStringArray(stringArray: string[]) {
        const resultObj = stringArray.reduce<{ [key: string]: string }>(
            (obj, str) => assoc(str, str, obj),
            {}
        );
        return Object.values(resultObj);
    }

    async deleteAllForAccount(accountId: string): Promise<void> {
        if (accountId == null) throw new Error("AccountId is null");
        await this.multiRepository.deleteAllForAccount(accountId);
    }

    async requestReview(
        accountId: string,
        binderId: string,
        userId?: string
    ): Promise<void> {
        if (userId == null) throw new Error(`UserId cannot be null ${accountId} ${userId}`);
        const notification: ReviewRequestNotification = {
            kind: NotificationKind.REVIEW_REQUEST,
            accountId,
            itemId: binderId,
            actorId: userId
        };
        await this.notificationServiceClient.sendNotification(notification);
    }

    private async findApprovalStatusByBinder(binders: Binder[]): Promise<Record<string, BinderApprovalStatus>> {
        const binderIds = binders.map(b => b.id);
        const approvalStatusByBinder: Record<string, BinderApprovalStatus> = {};
        const approvals = await this.approvalRepository.findMostRecentChunkApprovals(
            binderIds,
            { onlyApprovals: [ApprovedStatus.APPROVED, ApprovedStatus.REJECTED] }
        );
        const approvalsByBinderId: Record<string, IChunkApproval[]> = groupBy(
            (ca: IChunkApproval) => ca.binderId,
            approvals
        );
        for (const binder of binders) {

            const visibleLanguages = createBinder(binder).getVisibleLanguages();
            const visibleLanguageCodes = visibleLanguages.map(l => l.iso639_1);
            const approvals = approvalsByBinderId[binder.id] ?? [];

            const chunkIdsInBinderSet = new Set<string>(binder.binderLog.current.map(log => log.uuid));
            const relevantApprovals = approvals
                .filter(a => chunkIdsInBinderSet.has(a.chunkId))
                .filter(a => visibleLanguageCodes.includes(a.chunkLanguageCode));

            if (relevantApprovals.length === 0) {
                approvalStatusByBinder[binder.id] = BinderApprovalStatus.EMPTY;
                continue;
            }

            const hasRejects = relevantApprovals.some(a => a.approved === ApprovedStatus.REJECTED);
            if (hasRejects) {
                approvalStatusByBinder[binder.id] = BinderApprovalStatus.REJECTED;
                continue;
            }

            const totalChunkCount = countBinderChunks(binder) * visibleLanguages.length;
            const approvedChunks = relevantApprovals.filter(a => a.approved === ApprovedStatus.APPROVED);
            if (approvedChunks.length === totalChunkCount) {
                approvalStatusByBinder[binder.id] = BinderApprovalStatus.APPROVED;
                continue;
            }
            approvalStatusByBinder[binder.id] = BinderApprovalStatus.INCOMPLETE;
        }
        return approvalStatusByBinder;
    }

    private async findTitlesForAncestors(
        accountId: string,
        itemIds: string[]
    ): Promise<{ [itemId: string]: string }> {
        const uniqueItemIds = Array.from(new Set(itemIds));
        const collections = await this.findCollections({
            accountId,
            ids: uniqueItemIds,
        }, { maxResults: itemIds.length, summary: true });
        const titlesByCollectionId = {};
        for (const collection of collections) {
            titlesByCollectionId[collection.id] = extractTitle(collection);
        }
        return titlesByCollectionId;
    }

    private filterBinderStatuses(
        binderStatuses: BinderStatusForAccount[],
        params: FindBindersStatusesQueryParams = {},
    ): BinderStatusForAccount[] {
        const { maxResults, minCreationDate } = params;
        let filtered = binderStatuses;
        if (minCreationDate) {
            filtered = binderStatuses.filter(bs => bs.binderCreationDate ?
                !isBefore(new Date(bs.binderCreationDate), new Date(minCreationDate)) :
                true
            );
        }
        if (maxResults) {
            const max = parseInt(`${maxResults}`);
            if (!isNaN(max)) {
                filtered = filtered.slice(0, max);
            }
        }
        return filtered;
    }

    /**
     * Used by the public api
     */
    async findBindersStatuses(
        accountId: string,
        params: FindBindersStatusesQueryParams = {},
        userId?: string
    ): Promise<BinderStatus[]> {
        const allBinderStatusesForAccount = await this.binderStatusCacheRepository.findBinderStatuses({ accountId });
        const binderStatuses = this.filterBinderStatuses(allBinderStatusesForAccount, params);
        const allowedIds = await filterItemIdsByPermission(
            binderStatuses.map(bs => bs.id),
            PermissionName.VIEW,
            this.authorizationContract,
            this.ancestorBuilder,
            accountId,
            userId,
        );
        return binderStatuses.filter(bs => allowedIds.has(bs.id));
    }

    async calculateBindersStatuses(accountId: string): Promise<BinderStatusForAccount[]> {
        const accountFeatures = await this.accountServiceContract.getAccountFeatures(accountId);
        const binders = await this.bindersRepository.findPaginatedBindersViaScroll(
            { accountId },
            {},
            FIND_BINDERS_STATUSES_MAX_ALLOWED_RESULTS,
            undefined,
            binders => binders,
        );
        const binderIds = binders.map(binder => binder.id);

        const publications = await this.findPublicationsBackend({
            accountId,
            binderIds,
            isActive: 1,
            summary: true,
        }, {
            maxResults: FIND_BINDERS_STATUSES_MAX_ALLOWED_RESULTS,
            summary: true,
            omitContentModules: true
        }, {
            useScroll: true,
        }) as Publication[];

        const publicationsByBinderId: Record<string, Publication[]> = {};
        for (const publication of publications) {
            const binderId = publication.binderId;
            if (publicationsByBinderId[binderId] == null) {
                publicationsByBinderId[binderId] = [publication];
            } else {
                publicationsByBinderId[binderId].push(publication);
            }
        }

        const publishedLanguagesByBinderId: Record<string, string[]> = {};
        for (const publication of publications) {
            const binderId = publication.binderId;
            const language = publication.language.iso639_1;
            if (publishedLanguagesByBinderId[binderId] == null) {
                publishedLanguagesByBinderId[binderId] = [language];
            } else {
                publishedLanguagesByBinderId[binderId].push(language);
            }
        }

        const publicResourceGroups = await this.authorizationContract.findPublicResourceGroups(
            ResourceType.DOCUMENT,
            [PermissionName.VIEW],
            [accountId]
        );
        const resourceIds = flatten(publicResourceGroups.map(g => g.resources.map(r => r.ids)));
        const publicWithDescendants = await this.collectionRepository.recursivelyGetDescendants(resourceIds);
        const publicIdsSet = new Set<string>(Object.keys(publicWithDescendants));

        const documentAncestors = await this.getItemsAncestors(binders.map(b => b.id));
        const ancestorTitles = await this.findTitlesForAncestors(accountId, flatten(Object.values(documentAncestors)));

        let approvalStatusByBinder: Record<string, BinderApprovalStatus> = {};
        if (accountFeatures?.includes(FEATURE_APPROVAL_FLOW) && 3 < 10) {
            approvalStatusByBinder = await this.findApprovalStatusByBinder(binders);
        }
        const editorLocation = await getEditorLocationForAccount(this.routingServiceContract, accountId);

        const openThreads = await this.commentThreadsRepository.findUnresolvedThreads(binderIds)
        const openThreadCountByBinderId: Record<string, number> = {};
        for (const thread of openThreads) {
            if (openThreadCountByBinderId[thread.binderId] == null) {
                openThreadCountByBinderId[thread.binderId] = 0;
            }
            openThreadCountByBinderId[thread.binderId]++;
        }

        const bindersStatuses = binders.map<BinderStatusForAccount>(binder => {

            const textMetaModules = binder.modules.meta
                .filter(module => module.type === "text")
                .filter(module => !(module.isDeleted));
            const hasAnyDraft = textMetaModules.some(textMetaModule => {
                return hasDraft(
                    textMetaModules,
                    textMetaModule.iso639_1,
                    publicationsByBinderId[binder.id] ?? [],
                );
            });

            const lastPublicationDate = (publicationsByBinderId[binder.id] ?? []).reduce<Date>((latest, pub) => {
                if (latest == null) return pub.publicationDate;
                if (pub.publicationDate > latest) return pub.publicationDate;
                return latest;
            }, null);

            const parentCollections = buildAncestorsList(binder.id, documentAncestors).reverse();
            const parentTitles = parentCollections.reduce((titles, id, index) => {
                return {
                    ...titles,
                    [`parentTitle${index + 1}`]: ancestorTitles[id]
                };
            }, {});

            const publishedLanguages = publishedLanguagesByBinderId[binder.id] ?? [];
            const draftLanguages = createBinder(binder).getVisibleLanguages()
                .map(l => l.iso639_1)
                .filter(l => !publishedLanguages.includes(l));

            return {
                id: binder.id,
                ...parentTitles,
                title: extractTitle(binder),
                chunkCount: binder.modules.text.chunked[0].chunks.length,
                hasDraft: hasAnyDraft,
                lastModificationDate: getBinderLastModifiedDate(binder),
                lastPublicationDate,
                created: binder.created,
                approvalStatus: approvalStatusByBinder[binder.id],
                openThreadCount: openThreadCountByBinderId[binder.id] ?? 0,
                isPublic: publicIdsSet.has(binder.id),
                editorLink: `${editorLocation}/documents/${binder.id}`,
                publishedLanguages,
                draftLanguages,
                accountId,
                binderCreationDate: binder.created,
            };
        });
        await this.binderStatusCacheRepository.upsertBinderStatuses(bindersStatuses);
        return bindersStatuses;
    }

    /*
        Helper in summarizePublicationsForAccount and summarizeDraftsForAccount
        Given a binderId and ancestors info, returns a map of ancestorId -> ancestorTitle,
    */
    parentTitlesFromAncestors(
        binderId: string,
        ancestors: DocumentAncestors,
        ancestorTitles: { [itemId: string]: string }
    ): { [key: string]: string } {
        const parentCollections = buildAncestorsList(binderId, ancestors).reverse();
        return parentCollections.reduce((titles, id, index) => {
            return {
                ...titles,
                [`ParentTitle${index + 1}`]: ancestorTitles[id]
            };
        }, {});
    }

    public async summarizePublicationsForAccount(
        accountId: string,
        options: { skipAncestors?: boolean } = {},
    ): Promise<PublicationsSummaryItem[]> {
        const summaries: PublicationsSummaryItem[] = [];
        const editorLocation = await getEditorLocationForAccount(this.routingServiceContract, accountId);
        await this.publicationRepository.scrollPublicationsWithFilter(
            { isActive: 1, accountId },
            async (publications: Publication[]) => {

                let ancestors: DocumentAncestors;
                let ancestorTitles: { [itemId: string]: string };

                if (!options.skipAncestors) {
                    ancestors = await this.getItemsAncestors(publications.map(p => p.binderId));
                    ancestorTitles = await this.findTitlesForAncestors(accountId, flatten(Object.values(ancestors)));
                }

                const batchSummaries = publications.map((pub): PublicationsSummaryItem => {

                    let parentTitles = {};

                    if (!options.skipAncestors) {
                        parentTitles = this.parentTitlesFromAncestors(pub.binderId, ancestors, ancestorTitles);
                    }

                    let publicationDate: string;
                    if (typeof pub.publicationDate === "string") {
                        publicationDate = pub.publicationDate;
                    }
                    if (isDate(pub.publicationDate)) {
                        publicationDate = pub.publicationDate.toISOString();
                    }

                    return {
                        DocumentId: pub.binderId,
                        Title: pub.language.storyTitle,
                        Language: pub.language.iso639_1,
                        PublicationDate: publicationDate,
                        EditorLink: `${editorLocation}/documents/${pub.binderId}`,
                        ...parentTitles
                    };
                });
                summaries.push(...batchSummaries);
            }
        );
        return summaries;
    }

    public async summarizeDraftsForAccount(accountId: string): Promise<DraftSummaryItem[]> {
        const summaries: DraftSummaryItem[] = [];
        const editorLocation = await getEditorLocationForAccount(this.routingServiceContract, accountId);
        const publicationSummaries = await this.summarizePublicationsForAccount(accountId, { skipAncestors: true });

        await this.bindersRepository.scrollBindersWithFilter(
            { accountId },
            async (binders: Binder[]) => {
                const ancestors = await this.getItemsAncestors(binders.map(b => b.id));
                const ancestorTitles = await this.findTitlesForAncestors(accountId, flatten(Object.values(ancestors)));
                for (const binder of binders) {

                    const parentTitles = this.parentTitlesFromAncestors(binder.id, ancestors, ancestorTitles);

                    const draftSummaries = binder.modules.meta
                        .filter(m => !m.isDeleted && m.type === "text" && m.iso639_1)
                        .reduce((acc, languageMetaModule) => {
                            const langCode = languageMetaModule.iso639_1;
                            if (hasDraftInSummaries(
                                binder.id,
                                languageMetaModule,
                                langCode,
                                publicationSummaries,
                            )) {
                                acc.push({
                                    DocumentId: binder.id,
                                    Title: binder.languages.find(l => l.iso639_1 === langCode)?.storyTitle,
                                    Language: langCode,
                                    EditorLink: `${editorLocation}/documents/${binder.id}`,
                                    ...parentTitles,
                                });
                            }
                            return acc;
                        }, []);
                    summaries.push(...draftSummaries);
                }
            },
        )

        return summaries;
    }

    private async getOwnershipForItem(
        item: Binder | DocumentCollection,
        accountId: string,
        expandGroups = false,
        userId?: string
    ): Promise<DetailedItemOwnership> {
        if (!userId || !accountId) {
            throw new Unauthorized("Not allowed");
        }
        const { id, ownership = DEFAULT_OWNERSHIP } = item;
        const ancestorsInfo = await this.findClosestAncestorsWithOverriddenOwnership(id);
        const ancestorsWithOwnership = await this.buildAncestorsWithOwnership(ancestorsInfo, accountId, userId, expandGroups);
        const owners = isOverriddenOwnership(ownership) ?
            await this.resolveOwnerIdsToOwners(ownership.ids, expandGroups, accountId) :
            ancestorsWithOwnership.flatMap(ancestor => ancestor.owners ?? []);
        return {
            itemId: item.id,
            type: ownership.type,
            owners: uniqBy(ancestor => ancestor.id, owners),
            ancestorsWithOwnership,
        };
    }

    async getOwnershipForItems(
        itemIds: string[],
        accountId: string,
        expandGroups = false,
        userId?: string
    ): Promise<DetailedItemOwnership[]> {
        if (!userId || !accountId) {
            throw new Unauthorized("Not allowed");
        }
        if (!itemIds?.length) {
            return [];
        }
        const items = await this.multiRepository.findItems({ ids: itemIds }, { maxResults: 1000 });
        const itemOwnerships: DetailedItemOwnership[] = [];
        for (const item of items) {
            const itemOwnership = await this.getOwnershipForItem(item, accountId, expandGroups, userId);
            itemOwnerships.push(itemOwnership);
        }
        return itemOwnerships;
    }

    private async findClosestAncestorsWithOverriddenOwnership(itemId: string): Promise<AncestorInfo[]> {
        const ancestors = await this.getAncestors(itemId);
        const ancestorItemIds = Object.values(ancestors).flatMap(ids => ids);
        const ancestorItems = await this.multiRepository.getItemsById(ancestorItemIds);
        const ancestorsOwnershipById = Object.fromEntries(ancestorItems.map(ancestor =>
            [ancestor.id, ancestor.ownership ?? DEFAULT_OWNERSHIP]));
        const ancestorsToInherit: AncestorInfo[] = [];

        const visited = new Set<string>();
        const ancestorsToVisit = [...ancestors[itemId]];
        while (ancestorsToVisit.length > 0) {
            const nextAncestorId = ancestorsToVisit.shift();
            if (visited.has(nextAncestorId)) {
                continue;
            }
            const nextAncestorOwnership = ancestorsOwnershipById[nextAncestorId];
            if (isOverriddenOwnership(nextAncestorOwnership)) {
                const collection = ancestorItems.find(ancestor => ancestor.id === nextAncestorId) as DocumentCollection;
                ancestorsToInherit.push({
                    id: nextAncestorId,
                    title: extractTitle(collection),
                    ownerIds: nextAncestorOwnership.ids
                });
            } else {
                ancestorsToVisit.push(...ancestors[nextAncestorId]);
            }
            visited.add(nextAncestorId);
        }
        return ancestorsToInherit;
    }

    private async buildAncestorsWithOwnership(
        ancestorsInfo: AncestorInfo[],
        accountId: string,
        userId: string,
        expandGroups = false,
    ): Promise<InheritedOwnershipSettingsItem[]> {
        const ancestorIds = ancestorsInfo.map(a => a.id);
        const permissions = await this.authorizationContract.findMultipleResourcesPermissions(userId, ResourceType.DOCUMENT, ancestorIds);
        const toSettingsItem = async (ancestorInfo: AncestorInfo): Promise<InheritedOwnershipSettingsItem> => {
            const access = this.resolveUserItemConfigAccess(permissions[ancestorInfo.id] ?? []);
            const owners = await this.resolveOwnerIdsToOwners(ancestorInfo.ownerIds, expandGroups, accountId);
            return {
                id: ancestorInfo.id,
                title: access === ItemConfigAccessType.FORBIDDEN ? null : ancestorInfo.title,
                isCollection: true,
                owners,
                access,
            };
        };
        const response: InheritedOwnershipSettingsItem[] = [];
        for (const ancestorInfo of ancestorsInfo) {
            const settingsItem = await toSettingsItem(ancestorInfo);
            response.push(settingsItem);
        }
        return response;
    }

    private resolveUserItemConfigAccess(itemPermissions: PermissionName[]): ItemConfigAccessType {
        if (itemPermissions.length === 0) {
            return ItemConfigAccessType.FORBIDDEN;
        } else if (!itemPermissions.includes(PermissionName.EDIT)) {
            return ItemConfigAccessType.READABLE;
        } else {
            return ItemConfigAccessType.EDITABLE;
        }
    }

    private async resolveOwnerIdsToOwners(ownerIds: string[], expandGroups: boolean, accountId: string): Promise<Owner[]> {
        const [userIds, groupIds] = partition(id => id.startsWith("uid"), ownerIds);
        if (expandGroups && groupIds.length) {
            const groupMemberIds = await this.userServiceContract.multiGetGroupMemberIds(accountId, groupIds);
            const userIdsFromGroups = Object.values(groupMemberIds).flatMap(ids => ids);
            userIds.push(...userIdsFromGroups);
            groupIds.splice(0, groupIds.length);
        }
        const userAndGroupIds = [...new Set(userIds), ...new Set(groupIds)];
        const usersAndGroups = await this.userServiceContract.multiGetUsersAndGroups(accountId, userAndGroupIds);
        return usersAndGroups.map(userOrGroup => this.toOwner(userOrGroup));
    }

    private toOwner(userOrGroup: User | Usergroup): Owner {
        if (isUsergroup(userOrGroup)) {
            return {
                id: userOrGroup.id,
                name: userOrGroup.name
            };
        } else {
            return {
                id: userOrGroup.id,
                name: userOrGroup.displayName,
                login: userOrGroup.login
            };
        }
    }

    async setOwnershipForItem(itemId: string, ownership: ItemOwnership, accountId: string): Promise<void> {
        await this.validateOwnership(ownership, accountId);
        const item = await this.multiRepository.getBinderOrCollection(itemId);
        const newOwnership: Ownership = ownership.type === "inherited" ?
            ownership :
            { type: "overridden", ids: [...new Set(ownership.ids)] };
        await this.updateItemOwnership(item, newOwnership);
    }

    private async updateItemOwnership(item: Binder | DocumentCollection, ownership: Ownership) {
        if (isDocumentCollection(item)) {
            await this.collectionRepository.patchCollection(item.id, collection => updateOwnership(collection, ownership))
        } else {
            await this.bindersRepository.updateBinder({ ...item, ownership });
        }
    }

    private async validateOwnership(ownership: ItemOwnership, accountId: string): Promise<void> {
        if (isOverriddenOwnership(ownership)) {
            const resolvedUsersAndGroups = await this.userServiceContract.multiGetUsersAndGroups(accountId, ownership.ids);
            const resolvedUsersAndGroupIds = new Set(resolvedUsersAndGroups.map(userOrGroup => userOrGroup.id));
            if (new Set(ownership.ids).size !== resolvedUsersAndGroupIds.size) {
                throw new InvalidParam(["Invalid ownership"]);
            }
        }
    }

    async removeOwnerIdFromItemOwnershipForAccount(ownerId: string, accountId: string): Promise<void> {
        const ownershipProvider = (ownership: Ownership): Ownership => {
            const currentOwnership = ownership ?? DEFAULT_OWNERSHIP;
            if (isOverriddenOwnership(currentOwnership)) {
                const ids = currentOwnership.ids.filter(id => id !== ownerId);
                if (ids.length > 0) {
                    return { ...currentOwnership, ids };
                } else {
                    return DEFAULT_OWNERSHIP;
                }
            }
            return ownership;
        };
        await this.multiRepository.updateOwnershipForItemsOwnedBy(ownerId, ownershipProvider, accountId);
    }

    async getItemAndAncestorsReaderFeedbackConfigs(itemId: string, userId?: string): Promise<ReaderFeedbackConfigs> {
        const [item] = await this.multiRepository.getItemsById([itemId]);
        if (!item) {
            return {};
        }
        const accountFeatures = await this.accountServiceContract.getAccountFeatures(item.accountId);
        if (isNoReaderFeedbackFeatureEnabled(accountFeatures)) {
            return {};
        }
        const ancestors = await this.getClosestAncestorsReaderFeedbackConfigs(itemId, userId);
        const itemConfig = await this.readerFeedbackConfigRepository.getForItem(itemId);
        ancestors[itemId] = {
            id: itemId,
            title: extractTitle(item),
            isCollection: isCollectionItem(item),
            access: ItemConfigAccessType.EDITABLE,
            config: itemConfig ?? {},
        }
        return ancestors;
    }

    private async getClosestAncestorsReaderFeedbackConfigs(itemId: string, userId: string): Promise<ReaderFeedbackConfigs> {
        const ancestors = await this.getAncestors(itemId);
        const ancestorItemIds = Object.values(ancestors).flatMap(ids => ids);
        const ancestorsReaderFeedbackConfigs = await this.readerFeedbackConfigRepository.getForItems(ancestorItemIds);

        const ancestorsToInheritFrom: ReaderFeedbackConfigs = {};
        const visited = new Set<string>();
        const ancestorsToVisit = [...ancestors[itemId]];
        while (ancestorsToVisit.length > 0) {
            const nextAncestorId = ancestorsToVisit.shift();
            if (visited.has(nextAncestorId)) {
                continue;
            }
            const nextAncestorConfig = ancestorsReaderFeedbackConfigs[nextAncestorId] ?? {};
            if (this.readerFeedbackConfigHasAtLeastOneSetting(nextAncestorConfig)) {
                ancestorsToInheritFrom[nextAncestorId] = {
                    id: nextAncestorId,
                    isCollection: true,
                    title: null,
                    access: ItemConfigAccessType.FORBIDDEN,
                    config: nextAncestorConfig,
                };
            } else {
                ancestorsToVisit.push(...ancestors[nextAncestorId]);
            }
            visited.add(nextAncestorId);
        }

        const directAncestorsItemIds = Object.keys(ancestorsToInheritFrom).filter(id => id !== itemId);
        const permissions = await this.authorizationContract.findMultipleResourcesPermissions(userId, ResourceType.DOCUMENT, directAncestorsItemIds);
        const ancestorItems = await this.multiRepository.getItemsById(directAncestorsItemIds);
        for (const ancestor of ancestorItems) {
            const ancestorPerms = permissions[ancestor.id] ?? [];
            const ancestorConfig = ancestorsToInheritFrom[ancestor.id];
            if (ancestorPerms.length === 0) {
                ancestorConfig["title"] = null;
                ancestorConfig["access"] = ItemConfigAccessType.FORBIDDEN;
            } else if (!ancestorPerms.includes(PermissionName.ADMIN)) {
                ancestorConfig["title"] = extractTitle(ancestor);
                ancestorConfig["access"] = ItemConfigAccessType.READABLE;
            } else {
                ancestorConfig["title"] = extractTitle(ancestor);
                ancestorConfig["access"] = ItemConfigAccessType.EDITABLE;
            }
        }
        return ancestorsToInheritFrom;
    }

    private readerFeedbackConfigHasAtLeastOneSetting(config: ReaderFeedbackConfig): boolean {
        return config.readConfirmationEnabled != null ||
            config.readerCommentsEnabled != null ||
            config.readerRatingEnabled != null;
    }

    async getReaderFeedbackConfigForItems(itemIds: string[]): Promise<Record<string, ReaderFeedbackConfig>> {
        return this.readerFeedbackConfigRepository.getForItems(itemIds);
    }

    async updateReaderFeedbackConfig(itemId: string, config: ReaderFeedbackConfig): Promise<ReaderFeedbackConfig> {
        const { readerCommentsEnabled, readerRatingEnabled, readConfirmationEnabled } = config;
        return await this.readerFeedbackConfigRepository.updateReaderFeedbackConfig(itemId, readerCommentsEnabled, readerRatingEnabled, readConfirmationEnabled);
    }

    async getFeedbacks(feedbackFilter: FeedbackFilter): Promise<IBinderFeedback[]> {
        const feedbacks = await this.feedbackRepository.getFeedbacks(feedbackFilter);
        return feedbacks as IBinderFeedback[];
    }

    async getReaderItemContext(
        itemId: string,
        accountId: string,
        options?: GetReaderItemContextOptions,
        userId?: string,
    ): Promise<ReaderItemContext> {
        const [accountFeatures, ancestors] = await Promise.all([
            this.accountServiceContract.getAccountFeatures(accountId),
            this.getItemsAncestors([itemId]),
        ]);
        const feedbackConfig = options?.skipReaderFeedbackConfig ?
            {} :
            await resolveReaderFeedbackConfig(itemId, ancestors, accountFeatures, this.readerFeedbackConfigRepository, this.logger, userId);
        return {
            ancestors,
            feedbackConfig,
        };
    }

    async clearLastModifiedInfo(accountId: string, binderIds: string[]): Promise<void> {
        const bindersToUpdate = await this.findBindersBackend({ ids: binderIds, accountId }, { maxResults: binderIds.length });
        const update = this.bindersRepository.updateBinder.bind(this.bindersRepository);
        for (const binder of bindersToUpdate) {
            const toUpdate = binder as Binder;
            toUpdate.authors = [];
            toUpdate.authorIds = [];
            toUpdate.modules.meta = toUpdate.modules.meta.map(metaModule => omit(["lastModifiedDate", "lastModifiedBy"], metaModule));
            delete toUpdate.lastModified;
            delete toUpdate.lastModifiedBy;
            await this.withValidBinder(toUpdate, update);
        }
    }

    async updateChunkVisualSettings(binderId: string, chunkIdx: number, visualIdx: number, visualSettings: Partial<VisualSettings>): Promise<void> {
        if (Object.keys(visualSettings).length === 0) {
            return;
        }
        const binder = await this.bindersRepository.getBinder(binderId);
        const binderObj = BinderOperations
            .fromApiObject(binder)
            .toClassObject();
        let updatedBinder: Binder;
        if (chunkIdx === 0) {
            const thumbnail = binderObj.getThumbnail();
            updatedBinder = BinderOperations
                .fromApiObject(binder)
                .updateThumbnail(Object.assign(Object.create(Object.getPrototypeOf(thumbnail)), thumbnail, visualSettings))
                .toApiObject();
        } else {
            const visual = {
                ...binderObj.getImagesModule(binderObj.getImagesModuleKey())
                    .chunks.at(chunkIdx - 1).at(visualIdx),
                ...visualSettings,
            };
            updatedBinder = BinderOperations
                .fromApiObject(binder)
                .updateVisualData(chunkIdx - 1, visualIdx, visual)
                .toApiObject();
        }
        await this.bindersRepository.updateBinder(updatedBinder);
    }

    async getUserActivities(accountId: string, userId?: string, languageCode?: string): Promise<UserActivities> {
        if (!userId) {
            return [];
        }
        const accountFeatures = await this.accountServiceContract.getAccountFeatures(accountId);
        if (!accountFeatures.includes(FEATURE_DOCUMENT_OWNER)) {
            return [];
        }
        const unresolvedCommentThreads = await this.commentThreadsRepository.findThreads({ accountId, resolved: false });
        const unresolvedThreadsByDocId = groupBy(thread => thread.binderId, unresolvedCommentThreads);
        const itemOwnerships = await this.getOwnershipForItems(Object.keys(unresolvedThreadsByDocId), accountId, true, userId);
        const ownedDocIds = itemOwnerships
            .filter(ownership => ownership.owners.some(owner => owner.id === userId))
            .map(ownership => ownership.itemId);
        const docs = await this.multiRepository.getItemsById(ownedDocIds) as Binder[];

        const activities: UserActivities = [];
        for (const doc of docs) {
            const documentTitle = this.getBinderTitleInLanguageOrFirst(doc, languageCode);
            const commentsActivity = await this.resolveCommentsActivity(unresolvedThreadsByDocId[doc.id]);
            activities.push({
                documentId: doc.id,
                documentTitle,
                ...commentsActivity,
            });
        }
        return activities;
    }

    private async resolveCommentsActivity(commentThreads: CommentThread[]): Promise<Pick<
        UserActivity,
        | "commentsAuthors"
        | "commentsCount"
        | "latestCommentDate"
    >> {
        const threadIds = commentThreads.map(thread => thread.id);
        const comments = await this.commentServiceContract.getComments({ threadIds });
        const commentsUserIds = new Set(comments.map(c => c.userId));
        const commentsUsers = await this.userServiceContract.getUsers([...commentsUserIds]);
        const commentsAuthors = commentsUsers.map(({ id, displayName, firstName, lastName }) => ({ id, displayName, firstName, lastName }))
        const commentsDescByDate = sortByDate(
            comments,
            c => c.created ? new Date(c.created) : new Date(),
            SortOrder.DESC
        );
        const authorsById = commentsAuthors.reduce((res, item) => res.set(item.id, item), new Map<string, UserActivity["commentsAuthors"][0]>());
        const authorsDescByCommentDate = commentsDescByDate
            .reduce((res, item) => res.includes(item.userId) ? res : [...res, item.userId], [] as string[])
            .map(id => authorsById.get(id));
        const latestCommentDate = commentsDescByDate.at(0)?.created;
        return {
            commentsAuthors: authorsDescByCommentDate,
            latestCommentDate,
            commentsCount: comments.length,
        }
    }

    async restoreElasticDoc(indexName: string, documentId: string, document: unknown): Promise<void> {
        if (isProduction()) {
            throw new Error("Not allowed in production");
        }
        await (this.bindersRepository as ElasticBindersRepository).runCreate(indexName, documentId, document);
    }
}

export class PublicationRepositoryFactory {
    constructor(
        private readonly config: Config,
        private readonly logger: Logger,
        private readonly operationLogService: IOperationLog,
        private readonly queryBuilderHelper: ESQueryBuilderHelper,
    ) { }

    static async fromConfig(config: Config) {
        const loginOption = getMongoLogin("repository_service");
        const topLevelLogger = LoggerBuilder.fromConfig(config);
        const featureFlagService = await LaunchDarklyService.create(config, topLevelLogger);
        const operationLogCollectionConfig = await CollectionConfig.promiseFromConfig(config, "operationlogs", loginOption);
        const operationLogServicesFactory = new OperationLogServiceFactory(operationLogCollectionConfig);
        const operationLogService = operationLogServicesFactory.build(featureFlagService, topLevelLogger);
        const queryBuilderHelper = new DefaultESQueryBuilderHelper(config);
        return new PublicationRepositoryFactory(
            config,
            topLevelLogger,
            operationLogService,
            queryBuilderHelper,
        );
    }

    forRequest(logger?: Logger) {
        return new ElasticPublicationsRepository(this.config, logger ?? this.logger, this.queryBuilderHelper, this.operationLogService);
    }

}

export class BindersRepositoryServiceFactory {
    private readonly queryBuilderHelper: ESQueryBuilderHelper;
    private readonly ancestorRedisClient: RedisClient;
    private commentThreadsRepositoryFactory: CommentThreadsRepositoryFactory;
    private readonly jwtConfig: JWTSignConfig;
    private chunkApprovalRepositoryFactory: ChunkApprovalRepositoryFactory;
    private checklistRepositoryFactory: ChecklistsRepositoryFactory;
    private checklistConfigRepositoryFactory: ChecklistConfigRepositoryFactory;
    private readerFeedbackConfigRepositoryFactory: ReaderFeedbackConfigRepositoryFactory;
    private feedbackRepositoryFactory: FeedbackRepositoryFactory;
    private readonly textToSpeech: TextToSpeech;
    private ttsRepositoryFactory: TTSRepositoryFactory;
    private binderStatusCacheRepositoryFactory: BinderStatusCacheRepositoryFactory;

    constructor(
        private readonly config: Config,
        private logger: Logger,
        private readonly authorizationContractBuilder: (logger?: Logger) => AuthorizationServiceContract,
        private readonly routingServiceContract: RoutingServiceContract,
        private readonly trackingServiceContract: TrackingServiceContract,
        private readonly imageServiceContract: ImageServiceContract,
        private readonly accountServiceContract: AccountServiceContract,
        private readonly userServiceContract: UserServiceContract,
        private readonly notificationServiceClient: NotificationServiceContract,
        private readonly translator: Translator,
        commentThreadsCollectionConfig: CollectionConfig,
        chunkApprovalCollectionConfig: CollectionConfig,
        checklistCollectionConfig: CollectionConfig,
        checklistConfigCollectionConfig: CollectionConfig,
        feedbackRepositoryConfig: CollectionConfig,
        ttsFilesCollectionConfig: CollectionConfig,
        readerFeedbackConfigCollectionConfig: CollectionConfig,
        binderStatusCollectionConfig: CollectionConfig,
        private readonly publicItemsCache: PublicItemsCache,
        private readonly mostUsedLanguagesCache: MostUsedLanguagesCache,
        private readonly publicationRepoFactory: PublicationRepositoryFactory,
        private readonly commentServiceContract: CommentServiceContract,
    ) {
        this.queryBuilderHelper = new DefaultESQueryBuilderHelper(config);
        this.ancestorRedisClient = RedisClientBuilder.fromConfig(config, "documents");
        this.commentThreadsRepositoryFactory = new CommentThreadsRepositoryFactory(commentThreadsCollectionConfig, logger);
        this.jwtConfig = buildSignConfig(config);
        this.chunkApprovalRepositoryFactory = new ChunkApprovalRepositoryFactory(chunkApprovalCollectionConfig, logger);
        this.checklistRepositoryFactory = new ChecklistsRepositoryFactory(checklistCollectionConfig, logger)
        this.checklistConfigRepositoryFactory = new ChecklistConfigRepositoryFactory(checklistConfigCollectionConfig, logger)
        this.feedbackRepositoryFactory = new FeedbackRepositoryFactory(feedbackRepositoryConfig, logger);
        this.ttsRepositoryFactory = new TTSRepositoryFactory(ttsFilesCollectionConfig, logger);
        this.textToSpeech = TextToSpeech.fromConfig(config);
        this.readerFeedbackConfigRepositoryFactory = new ReaderFeedbackConfigRepositoryFactory(readerFeedbackConfigCollectionConfig, logger);
        this.binderStatusCacheRepositoryFactory = new BinderStatusCacheRepositoryFactory(binderStatusCollectionConfig, logger);
    }

    forRequest(request: { logger?: Logger }): BindersRepositoryService {
        const bindersRepo = new ElasticBindersRepository(this.config, request.logger, this.queryBuilderHelper);
        const publicationRepo = this.publicationRepoFactory.forRequest(request.logger);
        const collectionRepo = new ElasticCollectionsRepository(
            this.config,
            request.logger,
            this.queryBuilderHelper
        );
        const multiRepo = new ElasticMultiRepository(this.config, request.logger, this.queryBuilderHelper);
        const repoAncestorBuilder = new ElasticAncestorBuilder(collectionRepo);
        const cachingAncestorBuilder = new CachingAncestorBuilder(repoAncestorBuilder, this.ancestorRedisClient);
        const commentThreadsRepository = this.commentThreadsRepositoryFactory.build(request.logger);
        const chunkApprovalRepository = this.chunkApprovalRepositoryFactory.build(request.logger);
        const checklistRepository = this.checklistRepositoryFactory.build(request.logger);
        const checklistConfigRepository = this.checklistConfigRepositoryFactory.build(request.logger);
        const readerFeedbackConfigRepository = this.readerFeedbackConfigRepositoryFactory.build(request.logger);
        const feedbackRepository = this.feedbackRepositoryFactory.build(request.logger);
        const binderStatusCacheRepository = this.binderStatusCacheRepositoryFactory.build(request.logger);
        const recursiveActionsValidator = new RecursiveActionValidator(collectionRepo, publicationRepo, bindersRepo);

        const getTrashService = (bindersRepositoryContract: BindersRepositoryServiceContract) =>
            new TrashService(
                cachingAncestorBuilder,
                this.authorizationContractBuilder(request.logger),
                bindersRepositoryContract,
                collectionRepo,
                multiRepo
            );

        const ttsRepository = this.ttsRepositoryFactory.build(request.logger);
        return new BindersRepositoryService(
            bindersRepo,
            publicationRepo,
            collectionRepo,
            multiRepo,
            commentThreadsRepository,
            cachingAncestorBuilder,
            this.authorizationContractBuilder(request.logger),
            this.routingServiceContract,
            this.trackingServiceContract,
            this.imageServiceContract,
            this.accountServiceContract,
            this.userServiceContract,
            this.notificationServiceClient,
            this.jwtConfig,
            request.logger,
            this.translator,
            this.getImageServiceHost(this.config),
            chunkApprovalRepository,
            checklistRepository,
            checklistConfigRepository,
            feedbackRepository,
            this.publicItemsCache,
            this.mostUsedLanguagesCache,
            recursiveActionsValidator,
            new SearchService(
                this.authorizationContractBuilder(request.logger),
                bindersRepo,
                collectionRepo,
                publicationRepo,
            ),
            getTrashService,
            ObjectStorageFactory.createAudioStorageFromConfig(this.config, request.logger),
            this.textToSpeech,
            ttsRepository,
            readerFeedbackConfigRepository,
            binderStatusCacheRepository,
            new ItemsTransformersFactory(
                publicationRepo,
                collectionRepo,
                multiRepo,
                cachingAncestorBuilder,
                this.jwtConfig,
                this.imageServiceContract,
                this.accountServiceContract,
                this.authorizationContractBuilder(request.logger)
            ),
            this.commentServiceContract,
        );
    }

    static async fromConfig(config: Config): Promise<BindersRepositoryServiceFactory> {
        const loginOption = getMongoLogin("repository_service");
        const topLevelLogger = LoggerBuilder.fromConfig(config);
        const [
            authorizationContractBuilder,
            routingServiceContract,
            trackingServiceContract,
            imageServiceClient,
            accountServiceClient,
            userServiceClient,
            notificationServiceClient,
            translator,
            commentThreadsCollectionConfig,
            chunkApprovalsCollectionConfig,
            checklistCollectionConfig,
            checklistConfigCollectionConfig,
            ttsFilesCollectionConfig,
            readerFeedbackConfigCollectionConfig,
            feedbackCollectionConfig,
            binderStatusCollectionConfig,
            publicItemsCache,
            mostUsedLanguagesCache,
            publicationRepoFactory,
            commentsServiceClient,
        ] = await Promise.all([
            BackendAuthorizationServiceClient.createBuilderFromConfig(config, "repo-service"),
            BackendRoutingServiceClient.fromConfig(config, "repo-service"),
            BackendTrackingServiceClient.fromConfig(config, "repo-service"),
            BackendImageServiceClient.fromConfig(config, "repo-service"),
            BackendAccountServiceClient.fromConfig(config, "repo-service"),
            BackendUserServiceClient.fromConfig(config, "repo-service"),
            BackendNotificationServiceClient.fromConfig(config, "repo-service", () => undefined),
            Translator.fromConfig(config),
            CollectionConfig.promiseFromConfig(config, "commentthreads", loginOption),
            CollectionConfig.promiseFromConfig(config, "chunkApprovals", loginOption),
            CollectionConfig.promiseFromConfig(config, "checklists", loginOption),
            CollectionConfig.promiseFromConfig(config, "checklistconfigs", loginOption),
            CollectionConfig.promiseFromConfig(config, "ttsmetas", loginOption),
            CollectionConfig.promiseFromConfig(config, "readerfeedbackconfigs", loginOption),
            CollectionConfig.promiseFromConfig(config, "readerfeedbacks", loginOption),
            CollectionConfig.promiseFromConfig(config, "binderstatusescache", loginOption),
            PublicItemsCache.fromConfig(config),
            MostUsedLanguagesCache.fromConfig(config),
            PublicationRepositoryFactory.fromConfig(config),
            BackendCommentServiceClient.fromConfig(config, "repo-service"),
        ]);
        return new BindersRepositoryServiceFactory(
            config,
            topLevelLogger,
            authorizationContractBuilder,
            routingServiceContract,
            trackingServiceContract,
            imageServiceClient,
            accountServiceClient,
            userServiceClient,
            notificationServiceClient,
            translator,
            commentThreadsCollectionConfig,
            chunkApprovalsCollectionConfig,
            checklistCollectionConfig,
            checklistConfigCollectionConfig,
            feedbackCollectionConfig,
            ttsFilesCollectionConfig,
            readerFeedbackConfigCollectionConfig,
            binderStatusCollectionConfig,
            publicItemsCache,
            mostUsedLanguagesCache,
            publicationRepoFactory,
            commentsServiceClient
        );
    }

    private getImageServiceHost(config: Config): string {
        const locationKey = BindersConfig.getServiceLocationKey("image");
        const imageService: Maybe<string> = config.getString(locationKey);
        if (!imageService.isJust()) {
            return "";
        }
        return imageService.get();
    }

    async shutdown(): Promise<void> {
        await this.ancestorRedisClient.quit();
    }
}

