import {
    ApprovedStatus,
    Binder,
    BinderFilter,
    ChunkApprovalFilter,
    DocumentAncestors,
    DocumentCollection,
    EditorItemSearchResult,
    IChecklistAction,
    IChecklistConfig,
    IChunkApproval,
    IGetCollectionQueryOptions,
    IItemSearchOptions,
    IMultiSearchOptions,
    IRecursiveAction,
    LanguageSummary,
    PublicationFindResult,
    PublicationSummary,
    RecursiveAction,
    RecursiveOpeartionResult,
    UserActivities,
    ValidationResult,
    VisualSettings
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import BinderClass, {
    create as createBinderObject,
    createNewBinder
} from "@binders/client/lib/binders/custom/class";
import { EditorEvent, captureFrontendEvent } from "@binders/client/lib/thirdparty/tracking/capture";
import {
    FEATURE_NOCDN,
    FEATURE_READONLY_EDITOR
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    deserializeEditorStates,
    serializeEditorStates
} from "@binders/client/lib/draftjs/helpers";
import { flatten, splitEvery } from "ramda";
import AccountStore from "../accounts/store";
import {
    BinderRepositoryServiceClient
} from "@binders/client/lib/clients/repositoryservice/v3/client";
import { ClientExportApiResponseFormat } from "@binders/client/lib/clients/client";
import { ExportServiceClient } from "@binders/client/lib/clients/exportservice/v1/client";
import { FlashMessages } from "../logging/FlashMessages";
import { IAllViewsStatistics } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { IPDFExportOptions } from "@binders/client/lib/clients/exportservice/v1/contract";
import { KEY_COLLECTION_REMOVE_ITEM } from "./store";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import {
    LaunchDarklyFlagsStoreGetters
} from "@binders/ui-kit/lib/thirdparty/launchdarkly/ld-flags-store";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import Thumbnail from "@binders/client/lib/clients/repositoryservice/v3/Thumbnail";
import { TrackingServiceClient } from "@binders/client/lib/clients/trackingservice/v1/client";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config";
import { detectTimeZone } from "@binders/client/lib/util/date";
import { dispatch } from "@binders/client/lib/react/flux/dispatcher";
import i18next from "@binders/client/lib/react/i18n";

export const SEARCH_RESULTS_LIMIT = 100;
const MAX_ITEMIDS_IN_BATCH = 1000;

const client = BinderRepositoryServiceClient.fromConfig(
    config,
    "v3",
    browserRequestHandler,
    AccountStore.getActiveAccountId.bind(AccountStore),
);
const exportClient = ExportServiceClient.fromConfig(
    config,
    "v1",
    browserRequestHandler,
    AccountStore.getActiveAccountId.bind(AccountStore),
);
const trackingClient = TrackingServiceClient.fromConfig(config, "v1", browserRequestHandler);

export const ActivePublicationsOption = { OnlyActive: 1, All: 2, AllExceptInactiveWithNoViews: 3 };

export async function APILoadItems(
    itemIds: string[],
    accountId: string,
    options?: IItemSearchOptions,
    additionalFilter?: BinderFilter
): Promise<(Binder | DocumentCollection)[]> {
    const itemIdBatches = splitEvery(MAX_ITEMIDS_IN_BATCH, itemIds);
    const itemArrays = await Promise.all(
        itemIdBatches.map(itemIdBatch => APILoadItemsBatch(itemIdBatch, accountId, options, additionalFilter))
    );
    return flatten(itemArrays);
}

export function APILoadItemsBatch(
    itemIds: string[],
    accountId: string,
    options?: IItemSearchOptions,
    additionalFilter?: BinderFilter,
): Promise<(Binder | DocumentCollection)[]> {

    if (!itemIds || itemIds.length === 0) {
        // eslint-disable-next-line
        console.error("Shortcutting invalid API call");
        return Promise.resolve([]);
    }
    const filter = {
        binderIds: itemIds,
        accountId,
        ...additionalFilter,
    };

    const accountFeaturesWD = AccountStore.getAccountFeatures();
    const cdnnify = !((accountFeaturesWD.result || []).includes(FEATURE_NOCDN));
    const isReadOnlyMode = (accountFeaturesWD.result || []).includes(FEATURE_READONLY_EDITOR);

    options = {
        binderSearchResultOptions: {
            maxResults: MAX_ITEMIDS_IN_BATCH,
            omitContentModules: true
        },
        cdnnify,
        isReadOnlyMode,
        includeTotalPublicDocumentsCount: false,
        ...(options || {}),
    };
    return client.findItemsForEditor(filter, options, accountId);
}

export function APICountAllPublicDocuments(accountId: string): Promise<number> {
    return client.countAllPublicDocuments(accountId);
}

export function APILoadBinder(binderId: string, options: IItemSearchOptions): Promise<Binder> {
    // the visuals populated with the format urls for client-side best fit determination
    // are provided by listVisuals, we can skip this here
    return client.getBinder(binderId, options);
}

export function APIPdfExport(
    publicationId: string,
    domain: string,
    exportOptions: IPDFExportOptions,
): Promise<string> {
    return exportClient.exportPublication(publicationId, domain, detectTimeZone(), exportOptions, "editor");
}

export function APIPdfPreview(
    publicationId: string,
    domain: string,
    exportOptions: IPDFExportOptions,
): Promise<string> {
    return exportClient.previewExportPublication(publicationId, domain, detectTimeZone(), exportOptions);
}
export async function APISaveBinder(binder: Binder): Promise<BinderClass> {
    try {
        const update = serializeEditorStates(binder);
        const newBinder = await client.updateBinder(update);
        return createBinderObject(deserializeEditorStates(newBinder));
    } catch (error) {
        const msg = error.statusCode === 401 ?
            i18next.t(TK.Edit_EditFailPerm) :
            i18next.t(TK.Edit_EditFailAutoSave);
        FlashMessages.error(msg);
        // eslint-disable-next-line no-console
        console.error(error);
        setTimeout(() => window.location.href = "/", 2000);
    }
}

export function APILoadCollection(id: string, accountId?: string): Promise<DocumentCollection> {
    return client.getCollection(id, {
        inheritAncestorThumbnails: true,
        cdnifyThumbnails: true,
        accountId
    });
}

export function APIMoveElementInCollection(
    collectionId: string,
    kind: string,
    key: string,
    newPosition: number,
): Promise<DocumentCollection> {
    if (!collectionId) {
        throw new Error(i18next.t(TK.DocManagement_CantMoveToNonExisting, { collectionId }));
    }
    return client.changeElementPosition(collectionId, kind, key, newPosition);
}

export function APISearchBindersAndCollections(
    query: string,
    accountId: string,
    cdnnify: boolean,
    isReadOnlyMode: boolean,
    multiSearchOptions: IMultiSearchOptions,
): Promise<EditorItemSearchResult> {
    return client.searchBindersAndCollections(
        query,
        {
            cdnnify,
            isReadOnlyMode,
            binderSearchResultOptions: {
                maxResults: SEARCH_RESULTS_LIMIT,
            },
        },
        accountId,
        multiSearchOptions,
    );
}

export function APICreateCollectionInCollection(
    accountId: string,
    collectionId: string,
    title: string,
    language: string,
    thumbnail: Thumbnail,
): Promise<DocumentCollection> {
    return client.createCollectionInCollection(accountId, collectionId, title, language, thumbnail);
}

export async function APICreateBinder(
    binder: BinderClass,
    collectionId: string,
    accountId: string
): Promise<BinderClass> {
    const deserializeCreateBinderEditorStates = await client.createBinderInCollection(
        serializeEditorStates(binder),
        collectionId,
        accountId,
    );
    captureFrontendEvent(EditorEvent.DocumentCreated);
    return createBinderObject(deserializeCreateBinderEditorStates);
}

export async function APIDuplicateBinder(
    binder: Binder,
    collectionId: string,
    fromAccountId: string,
    toAccountId: string
): Promise<BinderClass> {
    try {
        const deserializeDuplicateBinderEditorStates = await client.duplicateBinder(
            binder,
            collectionId,
            fromAccountId,
            toAccountId
        );
        return createBinderObject(deserializeDuplicateBinderEditorStates);
    }
    catch (error) {
        FlashMessages.error(`${i18next.t(TK.DocManagement_DuplicateFailDoc)}: ${error.message}`);
        throw error;
    }
}

export async function APIDuplicateCollection(
    collectionId: string,
    targetCollectionId: string,
    targetDomainCollectionId: string,
    fromAccountId: string,
    toAccountId: string
): Promise<DocumentCollection> {
    try {
        return await client.duplicateCollection(
            collectionId,
            targetCollectionId,
            targetDomainCollectionId,
            fromAccountId,
            toAccountId
        );
    }
    catch (error) {
        FlashMessages.error(`${i18next.t(TK.DocManagement_DuplicateFailCol)}: ${error.message}`);
        throw error;
    }
}

export function APISaveNewBinder(title: string, collectionId: string, isoCode: string, accountId: string): Promise<BinderClass> {
    const shouldUseNewTextEditor = LaunchDarklyFlagsStoreGetters.getLaunchDarklyFlags()[LDFlags.USE_TIP_TAP] as boolean;
    return APICreateBinder(createNewBinder(title, isoCode, accountId, 1, shouldUseNewTextEditor), collectionId, accountId);
}

export function APIAddElementToCollection(
    collectionId: string,
    kind: "document" | "collection",
    itemId: string,
    accountId: string,
): Promise<DocumentCollection> {
    if (!collectionId) {
        throw new Error(i18next.t(TK.DocManagement_CantAddToNonExisting, { collectionId }));
    }
    return client.addElementToCollection(collectionId, kind, itemId, accountId);
}

export function APIRemoveElementFromCollection(
    collectionId: string,
    kind: "document" | "collection",
    itemId: string,
    accountId: string,
    permanent?: boolean,
): Promise<DocumentCollection> {
    if (!collectionId) {
        throw new Error(i18next.t(TK.DocManagement_CantRemoveFromNonExisting, { collectionId }));
    }
    return client.removeElementFromCollection(collectionId, kind, itemId, accountId, permanent);
}

export function APISaveCollectionTitle(
    collectionId: string,
    languageCode: string,
    title: string,
): Promise<DocumentCollection> {
    return client.saveCollectionTitle(collectionId, title, languageCode);
}

export function APIUpdateLanguageOfCollectionTitle(
    collectionId: string,
    currentLanguageCode: string,
    languageCode: string,
): Promise<DocumentCollection> {
    return client.updateLanguageOfCollectionTitle(collectionId, currentLanguageCode, languageCode);
}

export function APIRemoveCollectionTitle(
    domain: string,
    collectionId: string,
    languageCode: string,
): Promise<DocumentCollection> {
    return client.removeCollectionTitle(domain, collectionId, languageCode);
}

export function APIMostUsedLanguages(
    accountId: string,
): Promise<string[]> {
    return client.getMostUsedLanguages([accountId]);
}

export function getRootCollections(accountIds: string[]): Promise<DocumentCollection[]> {
    return client.getRootCollections(accountIds);
}

export function APIDeleteCollection(collectionId: string, accountId: string): Promise<DocumentCollection> {
    return client.deleteCollection(collectionId, accountId);
}

export function APIDeleteBinder(
    binderId: string,
    accountId: string,
    permanent?: boolean
): Promise<Binder> {
    return client.deleteBinder(binderId, accountId, permanent);
}

export function APIUnpublishBinder(
    binderId: string,
    languageCodes: string[],
): Promise<PublicationSummary[]> {
    return client.unpublish(binderId, languageCodes);
}

export function APIUpdatePublicationsLanguages(
    binderId: string,
    languageCode: string,
    order: string[],
): Promise<PublicationSummary[]> {
    return client.updatePublicationsLanguages(binderId, languageCode, order);
}

export async function APILoadPublications(
    binderId: string,
    activePublicationsOption = ActivePublicationsOption.OnlyActive,
    extraInfo = false,
    summary = false,
    resolvePublishedBy = false,
): Promise<PublicationFindResult[]> {
    const options = {
        binderSearchResultOptions: {
            maxResults: 10000,
            ...(extraInfo ? { includeViews: true, includeChunkCount: true } : {}),
            summary: !!summary,
        },
        resolvePublishedBy: !!resolvePublishedBy,
        skipPopulateVisuals: true,
    };
    const { OnlyActive, AllExceptInactiveWithNoViews } = ActivePublicationsOption;
    let filter = {}
    if (activePublicationsOption === OnlyActive) {
        filter = { isActive: 1 };
    } else if (activePublicationsOption === AllExceptInactiveWithNoViews) {
        filter = { isActiveOrHasViews: true }
    }
    return client.findPublications(binderId, filter, options);
}

export function APIPublishBinder(
    binderId: string,
    languageCodes: string[],
    sendNotification = true
): Promise<PublicationSummary[]> {
    return client.publish(binderId, languageCodes, sendNotification);
}

export function APILoadItemsAncestors(itemIds: string[]): Promise<DocumentAncestors> {
    return client.getItemsAncestors(itemIds)
}

export function APIUpdateCollectionThumbnail(
    collectionId: string,
    thumbnail: Thumbnail,
): Promise<DocumentCollection> {
    return client.updateCollectionThumbnail(collectionId, thumbnail);
}

export function APIRemoveCollectionThumbnail(
    collectionId: string,
    options: IGetCollectionQueryOptions
): Promise<DocumentCollection> {
    return client.removeCollectionThumbnail(collectionId, options);
}

export function APIGetViewsStatistics(
    itemIds: string[],
    accountId: string,
): Promise<IAllViewsStatistics> {
    return trackingClient.allViewsStatistics(itemIds, accountId);
}

export async function APIGetBinder(binderId: string, options?: IItemSearchOptions): Promise<BinderClass> {
    const binder = await client.getBinder(binderId, options);
    return createBinderObject(binder);
}

export async function APIGetRootCollection(accountId: string): Promise<DocumentCollection> {
    const [rootCollection] = await client.getRootCollections([accountId]);
    return rootCollection;
}

export async function APIGetChunkApprovalsForBinder(binderId: string): Promise<IChunkApproval[]> {
    return client.fetchApprovalsForBinder(binderId);
}

export async function APIGetChecklistConfigs(binderId: string): Promise<IChecklistConfig[]> {
    return client.getChecklistConfigs(binderId);
}

export function APIGetMultiChecklistConfigs(binderIds: string[]): Promise<IChecklistConfig[]> {
    return client.getMultiChecklistConfigs(binderIds);
}

export async function APIUpdateChunkApprovals(
    binderId: string,
    filter: ChunkApprovalFilter,
    approvalStatus: ApprovedStatus,
): Promise<IChunkApproval[]> {
    return client.updateChunkApprovals(binderId, filter, approvalStatus);
}

export async function APIApproveChunk(
    binderId: string,
    chunkId: string,
    languageCode: string,
    chunkLastUpdate: number,
    approved: ApprovedStatus,
): Promise<IChunkApproval[]> {
    return client.approveChunk(
        binderId,
        chunkId,
        chunkLastUpdate,
        languageCode,
        approved,
    );
}

export async function APIDetectLanguage(html: string): Promise<string> {
    return client.detectLanguage(html)
}

export async function APISaveChecklistActivation(binderId: string, chunkId: string, isActive: boolean): Promise<IChecklistConfig> {
    return client.saveChecklistActivation(binderId, chunkId, isActive);
}

export async function APIGetLanguagesUsedInCollection(collectionId: string, shouldAddPublicationPossibilities?: boolean): Promise<LanguageSummary[]> {
    return client.getLanguageCodesUsedInCollection(collectionId, shouldAddPublicationPossibilities);
}

export async function APIValidateRecursiveAction(collectionId: string, action: IRecursiveAction): Promise<ValidationResult> {
    return client.validateRecursiveAction(collectionId, action.type).catch(() => {
        throw new Error(i18next.t(TK.Edit_RecursiveModalErrorUnexpected))
    })
}

export async function APIDoRecursiveAction(
    collectionId: string,
    parentCollectionId: string,
    action: IRecursiveAction,
    payload: { accountId: string; languages?: string[] }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<RecursiveOpeartionResult<any>> {
    try {
        switch (action.type) {
            case RecursiveAction.DELETE: {
                const result = await client.recursiveDelete(collectionId, payload.accountId, parentCollectionId);
                dispatch({
                    type: KEY_COLLECTION_REMOVE_ITEM,
                    body: { itemId: collectionId }
                });
                return result;
            }
            case RecursiveAction.PUBLISH:
                return await client.recursivePublish(collectionId, payload.languages, payload.accountId)
            case RecursiveAction.UNPUBLISH:
                return await client.recursiveUnpublish(collectionId, payload.languages, payload.accountId)
            case RecursiveAction.TRANSLATE:
                return await client.recursiveTranslate(collectionId, payload.languages[0], payload.accountId)
        }
    } catch (error) {
        throw new Error(i18next.t(TK.Edit_RecursiveModalErrorUnexpected))
    }
}

export async function APIRequestReview(
    accountId: string,
    binderId: string
): Promise<void> {
    return client.requestReview(accountId, binderId);
}

export async function APIGetChecklistsActions(
    binderOrCollectionIds: string[]
): Promise<IChecklistAction[]> {
    return client.getChecklistsActions(binderOrCollectionIds);
}

export function APISummarizePublicationsForAccountCsv(accountId: string): Promise<string> {
    return client.summarizePublicationsForAccount(accountId, "csv");
}

export function APISummarizeDraftsForAccountCsv(accountId: string): Promise<string> {
    return client.summarizeDraftsForAccount(accountId, "csv");
}

export function APIDocInfosCsv(accountId: string): Promise<string> {
    return exportClient.docInfosCsv(accountId);
}

export function APIColInfosCsv(accountId: string): Promise<string> {
    return exportClient.colInfosCsv(accountId);
}

export function APIExportBinderFeedbacks(binderId: string): Promise<string> {
    return client.exportBinderFeedbacks(binderId, ClientExportApiResponseFormat.CSV);
}

export async function APIGetUserActivities(accountId: string): Promise<UserActivities> {
    const response = await client.getUserActivities(accountId);
    return response.map(ua => ({
        ...ua,
        latestCommentDate: new Date(ua.latestCommentDate),
    }));
}

export function APIUpdateChunkVisualSettings(binderId: string, chunkIdx: number, visualIdx: number, visualSettings: Partial<VisualSettings>): Promise<void> {
    return client.updateChunkVisualSettings(binderId, chunkIdx, visualIdx, visualSettings);
}
