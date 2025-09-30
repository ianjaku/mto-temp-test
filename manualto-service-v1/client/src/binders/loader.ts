/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import * as ExportApiClient from "@binders/client/lib/clients/exportservice/v1/client";
import * as FlashMessageModule from "@binders/client/lib/react/flashmessages/actions";
import * as RepositoryApiClient from "@binders/client/lib/clients/repositoryservice/v3/client";
import * as RoutingApiClient from "@binders/client/lib/clients/routingservice/v1/client";
import * as UserApiClient from "@binders/client/lib/clients/userservice/v1/client";
import * as browserRequestHandler from "@binders/client/lib/clients/browserClient";
import {
    Binder,
    BinderModules,
    BinderOrDocumentCollection,
    ContentChunkKind,
    DocumentCollection,
    GetReaderItemContextOptions,
    ICollectionElementsWithInfo,
    Publication,
    ReaderItemContext,
    ReaderItemSearchResult,
    ReaderItemsFilter
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { IReaderItemsWithInfo, ItemStory } from "./contract";
import {
    ReaderEvent,
    captureFrontendEvent
} from "@binders/client/lib/thirdparty/tracking/capture";
import { getReaderDomain, isBrowseSubpath, toFullPath, withoutPathPrefix } from "../util";
import { AccountStoreGetters } from "../stores/zustand/account-store";
import { BinderStoreGetters } from "../stores/zustand/binder-store";
import { BinderVisual } from "@binders/client/lib/clients/repositoryservice/v3/BinderVisual";
import { ClientError } from "@binders/client/lib/clients/client";
import { FEATURE_READ_SCOPES } from "@binders/client/lib/clients/accountservice/v1/contract";
import ManualToRoutes from "@binders/client/lib/util/readerRoutes";
import { READERS_SCOPE } from "../utils/routes";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import { UiErrorCode } from "@binders/client/lib/errors";
import { UserDetails } from "@binders/client/lib/clients/userservice/v1/contract";
import { detectTimeZone } from "@binders/client/lib/util/date";
import { differenceInSeconds } from "date-fns";
import { getQueryStringVariable } from "@binders/client/lib/util/uri";
import i18next from "@binders/client/lib/react/i18n";
import { toBinderStories } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import tokenStore from "@binders/client/lib/clients/tokenstore";

const FlashMessages = FlashMessageModule.FlashMessageActions;

const getServiceLocation = serviceName => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).bindersConfig.api.locations[serviceName]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (window as any).bindersConfig.api.locations[serviceName];
    } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (window as any).bindersConfig.api.locations.default;
    }
};

const ES_MAX_RESULTS = 10000
const userApiLocation = getServiceLocation("user") + "/user/v1";
// For the user service we use the exteranlUserHandler
// This handler will use the users API token, except if the user is accessing
// content of an account he is not a member of, in which case the external user token
// will be used. This way we can fetch the user details of the logged in user correctly
const UserApi = new UserApiClient.UserServiceClient(
    userApiLocation,
    browserRequestHandler.externalUserHandler,
    AccountStoreGetters.getActiveAccountId,
);

const repositoryApiLocation = getServiceLocation("binders") + "/binders/v3";
const RepositoryApi = new RepositoryApiClient.BinderRepositoryServiceClient(
    repositoryApiLocation,
    browserRequestHandler.default,
    AccountStoreGetters.getActiveAccountId,
);
const routingApiLocation = getServiceLocation("routing") + "/routing/v1";
const RoutingApi = new RoutingApiClient.RoutingServiceClient(
    routingApiLocation,
    browserRequestHandler.default
);
const exportApiLocation = getServiceLocation("export") + "/export/v1";
const ExportApi = new ExportApiClient.ExportServiceClient(
    exportApiLocation,
    browserRequestHandler.default,
    AccountStoreGetters.getActiveAccountId,
);

export function getReaderScope(): string {
    return getQueryStringVariable(READERS_SCOPE);
}

export async function getReaderItemsWithInfo(
    preferredLanguages: string[],
): Promise<IReaderItemsWithInfo> {
    const filter: ReaderItemsFilter = {
        summary: true,
        preferredLanguages,
    };
    const readerDomain = getReaderDomain();
    if (readerDomain) {
        filter.domain = readerDomain;
    }
    const cdnnify = AccountStoreGetters.featuresCdn();
    const skipCache = !!(getQueryStringVariable("isTest"));
    const options = {
        binderSearchResultOptions: { maxResults: 2000 },
        cdnnify,
        readerScope: getReaderScope(),
        skipCache,
    };
    const pubInfo = await RepositoryApi.findReaderItemsWithInfo(filter, options);

    const { items: foundItems, languagesUsed, accountHasPublications } = pubInfo;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const collections: Array<any> = foundItems.filter(item => "isRootCollection" in item);
    const publications: Publication[] = foundItems.filter(item => !("isRootCollection" in item)) as Publication[];
    const binderStories = toBinderStories(publications);
    const items = collections.concat(binderStories);
    return {
        items,
        languagesUsed,
        accountHasPublications
    };
}

export async function maybeFetchCollection(collectionId: string): Promise<DocumentCollection | ItemStory> {
    if (collectionId === undefined) {
        return undefined;
    }
    const item = BinderStoreGetters.getItem(collectionId);
    if (item === undefined) {
        return RepositoryApi.getCollection(collectionId, {
            inheritAncestorThumbnails: true,
            cdnifyThumbnails: true
        });
    }
    return item.original;
}

export async function getCollectionElementsWithInfo(
    collectionId: string,
    preferredLanguageCodes: string[],
): Promise<ICollectionElementsWithInfo> {
    const domain = getReaderDomain();
    const cdnnify = AccountStoreGetters.featuresCdn();
    return RepositoryApi.getCollectionElementsWithInfo(
        collectionId,
        domain,
        { cdnnify, preferredLanguageCodes },
    );
}

function extractReadScope(currentCollectionId = "") {
    if (!AccountStoreGetters.features(FEATURE_READ_SCOPES)) {
        return undefined;
    }
    if (getReaderScope()) {
        return undefined;
    }
    if (currentCollectionId) {
        return currentCollectionId;
    }
    const currentPath = withoutPathPrefix(window.location.pathname);
    if (isBrowseSubpath(currentPath)) {
        const collectionId = currentPath
            .split("/")
            .pop();
        return collectionId === "browse" ? undefined : collectionId;
    }
    return currentPath.startsWith("/") ?
        currentPath.slice(1) :
        currentPath;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const handleContentLoadingError = (error: any, currentCollectionId = ""): void => {
    // eslint-disable-next-line no-console
    console.error(error);
    // for private manuals redirection after 401
    captureFrontendEvent(ReaderEvent.BindersLoaderError, { message: error?.message, statusCode: error?.statusCode });
    if (error.message.indexOf(" the network is offline") > -1) {
        return;
    }
    if (!(error instanceof ClientError)) {
        return;
    }
    const statusCode = error.statusCode;
    if (statusCode === 401) {
        if (tokenStore.isPublic()) {
            const reason = UiErrorCode.loginToAccess;
            const currentSearch = window.location.search.replace("?", "&");
            captureFrontendEvent(ReaderEvent.BindersLoaderRedirect, { kind: "401_public_access", to: ManualToRoutes.LOGIN, reason });
            window.location.href = `${toFullPath(ManualToRoutes.LOGIN)}?redirectUrl=${window.location.pathname}${currentSearch}&reason=${reason}`;
            return;
        }
        const readScope = extractReadScope(currentCollectionId);
        if (readScope) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const allPreviousParams = (window as any).location.search.replace("?", "");
            const suffixParams = allPreviousParams ? `&${allPreviousParams}` : "";
            captureFrontendEvent(ReaderEvent.BindersLoaderRedirect, { kind: "401_read_scope", to: ManualToRoutes.BROWSE });
            window.location.href = `${toFullPath(ManualToRoutes.BROWSE)}?${READERS_SCOPE}=${readScope}${suffixParams}`;
            return;
        }
        const searchParams = new URLSearchParams(window.location.search);
        const nextSearch = searchParams.toString().length ? `?${searchParams.toString()}` : "";
        captureFrontendEvent(ReaderEvent.BindersLoaderRedirect, { kind: "401_general", to: ManualToRoutes.ROUTE_401 });
        window.location.href = `${toFullPath(ManualToRoutes.ROUTE_401)}${nextSearch}`;
        return null;
    }
    if (statusCode === 404) {
        captureFrontendEvent(ReaderEvent.BindersLoaderRedirect, { kind: "404_general", to: ManualToRoutes.NOT_FOUND });
        window.location.href = toFullPath(ManualToRoutes.NOT_FOUND, { includeCurrentQueryString: true });
        return null;
    }
    if (statusCode >= 400 && error.statusCode < 500) {
        const reason = UiErrorCode.loginToAccess;
        captureFrontendEvent(ReaderEvent.BindersLoaderRedirect, { kind: "4xx_general", to: ManualToRoutes.LOGIN, reason, statusCode });
        window.location.href = `${toFullPath(ManualToRoutes.LOGIN)}?reason=${reason}`;
        return null;
    }
    const reason = UiErrorCode.general;
    captureFrontendEvent(ReaderEvent.BindersLoaderRedirect, { kind: "unidentified_error", to: ManualToRoutes.LOGIN, reason, statusCode });
    window.location.href = `${toFullPath(ManualToRoutes.LOGIN)}?reason=${reason}`;
};

export const loadPublication = id => {
    const cdnnify = AccountStoreGetters.featuresCdn();
    const publication = RepositoryApi.getPublication(id, { cdnnify }).catch(error => {
        handleContentLoadingError(error);
        FlashMessages.error(i18next.t(TranslationKeys.DocManagement_CantLoadManual, { error: error.message }));
    });
    return publication;
};

export const findPublications = async (binderId, languageCodes = undefined) => {
    const cdnnify = AccountStoreGetters.featuresCdn();
    const options = { binderSearchResultOptions: { maxResults: 2000 }, cdnnify };
    const filter = { isActive: 1, languageCodes };
    return RepositoryApi.findPublications(binderId, filter, options);
};

export const loadBinder = id => {
    const cdnnify = AccountStoreGetters.featuresCdn();
    const binder = RepositoryApi.getBinder(
        id,
        { cdnnify, includeVisualsStatus: true }
    ).catch(error => {
        handleContentLoadingError(error);
        FlashMessages.error(i18next.t(TranslationKeys.DocManagement_CantLoadPreview, { error: error.message }));
    });
    return binder;
};

export const getAccountsForDomain = domain => {
    return RoutingApi.getAccountsForDomain(domain);
}

export async function searchPublicationsAndCollections(query, preferredLanguages, scopeCollectionId): Promise<ReaderItemSearchResult> {
    const domain = getReaderDomain();
    const cdnnify = AccountStoreGetters.featuresCdn();
    const skipCache = !!(getQueryStringVariable("isTest"));
    try {
        const readerItemSearchResult = await RepositoryApi.searchPublicationsAndCollections(
            query,
            {
                binderSearchResultOptions: {
                    maxResults: 100,
                    preferredLanguages
                },
                cdnnify,
                skipCache,
            },
            domain,
            {
                prioritizedScopeCollectionId: scopeCollectionId,
            },
        );
        return readerItemSearchResult;
    }
    catch (error) {
        if (
            error?.errorDetails?.name === "UnsupportedLanguageError" &&
            error?.errorDetails?.languageCodes?.length > 0
        ) {
            FlashMessages.error(
                i18next.t(TranslationKeys.Edit_TranslateFailUnsupportedLanguage,
                    { unsupportedLanguage: error.errorDetails.languageCodes[0], count: 1 }
                )
            );
            return;
        }
        FlashMessages.error(i18next.t(TranslationKeys.DocManagement_CantSearchManuals, { error: error.message }));
    }
}

export const myDetails = async (): Promise<UserDetails | undefined> => {
    try {
        return await UserApi.myDetails();
    } catch (error) {
        FlashMessages.error(i18next.t(TranslationKeys.User_CantLoadSettings, { error: error.message }));
        return undefined;
    }
};

export const updateUserPreferences = (userId: string, update: Record<string, unknown>) => {
    return UserApi.savePreferences(userId, update).catch(error =>
        FlashMessages.error(i18next.t(TranslationKeys.User_CantUpdateSettings, { error: error.message }))
    );
};

export const getUserPreferences = (userId: string) => {
    return UserApi.getPreferences(userId).catch(error =>
        FlashMessages.error(i18next.t(TranslationKeys.User_CantLoadSettings, { error: error.message }))
    );
};

export const getReaderLanguages = userId => {
    return UserApi.getPreferences(userId).catch(error =>
        FlashMessages.error(i18next.t(TranslationKeys.User_CantLoadSettings, { error: error.message }))
    );
};

export const updateUser = (user, accountId) => {
    return UserApi.updateUser(user, accountId).catch(error =>
        FlashMessages.error(i18next.t(TranslationKeys.User_CantLoadDetails, { error: error.message }))
    );
};

export const APILoadAncestors = docId => {
    return RepositoryApi.getDocumentResourceDetails(docId);
}

const getAncestorsApiCalls = {};

export const APIGetItemsAncestors = itemIds => {
    if (itemIds.length === 0) {
        return Promise.resolve({});
    }
    let getAncestorsApiCall = getAncestorsApiCalls[itemIds]; // quick and dirty caching mechanism, as this call is used in parent path context and thumbnail inheritance
    if (!getAncestorsApiCall || differenceInSeconds(new Date(), getAncestorsApiCall.timestamp) > 5) {
        getAncestorsApiCall = {
            timestamp: new Date(),
            responsePromise: RepositoryApi.getItemsAncestors(itemIds),
        };
        getAncestorsApiCalls[itemIds] = getAncestorsApiCall;
    }
    return getAncestorsApiCall.responsePromise;
}

export const APIGetReaderItemContext = (itemId: string, options: GetReaderItemContextOptions): Promise<ReaderItemContext> => {
    return RepositoryApi.getReaderItemContext(itemId, undefined, options);
}

export const APILoadItems = async (itemIds, accountId) => {
    const filter = {
        domain: getReaderDomain(),
        ids: itemIds,
        binderIds: itemIds
    };
    const options = {
        maxResults: 2000
    };
    return RepositoryApi.findPublicationsAndCollections(filter, options, accountId);
}

export const APIFindItems = (itemIds: string[], accountId: string): Promise<BinderOrDocumentCollection[]> => {
    if (!itemIds || itemIds.length === 0) {
        // eslint-disable-next-line
        console.error("Shortcutting invalid API call");
        return Promise.resolve([]);
    }

    const filter = {
        binderIds: itemIds,
        domain: getReaderDomain(),
    };
    const options = {
        binderSearchResultOptions: {
            maxResults: ES_MAX_RESULTS,
        },
    };
    return RepositoryApi.findItemsForReader(filter, options, accountId);
}

export const APIFindCollections = itemIds => {
    if (itemIds.length === 0) {
        return Promise.resolve([]);
    }
    const filter = { ids: itemIds, domain: getReaderDomain() };
    const options = { maxResults: 512 };
    return RepositoryApi.findCollectionsFromClient(filter, options);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function APIPdfExport(publicationId, domain, exportOptions): Promise<any> {
    return ExportApi.exportPublication(publicationId, domain, detectTimeZone(), exportOptions, "reader");
}

export const APITranslateHTMLChunk = (accountId, html, sourceLanguageCode, targetLanguageCode) => RepositoryApi.translate(
    accountId,
    html,
    sourceLanguageCode,
    targetLanguageCode,
    true,
);

export const APIAddManualToChunk = async (
    binderOrPub: Binder | Publication,
    additionalChunks: ContentChunkKind[],
    translatedText: string,
): Promise<BinderModules> => {
    const modules = await RepositoryApi.extendChunks(
        binderOrPub,
        additionalChunks,
        translatedText,
    );
    modules.images.chunked = modules.images.chunked.map(m => {
        return {
            ...m,
            chunks: m.chunks.map(
                (ch) => ch.length > 0 ?
                    (ch.map(c => c ?
                        Object.assign(Object.create(BinderVisual.prototype), c) :
                        {})
                    ) :
                    []
            ),
        };
    });
    return modules;
}

export const APIGetAvailableTranslations = () => RepositoryApi.getTranslationsAvailable();
export const APIGetPDFExportOptions = (binderId, languageCode) => ExportApi.getPdfExportOptionsForBinder(binderId, languageCode);
