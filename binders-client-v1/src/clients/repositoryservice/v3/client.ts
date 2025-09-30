import {
    AccountTotals,
    ApprovedStatus,
    Binder,
    BinderFilter,
    BinderModules,
    BinderOrDocumentCollection,
    BinderSearchHit,
    BinderSearchResultOptions,
    BinderStatus,
    BinderSummary,
    BindersRepositoryServiceContract,
    ChunkApprovalFilter,
    CollectionElement,
    CollectionElementsWithInfoOptions,
    CollectionFilter,
    CollectionSearchHit,
    ContentChunkKind,
    DetailedItemOwnership,
    DocumentAncestors,
    DocumentCollection,
    DocumentResourceDetails,
    DraftSummaryItem,
    EditorItemSearchResult,
    ExportedBinderFeedback,
    FeedbackFilter,
    FeedbackParams,
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
    IGetCollectionQueryOptions,
    IItemSearchOptions,
    IMultiSearchOptions,
    ITTSGenerateResponse,
    ITTSVoiceOptions,
    ItemOwnership,
    LanguageSummary,
    Publication,
    PublicationAndCollectionFilter,
    PublicationFilter,
    PublicationFindResult,
    PublicationSearchHit,
    PublicationSummary,
    PublicationSummaryFormat,
    PublicationsSummaryItem,
    ReaderFeedbackConfig,
    ReaderFeedbackConfigs,
    ReaderItemContext,
    ReaderItemSearchResult,
    ReaderItemsFilter,
    RecursiveAction,
    RecursiveDeleteSummaryResult,
    RecursiveOpeartionResult,
    RecursiveUnpublishSummaryResult,
    RelabelResult,
    SoftDeletedItemsFilter,
    SoftDeletedItemsSearchResult,
    UserActivities,
    ValidationResult,
    VisualSettings
} from "./contract";
import { BindersServiceClient, ClientExportApiResponseFormat, RequestHandler } from "../../client";
import Thumbnail, { withParsedThumbnail } from "./Thumbnail";
import { AncestorTree } from "../../../ancestors";
import { BindersServiceClientConfig } from "../../config";
import { Config } from "../../../config";
import { FindBindersStatusesQueryParams } from "./contract";
import getRoutes from "./routes";
import { parseDateFromString } from "../../../util/date";
import { withParsedImageModule } from "./BinderVisual";

export class BinderRepositoryServiceClient extends BindersServiceClient implements BindersRepositoryServiceContract {

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
    ): BinderRepositoryServiceClient {
        const versionedPath = BindersServiceClientConfig.getVersionedPath(config, "binders", version);
        return new BinderRepositoryServiceClient(versionedPath, requestHandler, accountIdProvider);
    }

    getDocumentResourceDetails(documentId: string): Promise<DocumentResourceDetails> {
        const options = {
            pathParams: {
                documentId
            }
        };
        return this.handleRequest("getDocumentResourceDetails", options);
    }

    getDocumentResourceDetailsArray(documentIds: string[]): Promise<DocumentResourceDetails[]> {
        const options = {
            body: {
                documentIds
            }
        };
        return this.handleRequest("getDocumentResourceDetailsArray", options);
    }

    async searchBindersAndCollections(query: string, options: IItemSearchOptions, accountId: string, multiSearchOptions?: IMultiSearchOptions): Promise<EditorItemSearchResult> {
        const requestOptions = {
            body: {
                query,
                options,
                accountId,
                multiSearchOptions,
            }
        };
        const itemsSearchResult = await this.handleRequest<EditorItemSearchResult>("searchBindersAndCollections", requestOptions);
        for (const i in itemsSearchResult.hits) {
            if (itemsSearchResult.hits[i]["binderSummary"]) {
                const hit = itemsSearchResult.hits[i] as BinderSearchHit;
                hit.binderSummary = withParsedThumbnail<BinderSummary>(hit["binderSummary"]);
            } else if (itemsSearchResult.hits[i]["collection"]) {
                const hit = (itemsSearchResult.hits[i]) as CollectionSearchHit;
                hit.collection.thumbnail = Object.assign(Object.create(Thumbnail.prototype), hit.collection.thumbnail);
            }
        }
        return itemsSearchResult;
    }

    async searchPublicationsAndCollections(query: string, options: IItemSearchOptions, domain: string, multiSearchOptions?: IMultiSearchOptions): Promise<ReaderItemSearchResult> {
        const requestOptions = {
            body: {
                query,
                options,
                domain,
                multiSearchOptions
            }
        };
        const itemsSearchResult = await this.handleRequest<ReaderItemSearchResult>("searchPublicationsAndCollections", requestOptions);
        for (const i in itemsSearchResult.hits) {
            if (itemsSearchResult.hits[i]["publicationSummary"]) {
                const hit = itemsSearchResult.hits[i] as PublicationSearchHit;
                hit.publicationSummary.thumbnail = Object.assign(Object.create(Thumbnail.prototype), hit.publicationSummary.thumbnail);
            } else if (itemsSearchResult.hits[i]["collection"]) {
                const hit = itemsSearchResult.hits[i] as CollectionSearchHit;
                hit.collection.thumbnail = Object.assign(Object.create(Thumbnail.prototype), hit.collection.thumbnail);
            }
        }
        return itemsSearchResult;
    }

    async getBinder(binderId: string, options?: IItemSearchOptions, skipParse?: boolean): Promise<Binder> {
        const reqOptions = {
            pathParams: {
                binderId,
                ...(options ? { options: JSON.stringify(options) } : {}),
            },
        };
        const binder: Binder = await this.handleRequest<Binder>("getBinder", reqOptions);
        return skipParse ?
            binder :
            withParsedImageModule<Binder>(binder);
    }

    async createOrUpdateFeedback(accountId: string, publicationId: string, feedbackParams: FeedbackParams): Promise<IBinderFeedback> {
        const options = {
            pathParams: {
                publicationId,
            },
            queryParams: {
                accountId
            },
            body: { feedbackParams },
            useDeviceTargetUserToken: true
        };
        return this.handleRequest("createOrUpdateFeedback", options);
    }

    getMostRecentPublicationUserFeedback(publicationId: string): Promise<IBinderFeedback | null> {
        const options = {
            pathParams: {
                publicationId,
            },
            useDeviceTargetUserToken: true,
        };
        return this.handleRequest("getMostRecentPublicationUserFeedback", options);
    }

    async getBinderFeedbacks(binderId: string): Promise<IBinderFeedback[]> {
        const options = {
            pathParams: {
                binderId,
            },
        };
        const rawFeedbacks = await this.handleRequest<IBinderFeedback[]>("getBinderFeedbacks", options);
        return rawFeedbacks.map(f => ({
            ...f,
            created: parseDateFromString(f.created.toString()),
            updated: parseDateFromString(f.updated.toString()),
        }));
    }

    async exportBinderFeedbacks<F extends ClientExportApiResponseFormat>(
        binderId: string, format = ClientExportApiResponseFormat.JSON as F
    ): Promise<F extends ClientExportApiResponseFormat.CSV ? string : ExportedBinderFeedback[]> {
        return this.handleRequest("exportBinderFeedbacks", {
            pathParams: { binderId },
            queryParams: { format },
        });
    }

    extendChunks(binderOrPublication: Binder | Publication, additionalChunks: ContentChunkKind[], translated: string): Promise<BinderModules> {
        const options = {
            body: {
                binderOrPublication,
                additionalChunks,
                translated,
            }
        };
        return this.handleRequest("extendChunks", options);
    }

    findBindersBackend(filter: BinderFilter, options: BinderSearchResultOptions): Promise<Array<Binder>> {
        const requestOptions = {
            body: {
                filter,
                options
            }
        };
        return this.handleRequest("findBindersBackend", requestOptions);
    }

    findBinderIdsByAccount(accountId: string): Promise<string[]> {
        const requestOptions = {
            body: {
                accountId
            }
        };
        return this.handleRequest("findBinderIdsByAccount", requestOptions);
    }


    findItems(filter: BinderFilter, options: BinderSearchResultOptions): Promise<BinderOrDocumentCollection[]> {
        const requestOptions = {
            body: {
                filter,
                options
            }
        };
        return this.handleRequest("findItems", requestOptions);
    }

    async findItemsForReader(filter: BinderFilter, options: IItemSearchOptions, accountId: string): Promise<BinderOrDocumentCollection[]> {
        const requestOptions = {
            body: {
                filter,
                options,
                accountId
            }
        };
        const result = await this.handleRequest<BinderOrDocumentCollection[]>("findItemsForReader", requestOptions);
        return result.map(r => ({
            ...r,
            thumbnail: Object.assign(Object.create(Thumbnail.prototype), r.thumbnail)
        }));
    }

    async findItemsForEditor(filter: BinderFilter, options: IItemSearchOptions, accountId: string): Promise<BinderOrDocumentCollection[]> {
        const requestOptions = {
            body: {
                filter,
                options,
                accountId
            }
        };
        const result = await this.handleRequest<BinderOrDocumentCollection[]>("findItemsForEditor", requestOptions);
        return result.map(r => ({
            ...r,
            thumbnail: Object.assign(Object.create(Thumbnail.prototype), r.thumbnail)
        }));
    }

    async getSoftDeletedItems(
        accountId: string,
        options: IItemSearchOptions,
        filter?: SoftDeletedItemsFilter
    ): Promise<SoftDeletedItemsSearchResult> {
        const requestOptions = {
            body: {
                options,
                accountId,
                filter
            }
        };
        const result = await this.handleRequest<SoftDeletedItemsSearchResult>("getSoftDeletedItems", requestOptions);
        const deletedItemsWithProperThumbnails = result.items.map(deletedItem => {
            const thumbnail = deletedItem.thumbnail;
            const updatedThumbnail = Object.assign(Object.create(Thumbnail.prototype), thumbnail);
            return { ...deletedItem, thumbnail: updatedThumbnail };
        })
        return { ...result, items: deletedItemsWithProperThumbnails };
    }

    findPublicationsAndCollections(
        filter: PublicationAndCollectionFilter,
        options: BinderSearchResultOptions,
        accountId: string,
    ): Promise<Array<Publication | DocumentCollection>> {
        const requestOptions = {
            body: {
                filter,
                options,
                accountId,
            }
        };
        return this.handleRequest("findPublicationsAndCollections", requestOptions);
    }

    async getCollectionElementsWithInfo(
        collectionId: string,
        domain: string,
        options: CollectionElementsWithInfoOptions = {},
    ): Promise<ICollectionElementsWithInfo> {
        const requestOptions = {
            body: {
                collectionId,
                domain,
                options,
            }
        };
        const { items, languagesUsed } = await this.handleRequest<ICollectionElementsWithInfo>("getCollectionElementsWithInfo", requestOptions);
        const parsedItems = items.map(item => ({
            ...item,
            thumbnail: Object.assign(Object.create(Thumbnail.prototype), item.thumbnail),
        }));
        return { items: parsedItems, languagesUsed };
    }

    createBinderInCollection(toCreate: Binder, collectionId: string, accountId: string): Promise<Binder> {
        const options = {
            body: { binder: toCreate, collectionId, accountId },
        };
        return this.handleRequest("createBinderInCollection", options);
    }

    createBinderBackend(toCreate: Binder): Promise<Binder> {
        const options = {
            body: toCreate
        };
        return this.handleRequest("createBinderBackend", options);
    }

    updateBinder(toUpdate: Binder): Promise<Binder> {
        const options = {
            pathParams: {
                binderId: toUpdate.id
            },
            body: toUpdate
        };
        return this.handleRequest("updateBinder", options);
    }

    duplicateBinder(
        toDuplicate: Binder,
        collectionId: string,
        fromAccountId: string,
        toAccountId: string
    ): Promise<Binder> {
        const options = {
            body: {
                toDuplicate,
                collectionId,
                fromAccountId,
                toAccountId,
            }
        };
        return this.handleRequest("duplicateBinder", options);
    }

    duplicateCollection(
        collectionId: string,
        targetCollectionId: string,
        targetDomainCollectionId: string,
        fromAccountId: string,
        toAccountId: string
    ): Promise<DocumentCollection> {
        const options = {
            body: {
                collectionId,
                targetCollectionId,
                targetDomainCollectionId,
                fromAccountId,
                toAccountId,
            }
        };
        return this.handleRequest("duplicateCollection", options);
    }

    validateBinder(toValidate: Binder): Promise<Array<string>> {
        const options = {
            body: toValidate
        };
        return this.handleRequest("validateBinder", options);
    }

    deleteBinder(
        binderId: string,
        accountId: string,
        permanent?: boolean
    ): Promise<Binder> {
        const options = {
            pathParams: {
                binderId
            },
            body: {
                accountId,
                permanent
            }
        };
        return this.handleRequest("deleteBinder", options);
    }

    deleteCollection(
        collectionId: string,
        accountId: string
    ): Promise<DocumentCollection> {
        const options = {
            pathParams: {
                collectionId
            },
            body: {
                accountId
            }
        };
        return this.handleRequest("deleteCollection", options);
    }

    publish(
        binderId: string,
        languageCodes: string[],
        sendNotification = true
    ): Promise<Array<PublicationSummary>> {
        const options = {
            pathParams: {
                binderId
            },
            body: {
                languages: languageCodes,
                sendNotification
            }
        };
        return this.handleRequest("publish", options);
    }

    async findPublications(binderId: string, filter: PublicationFilter, options: IItemSearchOptions): Promise<Array<PublicationFindResult>> {
        const requestOptions = {
            pathParams: {
                binderId
            },
            body: {
                filter,
                options,
            }
        };
        const publicationFindResults: PublicationFindResult[] = await this.handleRequest<PublicationFindResult[]>("findPublications", requestOptions);
        return publicationFindResults.map(pubFindResult => {
            if (!pubFindResult["modules"]) {
                return pubFindResult as PublicationSummary;
            }
            return withParsedImageModule<Publication>(pubFindResult as Publication);
        });
    }

    findPublicationsBackend(filter: PublicationFilter, options: BinderSearchResultOptions): Promise<Array<PublicationFindResult>> {
        const requestOptions = {
            body: {
                filter,
                options,
            }
        };
        return this.handleRequest("findPublicationsBackend", requestOptions);
    }

    unpublish(binderId: string, languageCodes: string[]): Promise<Array<PublicationSummary>> {
        const options = {
            pathParams: {
                binderId
            },
            body: {
                languages: languageCodes,
            }
        };
        return this.handleRequest("unpublish", options);
    }

    setPublicationsShowInOverview(binderId: string, showInOverview: boolean): Promise<Array<PublicationSummary>> {
        const options = {
            pathParams: {
                binderId
            },
            body: {
                showInOverview
            }
        };
        return this.handleRequest("setPublicationsShowInOverview", options);
    }

    updatePublicationsLanguages(binderId: string, languageCode: string, order: string[]): Promise<Array<PublicationSummary>> {
        const options = {
            pathParams: {
                binderId
            },
            body: {
                languageCode,
                order
            }
        };
        return this.handleRequest("updatePublicationsLanguages", options);
    }

    async getPublication(publicationId: string, options?: IItemSearchOptions): Promise<Publication> {
        const reqOptions = {
            pathParams: {
                publicationId,
                ...(options ? { options: JSON.stringify(options) } : {}),
            },
        };
        const publication: Publication = await this.handleRequest<Publication>("getPublication", reqOptions);
        return withParsedImageModule<Publication>(publication);
    }

    getCollectionInfo(collectionId: string): Promise<ICollectionInfo> {
        const options = {
            pathParams: {
                collectionId
            }
        };
        return this.handleRequest("getCollectionInfo", options);
    }

    getCollectionsElements(colIds: string[], recursive: boolean): Promise<CollectionElement[]> {
        const options = {
            body: {
                colIds,
                recursive,
            }
        };
        return this.handleRequest("getCollectionsElements", options);
    }

    getChildCollectionSummaries(collectionIds: string[], accountId: string): Promise<ICollectionSummary[]> {
        const options = {
            body: {
                collectionIds,
                accountId,
            }
        };
        return this.handleRequest("getChildCollectionSummaries", options);
    }

    createCollectionInCollection(
        accountId: string,
        collectionId: string,
        title: string,
        languageCode: string,
        thumbnail: Thumbnail
    ): Promise<DocumentCollection> {
        const options = {
            body: {
                accountId,
                collectionId,
                title,
                languageCode,
                thumbnail
            }
        };
        return this.handleRequest("createCollectionInCollection", options);
    }

    createCollectionBackend(accountId: string, title: string, languageCode: string, thumbnail: Thumbnail, domainCollectionId: string): Promise<DocumentCollection> {
        const options = {
            body: {
                accountId,
                title,
                languageCode,
                thumbnail,
                domainCollectionId,
            }
        };
        return this.handleRequest("createCollectionBackend", options);
    }

    createRootCollection(accountId: string, accountName: string): Promise<DocumentCollection> {
        const options = {
            body: {
                accountId,
                accountName
            }
        };
        return this.handleRequest("createRootCollection", options);
    }

    updateCollectionIsHidden(collectionId: string, isHidden: boolean): Promise<DocumentCollection> {
        const options = {
            pathParams: {
                collectionId
            },
            body: {
                isHidden,
            }
        };
        return this.handleRequest("updateCollectionIsHidden", options);
    }

    updateCollectionThumbnail(collectionId: string, thumbnail: Thumbnail): Promise<DocumentCollection> {
        const options = {
            pathParams: {
                collectionId
            },
            body: {
                thumbnail
            }
        };
        return this.handleRequest("updateCollectionThumbnail", options);
    }

    removeCollectionThumbnail(collectionId: string, getCollectionOptions: IGetCollectionQueryOptions): Promise<DocumentCollection> {
        const handleRequestOptions = {
            pathParams: { collectionId },
            body: { options: getCollectionOptions }
        };
        return this.handleRequest("removeCollectionThumbnail", handleRequestOptions);
    }

    updateCollectionShowInOverview(collectionId: string, showInOverview: boolean): Promise<DocumentCollection> {
        const options = {
            pathParams: {
                collectionId
            },
            body: {
                showInOverview
            }
        };
        return this.handleRequest("updateCollectionShowInOverview", options);
    }

    saveCollectionTitle(collectionId: string, title: string, languageCode: string): Promise<DocumentCollection> {
        const options = {
            pathParams: {
                collectionId,
                languageCode
            },
            body: {
                title
            }
        };
        return this.handleRequest("saveCollectionTitle", options);
    }

    updateLanguageOfCollectionTitle(
        collectionId: string,
        currentLanguageCode: string,
        languageCode: string
    ): Promise<DocumentCollection> {
        const options = {
            body: {
                collectionId,
                currentLanguageCode,
                languageCode
            },
        };
        return this.handleRequest("updateLanguageOfCollectionTitle", options);
    }

    removeCollectionTitle(domain: string, collectionId: string, languageCode: string): Promise<DocumentCollection> {
        const options = {
            pathParams: {
                domain,
                collectionId,
                languageCode
            },
        };
        return this.handleRequest("removeCollectionTitle", options);
    }

    addElementToCollection(collectionId: string, kind: string, key: string, accountId: string): Promise<DocumentCollection> {
        const options = {
            pathParams: {
                collectionId
            },
            body: {
                kind,
                key,
                accountId,
            }
        };
        return this.handleRequest("addElementToCollection", options);
    }

    removeElementFromCollection(collectionId: string, kind: string, key: string, accountId: string, permanent?: boolean): Promise<DocumentCollection> {
        const options = {
            pathParams: {
                collectionId
            },
            body: {
                kind,
                key,
                accountId,
                permanent,
            }
        };
        return this.handleRequest("removeElementFromCollection", options);
    }

    changeElementPosition(collectionId: string, kind: string, key: string, newPosition: number): Promise<DocumentCollection> {
        const options = {
            pathParams: {
                collectionId
            },
            body: {
                kind,
                key,
                newPosition
            }
        };
        return this.handleRequest("changeElementPosition", options);
    }

    findCollections(filter: CollectionFilter, options: BinderSearchResultOptions): Promise<Array<DocumentCollection>> {
        const requestOptions = {
            body: {
                filter,
                options
            }
        };
        return this.handleRequest("findCollections", requestOptions);
    }

    findCollectionsFromClient(filter: CollectionFilter, options: BinderSearchResultOptions): Promise<Array<DocumentCollection>> {
        const requestOptions = {
            body: {
                filter,
                options
            }
        };
        return this.handleRequest("findCollectionsFromClient", requestOptions);
    }

    getCollection(collectionId: string, options: IGetCollectionQueryOptions = {}): Promise<DocumentCollection> {
        const requestOptions = {
            pathParams: {
                collectionId
            },
            queryParams: {
                inheritAncestorThumbnails: options.inheritAncestorThumbnails ? "true" : undefined,
                cdnifyThumbnails: options.cdnifyThumbnails ? "true" : undefined,
                accountId: options.accountId
            }
        };
        return this.handleRequest("getCollection", requestOptions);
    }

    async findReaderItemsWithInfo(filter: ReaderItemsFilter, options: IItemSearchOptions): Promise<ICollectionElementsWithInfo> {
        const requestOptions = {
            body: {
                options,
                filter
            }
        };
        const { items, languagesUsed, accountHasPublications } = await this.handleRequest<ICollectionElementsWithInfo>("findReaderItemsWithInfo", requestOptions);
        const parsedItems = items.map(item => ({
            ...item,
            thumbnail: Object.assign(Object.create(Thumbnail.prototype), item.thumbnail),
        }));
        return { accountHasPublications, items: parsedItems, languagesUsed };
    }

    getRootCollections(accountIds: string[]): Promise<DocumentCollection[]> {
        const options = {
            body: {
                accountIds
            }
        };
        return this.handleRequest("getRootCollections", options);
    }

    countAllPublicDocuments(accountId: string): Promise<number> {
        const options = {
            pathParams: {
                accountId,
            }
        };
        return this.handleRequest("countAllPublicDocuments", options);
    }

    getAncestors(itemId: string): Promise<DocumentAncestors> {
        const options = {
            pathParams: {
                itemId,
            }
        };
        return this.handleRequest("getAncestors", options);
    }

    getItemsAncestors(itemIds: string[]): Promise<DocumentAncestors> {
        const options = {
            body: {
                itemIds,
            }
        };
        return this.handleRequest("getItemsAncestors", options);
    }

    translate(accountId: string, html: string, sourceLanguageCode: string, targetLanguageCode: string, isHtml?: boolean): Promise<string> {
        const options = {
            body: {
                accountId,
                html,
                sourceLanguageCode,
                targetLanguageCode,
                isHtml,
            }
        };
        return this.handleRequest("translate", options);
    }

    getTranslationsAvailable(skipCache = false): Promise<IAzureTranslation[]> {
        return this.handleRequest("getTranslationsAvailable", {
            body: {
                skipCache
            }
        });
    }

    getSupportedLanguagesByEngine(skipCache = false): Promise<{ [engineType: string]: string[] }> {
        return this.handleRequest("getSupportedLanguagesByEngine", {
            body: {
                skipCache
            }
        });
    }

    detectLanguage(html: string): Promise<string> {
        const options = {
            body: {
                html
            }
        }
        return this.handleRequest("detectLanguage", options)
    }


    getAccountTotals(accountId: string): Promise<AccountTotals> {
        const options = {
            pathParams: {
                accountId
            }
        };
        return this.handleRequest("getAccountTotals", options);
    }

    getMostUsedLanguages(accountIds: string[]): Promise<string[]> {
        const options = {
            body: {
                accountIds,
            }
        };
        return this.handleRequest("getMostUsedLanguages", options);
    }

    updateChunkApprovals(binderId: string, filter: ChunkApprovalFilter, approvalStatus: ApprovedStatus): Promise<IChunkApproval[]> {
        const options = {
            body: { binderId, filter, approvalStatus }
        };
        return this.handleRequest("updateChunkApprovals", options);
    }

    approveChunk(
        binderId: string,
        chunkId: string,
        chunkLastUpdate: number,
        languageCode: string,
        approval: ApprovedStatus,
    ): Promise<IChunkApproval[]> {
        const options = {
            body: {
                binderId,
                chunkId,
                chunkLastUpdate,
                languageCode,
                approval,
            }
        };
        return this.handleRequest("approveChunk", options);
    }

    fetchApprovalsForBinder(binderId: string): Promise<IChunkApproval[]> {
        const options = {
            pathParams: {
                binderId,
            },
        };
        return this.handleRequest("fetchApprovalsForBinder", options);
    }

    saveChecklistActivation(binderId: string, chunkId: string, isActive: boolean): Promise<IChecklistConfig> {
        const options = {
            body: {
                binderId,
                chunkId,
                isActive
            }
        }
        return this.handleRequest("saveChecklistActivation", options)
    }

    getChecklistConfigs(binderId: string): Promise<IChecklistConfig[]> {
        const options = {
            pathParams: {
                binderId
            }
        }
        return this.handleRequest("getChecklistConfigs", options)
    }

    getMultiChecklistConfigs(binderIds: string[]): Promise<IChecklistConfig[]> {
        const options = {
            body: {
                binderIds
            }
        }
        return this.handleRequest("getMultiChecklistConfigs", options)
    }

    getChecklists(binderId: string): Promise<IChecklist[]> {
        const options = {
            pathParams: {
                binderId
            }
        }
        return this.handleRequest("getChecklists", options)
    }

    togglePerformed(
        id: string,
        performed: boolean,
        binderId: string,
        publicationId: string
    ): Promise<IChecklist> {
        const options = {
            pathParams: {
                binderId,
            },
            body: {
                id,
                performed,
                publicationId
            }
        }
        return this.handleRequest("togglePerformed", options)
    }

    getChecklistsProgress(binderIds: string[]): Promise<IChecklistProgress[]> {
        const options = {
            body: {
                binderIds
            }
        }
        return this.handleRequest("getChecklistsProgress", options)
    }

    getChecklistsActions(binderOrCollectionIds: string[]): Promise<IChecklistAction[]> {
        const options = {
            body: {
                binderOrCollectionIds
            }
        }
        return this.handleRequest("getChecklistsActions", options)
    }

    invalidatePublicItemsForAccount(accountId: string): Promise<void> {
        const options = {
            body: { accountId },
        }
        return this.handleRequest("invalidatePublicItemsForAccount", options);
    }

    async getAccountAncestorTree(accountId: string): Promise<AncestorTree> {
        const options = {
            pathParams: {
                accountId
            },
            skipJson: true
        };
        const result = await this.handleRequest<Record<string, string[]>>("getAccountAncestorTree", options);
        return AncestorTree.fromJSON(result);
    }

    getLanguageCodesUsedInCollection(collectionId: string, shouldAddPublicationPossibilities?: boolean): Promise<LanguageSummary[]> {
        const options = {
            pathParams: {
                collectionId
            },
            body: {
                shouldAddPublicationPossibilities,
            }
        }
        return this.handleRequest("getLanguageCodesUsedInCollection", options)
    }

    recursivePublish(collectionId: string, languages: string[], accountId: string): Promise<RecursiveOpeartionResult<PublicationSummary>> {
        const options = {
            pathParams: {
                collectionId
            },
            body: {
                accountId,
                languages,
            }
        }
        return this.handleRequest("recursivePublish", options)
    }

    recursiveUnpublish(collectionId: string, languageCodes: string[], accountId: string): Promise<RecursiveOpeartionResult<RecursiveUnpublishSummaryResult>> {
        const options = {
            pathParams: {
                collectionId
            },
            body: {
                accountId,
                languageCodes
            }
        }
        return this.handleRequest("recursiveUnpublish", options)
    }

    recursiveDelete(collectionId: string, accountId: string, parentCollectionId?: string): Promise<RecursiveOpeartionResult<RecursiveDeleteSummaryResult>> {
        const options = {
            pathParams: {
                collectionId
            },
            body: {
                accountId,
                parentCollectionId,
            }
        }
        return this.handleRequest("recursiveDelete", options)
    }
    recursiveTranslate(collectionId: string, targetLanguageCode: string, accountId: string): Promise<RecursiveOpeartionResult<Binder>> {
        const options = {
            pathParams: {
                collectionId
            },
            body: {
                accountId,
                targetLanguageCode
            }
        }
        return this.handleRequest("recursiveTranslate", options)
    }

    validateRecursiveAction(collectionId: string, operation: RecursiveAction): Promise<ValidationResult> {
        const options = {
            pathParams: {
                collectionId
            },
            body: {
                operation
            }
        }
        return this.handleRequest("validateRecursiveAction", options)
    }

    getCustomerMetricsCsv(): Promise<string> {
        return this.handleRequest("getCustomerMetricsCsv", {});
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getSingleCustomerMetricsCsv(_accountId: string): Promise<string> {
        return this.handleRequest("getSingleCustomerMetricsCsv", {});
    }

    generateTextToSpeech(
        paragraphs: string[],
        voiceOptions: ITTSVoiceOptions
    ): Promise<ITTSGenerateResponse> {
        const options = {
            body: {
                paragraphs,
                voiceOptions
            }
        }
        return this.handleRequest("generateTextToSpeech", options);
    }

    fetchTextToSpeechFile(): Promise<void> {
        throw new Error("Should be used directly as the src of an audio element");
    }

    listAvailableTTSLanguages(): Promise<string[]> {
        return this.handleRequest("listAvailableTTSLanguages", {});
    }

    recoverDeletedItem(
        itemId: string,
        accountId: string,
        newParentCollectionId: string
    ): Promise<void> {
        const options = {
            body: {
                itemId,
                accountId,
                newParentCollectionId
            }
        }
        return this.handleRequest("recoverDeletedItem", options);
    }

    purgeRecycleBins(): Promise<void> {
        return this.handleRequest("purgeRecycleBins", {});
    }

    relabelBinderLanguage(
        accountId: string,
        binderId: string,
        fromLanguageCode: string,
        toLanguageCode: string
    ): Promise<RelabelResult> {
        const options = {
            body: {
                accountId,
                binderId,
                fromLanguageCode,
                toLanguageCode,
            }
        }
        return this.handleRequest<RelabelResult>("relabelBinderLanguage", options);
    }

    deleteAllForAccount(accountId: string): Promise<void> {
        return this.handleRequest("deleteAllForAccount", {
            pathParams: {
                accountId
            }
        });
    }

    requestReview(
        accountId: string,
        binderId: string
    ): Promise<void> {
        return this.handleRequest("requestReview", {
            body: {
                accountId,
                binderId
            }
        });
    }

    getDescendantsMap(
        collectionId: string
    ): Promise<IDescendantsMap> {
        return this.handleRequest("getDescendantsMap", {
            pathParams: {
                collectionId
            }
        });
    }

    findBindersStatuses(
        accountId: string,
        options: FindBindersStatusesQueryParams = {}
    ): Promise<BinderStatus[]> {
        return this.handleRequest("findBindersStatuses", {
            body: {
                accountId,
                options
            }
        });
    }

    calculateBindersStatuses(accountId: string): Promise<BinderStatus[]> {
        return this.handleRequest("calculateBindersStatuses", {
            pathParams: {
                accountId,
            },
        });
    }

    summarizePublicationsForAccount<F extends PublicationSummaryFormat>( //T = PublicationsSummaryItem[]>(
        accountId: string,
        format: F = "json" as F,
    ): Promise<F extends "csv" ? string : PublicationsSummaryItem[]> {
        return this.handleRequest("summarizePublicationsForAccount", {
            pathParams: {
                accountId
            },
            queryParams: {
                format
            }
        });
    }

    summarizeDraftsForAccount<F extends PublicationSummaryFormat>(
        accountId: string,
        format: F = "json" as F,
    ): Promise<F extends "csv" ? string : DraftSummaryItem[]> {
        return this.handleRequest("summarizeDraftsForAccount", {
            pathParams: {
                accountId
            },
            queryParams: {
                format
            }
        });
    }

    getOwnershipForItems(itemIds: string[], accountId: string, expandGroups = false): Promise<DetailedItemOwnership[]> {
        return this.handleRequest("getOwnershipForItems", {
            body: {
                itemIds,
                accountId,
                expandGroups: `${expandGroups}`
            },
        });
    }

    setOwnershipForItem(itemId: string, ownership: ItemOwnership, accountId: string): Promise<void> {
        return this.handleRequest("setOwnershipForItem", {
            body: {
                itemId,
                ownership,
                accountId,
            }
        });
    }

    removeOwnerIdFromItemOwnershipForAccount(ownerId: string, accountId: string): Promise<void> {
        return this.handleRequest("removeOwnerIdFromItemOwnershipForAccount", {
            body: {
                ownerId,
                accountId,
            }
        });
    }

    getItemAndAncestorsReaderFeedbackConfigs(itemId: string): Promise<ReaderFeedbackConfigs> {
        return this.handleRequest("getItemAndAncestorsReaderFeedbackConfigs", { body: { itemId } });
    }

    getReaderFeedbackConfigForItems(itemIds: string[]): Promise<Record<string, ReaderFeedbackConfig>> {
        return this.handleRequest("getReaderFeedbackConfigForItems", {
            body: {
                itemIds
            }
        });
    }

    updateReaderFeedbackConfig(
        itemId: string,
        config: ReaderFeedbackConfig,
    ): Promise<ReaderFeedbackConfig> {
        return this.handleRequest("updateReaderFeedbackConfig", {
            body: {
                itemId,
                config: {
                    readerCommentsEnabled: config.readerCommentsEnabled ?? null,
                    readerRatingEnabled: config.readerRatingEnabled ?? null,
                    readConfirmationEnabled: config.readConfirmationEnabled ?? null,
                },
            }
        });
    }

    getFeedbacks(feedbackFilter: FeedbackFilter): Promise<IBinderFeedback[]> {
        return this.handleRequest("getFeedbacks", {
            body: { feedbackFilter },
        }
        )
    }

    getReaderItemContext(itemId: string, _?: string, options?: GetReaderItemContextOptions): Promise<ReaderItemContext> {
        return this.handleRequest("getReaderItemContext", {
            body: {
                itemId,
                options,
            },
        });
    }

    clearLastModifiedInfo(accountId: string, binderIds: string[]): Promise<void> {
        return this.handleRequest("clearLastModifiedInfo", {
            body: { accountId, binderIds },
        }
        )
    }

    updateChunkVisualSettings(binderId: string, chunkIdx: number, visualIdx: number, visualSettings: Partial<VisualSettings>): Promise<void> {
        return this.handleRequest("updateChunkVisualSettings", {
            body: { binderId, chunkIdx, visualIdx, visualSettings },
        });
    }

    getUserActivities(accountId: string): Promise<UserActivities> {
        return this.handleRequest("getUserActivities", {
            body: { accountId },
        });
    }

    restoreElasticDoc(indexName: string, documentId: string, document: unknown): Promise<void> {
        return this.handleRequest("restoreElasticDoc", {
            body: { indexName, documentId, document },
        });
    }
}
