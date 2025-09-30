import * as emailRegex from "email-regex";
import {
    APIAddManualToChunk,
    APIFindCollections,
    APIGetAvailableTranslations,
    APIGetItemsAncestors,
    APIGetReaderItemContext,
    APILoadAncestors,
    APILoadItems,
    APIPdfExport,
    APITranslateHTMLChunk,
    findPublications,
    getAccountsForDomain,
    getCollectionElementsWithInfo,
    getReaderItemsWithInfo,
    handleContentLoadingError,
    loadBinder,
    loadPublication,
    maybeFetchCollection,
    searchPublicationsAndCollections
} from "./loader";
import { APIGetChecklists, APIGetChecklistsProgress } from "../api/repositoryService";
import { AccountStoreGetters, getAccountStoreActions } from "../stores/zustand/account-store";
import {
    AccountSummary,
    FEATURE_CHECKLISTS
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    Binder,
    BinderModules,
    BindersChunkedTextModule,
    DocumentCollection,
    IBinderStory,
    Item,
    Publication,
    PublicationFindResult,
    ReaderItemSearchResult
} from "@binders/client/lib/clients/repositoryservice/v3/contract";

import { BinderStoreGetters, NormalizedReaderSearchResult, getBinderStoreActions } from "../stores/zustand/binder-store";
import {
    CollectionSearchHitClient,
    IClientContext,
    ICollectionStory,
    IFieldSearchHitsClient,
    IReaderItemsWithInfo,
    PublicationSearchHitClient
} from "./contract";
import {
    extractItemsFromResourceGroups,
    getAllReadableItemsPermissions
} from "../api/authorizationService";
import { getReaderDomain, isBrowseOrReadPath, isLaunchPath, rewriteUrlIfProxy } from "../util";
import { BinderVisual } from "@binders/client/lib/clients/repositoryservice/v3/BinderVisual";
import { ContentChunkKind } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { IBindersConfig } from "@binders/client/lib/clients/config";
import { IPDFExportOptions } from "@binders/client/lib/clients/exportservice/v1/contract";
import { MANUALTO_CHUNK_DATAPROP } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { ParentPathContext } from "../routes/contract";
import { RouteComponentProps } from "react-router-dom";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import { UserStoreGetters } from "../stores/zustand/user-store";
import { buildAncestorsObject } from "@binders/client/lib/ancestors";
import { buildSearchTerms } from "@binders/client/lib/util/elastic";
import { flatten } from "ramda";
import { getAllLanguageCodes } from "@binders/client/lib/languages/helper";
import { getChecklistStoreActions } from "../stores/zustand/checklist-store";
import { getTrackingStoreActions } from "../stores/zustand/tracking-store";
import i18next from "@binders/client/lib/react/i18n";
import { i18nextResources } from "@binders/client/lib/i18n/resources";
import { navigateToContentNotFound } from "../navigation";
import { resetIndicesToDefault } from "../stores/zustand/chunk-position-store";
import tokenStore from "@binders/client/lib/clients/tokenstore";

function activateDocument(document: Binder | Publication, documentType: "binder" | "publication", languageCodeForPreview: string) {
    getBinderStoreActions().setActiveDocument({
        documentType,
        languageCodeForPreview,
        document: rewriteDocumentWithProxy(document),
    })
}

export function activatePublication(publication: Publication): void {
    getTrackingStoreActions().createTrackingDocumentSessionId();
    activateDocument(publication, "publication", undefined);
    if (!tokenStore.isPublic()) {
        loadChecklistsAsync(publication.binderId)
    }
}

function buildParentPath(itemId, ancestors, items, acc) {
    if (acc === undefined) {
        acc = [];
    }
    const item = items.find(i => i.id === itemId);
    if (item === undefined) {
        return acc.reverse();
    }
    acc.push(item);
    const newAncestors = ancestors[itemId];
    if (newAncestors === undefined || newAncestors.length === 0) {
        return acc.reverse();
    }
    return buildParentPath(newAncestors[0], ancestors, items, acc);
}

export function clearSearchResults(): void {
    getBinderStoreActions().setSearchResults({
        totalHitCount: 0,
        hits: []
    });
}

// check to eliminate false positives (eg. matches in inline css)
function containsSearchTerms(
    context = "",
    searchTerms: string[] = [] as string[]
) {
    const matches = (searchTerm: string) => {
        const escapedSearchTerm = searchTerm
            .replace(/"/g, "")
            .replace(/\*/g, ".*")
            .replace(/\+/g, ".+");
        return new RegExp("^.*" + escapedSearchTerm + ".*$", "gi").test(context.replace(/\n/g, " "));
    }
    return searchTerms.some(matches);
}

function copySameVisuals(newImages, oldImages) {
    const i1 = newImages.chunked[0].chunks;
    const i2 = oldImages.chunked[0].chunks;
    const i2Flattened = flatten(i2);
    return i1.map(chunkImages => {
        return chunkImages.map(image => {
            const sameImage = i2Flattened.find(({ id }) => id === image.id);
            if (sameImage) {
                return Object.assign(Object.create(BinderVisual.prototype), {
                    ...image,
                    formatUrls: sameImage.formatUrls,
                    url: sameImage.url,
                    urlToken: sameImage.urlToken
                });
            }
            return image;
        })
    })
}

async function extendPublication(
    pub: Publication | Binder,
    { accountId, langCode, additionalChunks }: { accountId: string, langCode: string, additionalChunks: ContentChunkKind[] },
): Promise<void> {
    let newModules = pub.modules;

    if (additionalChunks.length > 0) {
        const translatedText = await translateAdditionalChunk(accountId, langCode);
        newModules = await APIAddManualToChunk(pub, additionalChunks, translatedText);
    }

    pub.modules = newModules;
}

export async function findAndActivatePublication(
    router: RouteComponentProps,
    binderId: string,
    langCode: string,
    additionalChunks: ContentChunkKind[],
    options?: {
        rethrowError?: boolean;
    },
): Promise<Publication> {
    const publication = await findPublication(router, binderId, langCode, additionalChunks, options);
    if (publication) {
        activatePublication(publication);
    }
    return publication;
}

export function dispatchLoadingItem(itemId: string): void {
    getBinderStoreActions().setLoadingItemId(itemId);
}

async function findNewerPublications(binderId: string, currentPublication: Publication, languageCodes: string[]) {
    if (currentPublication.isActive) {
        return;
    }
    let publications: PublicationFindResult[];
    try {
        publications = await findPublications(binderId, languageCodes);
    } catch (err) {
        // eslint-disable-next-line
        console.error(i18next.t(TranslationKeys.General_CantLoadPublications), err);
    }
    const activePublication = publications.find(p => !!p.isActive);
    const hasNewerPublication = currentPublication.id !== activePublication.id;
    if (hasNewerPublication) {
        getBinderStoreActions().setNewerPublication(activePublication);
    }
}

export async function findPublication(
    router: RouteComponentProps,
    binderId: string,
    langCode: string,
    additionalChunks: ContentChunkKind[],
    options?: {
        rethrowError?: boolean;
    },
): Promise<Publication | undefined> {
    try {
        const accountId = AccountStoreGetters.getActiveAccountId();
        const publications = await findPublications(binderId) as Publication[];
        if (publications.length === 0) {
            navigateToContentNotFound(router.history);
            return undefined;
        }
        // if we do not have language code passed or language code is not among active publications
        if (!langCode || !publications.find(p => p.language.iso639_1 === langCode)) {
            const masterPublication = publications.find((p: Publication) => p.isMaster) || publications[0];
            langCode = masterPublication.language.iso639_1;
        }
        let pub = (publications
            .filter(publication => {
                return publication.language.iso639_1 === langCode;
            })
            .pop()) as Publication;
        pub = pub || publications[0];
        const translations = publications.map((pub) => ({
            languageCode: pub.language.iso639_1,
            publicationId: pub.id,
            priority: pub.language.priority
        }));
        pub.translations = translations.sort(({ priority: a }, { priority: b }) => a - b);
        const textModules = pub.modules.text.chunked;
        pub.modules.text.chunked = replaceTextModulesWithEmailPattern(textModules);
        await extendPublication(pub, { accountId, langCode, additionalChunks });
        return pub;
    }
    catch (error) {
        if (options?.rethrowError) throw error;
        handleContentLoadingError(error);
        throw error;
    }
}

export async function loadAndActivateBinder(binderId: string, langCode: string, additionalChunks: ContentChunkKind[]): Promise<void> {
    const binder = await loadBinder(binderId);
    if (binder) {
        const accountId = AccountStoreGetters.getActiveAccountId();
        const textModules = binder.modules.text.chunked;
        binder.modules.text.chunked = replaceTextModulesWithEmailPattern(textModules);
        await extendPublication(binder, { accountId, langCode, additionalChunks });
        activateDocument(binder, "binder", langCode);
    }
}

export async function loadAndActivateCollection(
    collectionId: string,
    preferredLanguages: string[],
): Promise<void> {
    try {
        const activeCollectionInfo = BinderStoreGetters.getActiveCollectionInfo();
        if (activeCollectionInfo && activeCollectionInfo.id !== collectionId) {
            getBinderStoreActions().unsetActiveCollection();

        }
        const activeCollection = await maybeFetchCollection(collectionId);
        const { items, languagesUsed } = await getCollectionElementsWithInfo(collectionId, preferredLanguages);

        getBinderStoreActions().setActiveCollection({
            id: collectionId,
            items,
            languagesUsed,
            preferredLanguages,
            activeCollection: activeCollection as DocumentCollection,
        });

        const ancestors = await loadAncestors(collectionId, (activeCollection as DocumentCollection).accountId);
        getBinderStoreActions().setCollectionAncestors(ancestors);
        return undefined;
    }
    catch (error) {
        handleContentLoadingError(error, collectionId);
        throw error;
    }
}

export async function loadAndActivateParentCollection(
    collectionId: string,
    preferredLanguages: string[],
): Promise<void> {
    const { items } = await getCollectionElementsWithInfo(collectionId, preferredLanguages);
    getBinderStoreActions().setParentCollection({
        id: collectionId,
        items,
        preferredLanguages,
    });
}

export async function loadAndActivatePublication(
    publicationId: string,
    languageCodes = undefined,
    additionalChunks: ContentChunkKind[],
): Promise<Publication> {
    resetNewerPublication();
    const accountId = AccountStoreGetters.getActiveAccountId();
    const publication = await loadPublication(publicationId);
    if (!publication) {
        return;
    }

    const activeViewable = BinderStoreGetters.getActiveViewable();
    if (activeViewable) {
        const translations = (activeViewable as Publication).translations ?? [];
        const activeTranslationsSorted = translations.map(({ languageCode }) => languageCode);
        // if there's an activeViewable in the store, apply its order of translations to the newly fetched publication
        publication.translations = publication.translations.sort(({ languageCode: a }, { languageCode: b }) =>
            activeTranslationsSorted.indexOf(a) - activeTranslationsSorted.indexOf(b));
    }

    findNewerPublications(publication.binderId, publication, languageCodes);
    const textModules = publication.modules.text.chunked;
    publication.modules.text.chunked = replaceTextModulesWithEmailPattern(textModules);
    const langCode = publication.language.iso639_1;

    await extendPublication(publication, { accountId, langCode, additionalChunks });

    if (activeViewable) {
        const viewableModules: BinderModules = (activeViewable as Binder).modules ?? {};
        publication.modules.images.chunked[0].chunks = copySameVisuals(publication.modules.images, viewableModules.images);
    }
    activateDocument(publication, "publication", undefined);
    if (!tokenStore.isPublic()) {
        loadChecklistsAsync(publication.binderId);
    }
    return publication;
}

export async function loadAndActivateSearchResults(query: string, preferredLanguages: string[], scopeCollectionId: string): Promise<void> {
    const searchResult = await searchPublicationsAndCollections(query, preferredLanguages, scopeCollectionId);
    const normalizedResult = normalizeSearchResult(searchResult, query);
    normalizedResult.query = query;
    getBinderStoreActions().setSearchResults(normalizedResult);
}

export async function loadAncestors(docId: string, accountId: string): Promise<Array<{ parentPaths: string[], item: Item }>> {
    const resourceDetails = await APILoadAncestors(docId);
    const ancestorDocs = resourceDetails.ancestorDocuments;
    const ancestorDocIds = Object.keys(ancestorDocs);
    const directParents = ancestorDocs[docId];
    const items = await APILoadItems(ancestorDocIds, accountId);
    const directParentItems = items.filter(item => directParents.indexOf(item.id) !== -1);
    return directParentItems.map(collection => {
        return {
            parentPaths: buildParentPath(collection.id, ancestorDocs, items, undefined),
            item: collection
        };
    });
}

export async function loadAvailableTranslations(): Promise<void> {
    const translations = await APIGetAvailableTranslations();
    getBinderStoreActions().setAvailableTranslations(translations);
}

export function loadChecklistsAsync(binderId: string): void {
    if (!AccountStoreGetters.getAccountFeatures().includes(FEATURE_CHECKLISTS)) {
        return;
    }
    APIGetChecklists(binderId).then((checklists) => {
        getChecklistStoreActions().loadChecklists(checklists);
    })
}

export async function loadChecklistsProgress(binderIds: string[]): Promise<void> {
    if (!AccountStoreGetters.getAccountFeatures().includes(FEATURE_CHECKLISTS) || binderIds.length === 0) {
        return;
    }
    const checklistsProgress = await APIGetChecklistsProgress(binderIds);
    getChecklistStoreActions().loadChecklistsProgress(checklistsProgress);
}

export async function loadDomainAccounts(): Promise<AccountSummary[]> {
    const domain = getReaderDomain();
    try {
        const accounts = await getAccountsForDomain(domain);
        getAccountStoreActions().loadAccessibleAccountIds(accounts.map(a => a.id));
        return accounts;
    } catch (ex) {
        return undefined;
    }
}

const extractParentPathFromUri = (): string[] | undefined => {
    const path = window.location.pathname;
    if (!isBrowseOrReadPath(path) && !isLaunchPath(path)) {
        return undefined;
    }
    const pathParts = path.split("/").filter(s => !!s);
    return pathParts.slice(1, pathParts.length - 1);
}

export async function loadParentPathContext(
    accountIds: string[],
    itemId: string,
    langCode?: string,
    options: {
        triggerParentCollectionActivate?: boolean,
        skipReaderFeedbackConfig?: boolean,
        rethrowError?: boolean,
    } = {},
): Promise<ParentPathContext | null> {
    try {
        const { triggerParentCollectionActivate = false, skipReaderFeedbackConfig = false } = options;
        const { ancestors, feedbackConfig } = await APIGetReaderItemContext(itemId, { skipReaderFeedbackConfig });
        let excludePublicNonAdvertized = false;
        if (tokenStore.isPublic()) {
            let entryPointItemId = BinderStoreGetters.getEntryPointItemId();
            if (!entryPointItemId) {
                getBinderStoreActions().setEntryPointItemId(itemId);
                entryPointItemId = itemId;
            }
            const onEntryPoint = entryPointItemId === itemId;
            const aboveEntryPoint = Object.keys(ancestors).indexOf(entryPointItemId) === -1;
            excludePublicNonAdvertized = onEntryPoint || aboveEntryPoint;
        }
        const readableItemsPermissions = await getAllReadableItemsPermissions(accountIds, excludePublicNonAdvertized);
        const readableItemsIds = extractItemsFromResourceGroups(readableItemsPermissions);
        const parentPathFromUri = extractParentPathFromUri();
        let parentTitle;
        let titleForLanguage;
        if (ancestors[itemId][0]) {
            [parentTitle] = await APIFindCollections([ancestors[itemId][0]]);
            titleForLanguage = parentTitle && parentTitle.titles.find(({ languageCode }) => languageCode === langCode);
        }
        const parentPathContext = {
            readableItems: readableItemsIds,
            readableItemsPermissions,
            parentPathFromUri,
            itemId,
            parentTitle: (titleForLanguage ? titleForLanguage.title : (parentTitle && parentTitle.titles[0].title) || ""),
            ancestors,
            triggerParentCollectionActivate, // true on reader type routes (for horizontal navigation), false on browse types routes
            ratingEnabled: feedbackConfig?.readerRatingEnabled,
            commentsEnabled: feedbackConfig?.readerCommentsEnabled,
            readConfirmationEnabled: feedbackConfig?.readConfirmationEnabled,
        };
        getBinderStoreActions().setParentPathContext(parentPathContext);
        return parentPathContext;
    } catch (err) {
        if (options?.rethrowError) throw err;
        handleContentLoadingError(err);
        return null;
    }
}

export function loadParentCollectionFromParentPath(parentPath: string[]): void {
    if (parentPath.length > 0) {
        const lastPart = parentPath[parentPath.length - 1];
        if (lastPart.length > 1) {
            const clientSelectedLanguage = BinderStoreGetters.getSelectedLanguage();
            const readerLanguages = UserStoreGetters.getPreferences().readerLanguages;
            const preferredLanguages = clientSelectedLanguage ?
                [clientSelectedLanguage, ...readerLanguages] :
                readerLanguages;
            setTimeout(() => loadAndActivateParentCollection(lastPart, preferredLanguages), 0); // setTimeout hack avoids "cannot dispatch in the middle of a dispatch"
        }
    }
}

export async function loadReaderItems(
    preferredLanguages: string[],
): Promise<void> {
    let pubInfo: IReaderItemsWithInfo;
    let ancestorObject: Record<string, string[]>;
    try {
        pubInfo = await getReaderItemsWithInfo(preferredLanguages);
        const itemIds = pubInfo.items.map(({ id }) => id);
        const ancestors = await APIGetItemsAncestors(itemIds);
        ancestorObject = buildAncestorsObject(itemIds, ancestors);
    }
    catch (err) {
        handleContentLoadingError(err);
        return;
    }
    const { items, languagesUsed } = pubInfo;
    const publications = (items.filter(i => !("isRootCollection" in i)) || []) as IBinderStory[];
    const collections = (items.filter(i => ("isRootCollection" in i)) || []) as ICollectionStory[];

    getBinderStoreActions().setReaderItems({
        publications,
        collections,
        preferredLanguages,
        languagesUsed,
        ancestorObject,
    });
}

function normalizeSearchResult(result: ReaderItemSearchResult, query: string): NormalizedReaderSearchResult {
    const normalizedResults = {
        ...result,
        hits: result.hits.reduce((hitsReduced, hit) => {
            if (!(hit.fieldHits.length)) {
                hitsReduced.push(hit as unknown as (PublicationSearchHitClient | CollectionSearchHitClient));
                return hitsReduced;
            }
            const fieldHits = hit.fieldHits.reduce((fieldHitsReduced, fieldHit) => {
                const clientContexts = fieldHit.contexts.reduce((contextsReduced, context) => {
                    let text: string;
                    try {
                        const contextDoc = new DOMParser().parseFromString(context, "text/html");
                        text = contextDoc.body.textContent;
                    } catch (err) {
                        // eslint-disable-next-line no-console
                        console.error("Error parsing html");
                        text = context;
                    }
                    if (containsSearchTerms(text, buildSearchTerms(query))) {
                        const clientContext = {
                            html: context,
                            text,
                        } as IClientContext;
                        contextsReduced.push(clientContext);
                    }
                    return contextsReduced;
                }, [] as IClientContext[]);
                if (clientContexts?.length > 0) {
                    fieldHitsReduced.push({
                        ...fieldHit,
                        contexts: clientContexts,
                    });
                }
                return fieldHitsReduced;
            }, [] as IFieldSearchHitsClient[]);
            if (fieldHits?.length > 0) {
                hitsReduced.push({
                    ...hit,
                    fieldHits,
                });
            }
            return hitsReduced;
        }, [] as (PublicationSearchHitClient | CollectionSearchHitClient)[])
    };

    normalizedResults.totalHitCount = normalizedResults.hits.length; // might have changed after eliminating false positives

    if ((window["bindersConfig"] as IBindersConfig).proxiedAPiPath) {
        return rewriteSearchResultsWithProxy(normalizedResults);
    }
    return normalizedResults;
}

export function pdfExport(
    publicationId: string,
    domain: string,
    exportOptions: IPDFExportOptions,
): Promise<Record<string, unknown>> {
    return APIPdfExport(publicationId, domain, exportOptions);
}

function replaceAllEmails(node: Node): Node {
    const outputNode = node.cloneNode();
    const formattedNodes = replaceEmails(node);
    for (const node of formattedNodes) {
        outputNode.appendChild(node);
    }
    return outputNode;
}

function replaceEmails(node: Node): Node[] {
    if (node.nodeType === Node.TEXT_NODE) {
        return replaceEmailsInTextNode(node);
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
        const outputNode = node.cloneNode();
        const formattedChildNodes = Array.from(node.childNodes).reduce((reduced, childNode) => {
            return [...reduced, ...replaceEmails(childNode)];
        }, [] as Node[]);
        for (const formattedChildNode of formattedChildNodes) {
            outputNode.appendChild(formattedChildNode);
        }
        return [outputNode];
    }
    return [node];
}

function replaceEmailsInTextNode(node: Node): Node[] {
    const text = node.textContent;
    const emailMatches = text.match(emailRegex());
    if ((emailMatches || []).length) {
        const nodes = [];
        const matchStart = text.indexOf(emailMatches[0]);
        const prefixLabel = document.createElement("label");
        prefixLabel.textContent = text.substring(0, matchStart);
        const suffixLabel = document.createElement("label");
        suffixLabel.textContent = text.substring(matchStart + emailMatches[0].length);
        const rest = suffixLabel.childNodes && suffixLabel.childNodes.length ?
            replaceEmailsInTextNode(suffixLabel.childNodes[0]) :
            [suffixLabel];
        const mailToLink = document.createElement("a");
        mailToLink.setAttribute("href", "mailto:" + emailMatches[0]);
        mailToLink.setAttribute("target", "_self");
        mailToLink.textContent = emailMatches[0];
        nodes.push(prefixLabel);
        nodes.push(mailToLink);
        nodes.push(...rest);
        return nodes;
    }
    return [node];
}

function replaceTextModulesWithEmailPattern(textModules: BindersChunkedTextModule[]) {
    return textModules.map(module => ({
        ...module,
        chunks: module.chunks.map(chunk => (
            chunk.map(p => {
                const doc = document.createElement("body");
                doc.innerHTML = p;
                const outputNode = replaceAllEmails(doc);
                return outputNode.firstChild.parentElement.innerHTML;
            })
        )),
    }));
}

function resetNewerPublication() {
    getBinderStoreActions().setNewerPublication(undefined)
}

function rewriteDocumentWithProxy(document: Binder | Publication) {
    const newDoc = { ...document };
    const images = newDoc.modules.images.chunked[0].chunks.map(chunk => chunk.map((el) => (rewriteUrlIfProxy(el, "url"))));
    newDoc.modules.images.chunked[0].chunks = images;
    return newDoc;
}

function rewriteSearchResultsWithProxy(result: NormalizedReaderSearchResult): NormalizedReaderSearchResult {
    return {
        ...result,
        hits: result.hits.map(hit => {
            const collection = (hit as CollectionSearchHitClient).collection;
            const publicationSummary = (hit as PublicationSearchHitClient).publicationSummary;
            if (!collection && publicationSummary) {
                return ({
                    ...hit,
                    publicationSummary: {
                        ...publicationSummary,
                        thumbnail: rewriteUrlIfProxy(publicationSummary.thumbnail)
                    }
                });
            } else {
                return ({
                    ...hit,
                    collection: {
                        ...collection,
                        thumbnail: rewriteUrlIfProxy(collection.thumbnail),
                    }
                });
            }
        }),
    };
}

export function selectLanguage(language: string): void {
    if (getAllLanguageCodes().indexOf(language) >= 0) {
        getBinderStoreActions().setSelectedLanguage(language);
    }
}

const translateAdditionalChunk = async (accountId: string, langCode: string) => {
    const template = (content: string) => `<p ${MANUALTO_CHUNK_DATAPROP}=\`true\`>${content}</a></p>`;
    if (i18nextResources[langCode]?.translation?.General_MadeWithManual != null) {
        return template(i18nextResources[langCode].translation.General_MadeWithManual)
    }
    const englishText = i18nextResources["en"].translation.General_MadeWithManual;
    if (langCode === "en" || langCode === "xx") {
        return template(englishText)
    }
    let translatedText: string
    try {
        translatedText = await APITranslateHTMLChunk(accountId, englishText, "en", langCode)
    } catch (error) {
        translatedText = englishText
    }
    return template(translatedText);
}

export function unloadPublication(): void {
    resetNewerPublication();
    resetIndicesToDefault();
    getBinderStoreActions().unsetActiveDocument();
}

export function updateClientLanguageSettings(colId: string, language: string, preferedLanguages: string[]): Promise<void> {
    getBinderStoreActions().setSelectedLanguage(language);
    return loadAndActivateCollection(colId, language ? [language, ...preferedLanguages] : preferedLanguages);
}

export async function updateClientLanguageSettingsNoCollection(language?: string, preferredLangs: string[] = []): Promise<void> {
    let pubInfo: Partial<IReaderItemsWithInfo> = {};
    let ancestorObject = {};
    const preferredLanguages = language ? [language, ...preferredLangs] : preferredLangs;
    try {
        pubInfo = await getReaderItemsWithInfo(preferredLanguages);
        const itemIds = pubInfo.items.map(({ id }) => id);
        const ancestors = await APIGetItemsAncestors(itemIds);
        ancestorObject = buildAncestorsObject(itemIds, ancestors);
    }
    catch (err) {
        handleContentLoadingError(err);
        return;
    }
    const { items, languagesUsed } = pubInfo;
    const publications = (items.filter(i => !("isRootCollection" in i)) || []) as IBinderStory[];
    const collections = (items.filter(i => ("isRootCollection" in i)) || []) as ICollectionStory[];

    getBinderStoreActions().setSelectedLanguage(language);
    getBinderStoreActions().setReaderItems({
        publications,
        collections,
        preferredLanguages,
        languagesUsed,
        ancestorObject,
    });
}
