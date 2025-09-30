import {
    ApprovedStatus,
    Binder,
    DocumentAncestors,
    DocumentCollection,
    IChunkApproval,
    Publication,
    PublicationSummary,
    ReaderFeedbackConfig
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    BackendAccountServiceClient,
    BackendCommentServiceClient,
    BackendRepoServiceClient,
    BackendRoutingServiceClient
} from "../../apiclient/backendclient";
import BinderClass, {
    create as createBinderObject,
    curriedMultiUpdate,
    update,
    update as updateBinder
} from "@binders/client/lib/binders/custom/class";
import { TestAuthorizationFactory, TestUserRole } from "./authorizationfactory";
import {
    mergePatches,
    patchAddTranslation,
    patchAllTextMetaTimestamps,
    patchChunkedRichTextModuleByIndex,
    patchMetaTimestamp,
    patchUpdateBinderLog,
    setThumbnailDetails
} from "@binders/client/lib/binders/patching";
import { Config } from "@binders/client/lib/config/config";
import { DEFAULT_COVER_IMAGE } from "@binders/client/lib/binders/defaults";
import { ExtendedCommentThread } from "@binders/client/lib/clients/commentservice/v1/contract";
import RTEState from "@binders/client/lib/draftjs/state";
import { TestUserFactory } from "./userfactory";
import Thumbnail from "@binders/client/lib/clients/repositoryservice/v3/Thumbnail";
import { UnCachedBackendAuthorizationServiceClient } from "../../authorization/backendclient";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import { Visual } from "@binders/client/lib/clients/imageservice/v1/contract";
import { log } from "../../util/process";
import { serializeEditorStates } from "@binders/client/lib/draftjs/helpers";
import sleep from "../../util/sleep";
import { visualToThumbnail } from "@binders/client/lib/clients/repositoryservice/v3/helpers";

const merge = <A, B>(
    itemsA: A,
    itemsB: B
): A & B => {
    const obj = { ...itemsA };
    for (const [key, value] of Object.entries(itemsB)) {
        if (value === undefined) continue;
        obj[key] = value;
    }
    return obj as A & B;
}

export interface BinderSaveOptions {
    id: string;
    // Expected chunk contents by language code
    // { "en": ["first chunk text", "second chunk text"] }
    chunkContents?: Record<string, string[]>;
    timeout?: number;
    visualProperties?: Record<number, Partial<Visual>>;
    visualCounts?: Record<number, number>;
}

export type ItemTree = TreeDocumentParams | TreeCollectionParams;

// Can be a User, user id, or user login
type RoleParams = { [key in TestUserRole]?: (User | string)[] };

type TreeDocumentParams = {
    title: string;
    type: "document";
    languageCode?: string | string[];
    published?: boolean;
    roles?: RoleParams;
    chunks?: string[];
    readerFeedbackConfig?: Partial<ReaderFeedbackConfig>;
}

type TreeCollectionParams = {
    title: string;
    type: "collection";
    children?: (TreeDocumentParams | TreeCollectionParams)[];
    roles?: RoleParams;
    readerFeedbackConfig?: ReaderFeedbackConfig;
}

export class TestItemFactory {

    constructor(
        private readonly config: Config,
        private readonly accountId: string
    ) { }

    /**
     * @param identifier Can be a User, user id, or user login
     */
    private async resolveUserId(identifier: User | string): Promise<string> {
        if (typeof identifier !== "string") return identifier.id;
        if (!identifier.includes("@")) return identifier;

        const userFactory = new TestUserFactory(this.config, this.accountId);
        try {
            const user = await userFactory.getUserByLogin(identifier);
            return user.id;
        } catch (e) {
            if (e.statusCode === 404) {
                throw new Error("Couldn't find user with login " + identifier);
            }
            throw e;
        }
    }

    async restoreElasticDocument (indexName: string, id: string, document: unknown) {
        const repoClient = await BackendRepoServiceClient.fromConfig(
            this.config,
            "testing"
        );
        await repoClient.restoreElasticDoc(indexName, id, document);
    }

    async assignRoles(
        itemId: string,
        roles: RoleParams
    ) {
        const authFactory = new TestAuthorizationFactory(this.config, this.accountId);
        for (const key of Object.keys(roles)) {
            const role = key as TestUserRole;
            const users = roles[role];
            for (const user of users) {
                await authFactory.assignItemRole(
                    itemId,
                    await this.resolveUserId(user),
                    role
                );
            }
        }
    }

    async createItemTree(
        tree: ItemTree,
        rootCollectionId?: string // defaults to the account root
    ): Promise<{
        root: DocumentCollection,
        items: (DocumentCollection | Binder)[]
    }> {
        let rootCollection: DocumentCollection;
        if (rootCollectionId) {
            rootCollection = await this.getCollectionById(rootCollectionId);
        } else {
            rootCollection = await this.getOrCreateRootCollection();
        }

        if (tree.type === "document") {
            const doc = await this.createDocument(
                { title: tree.title, languageCode: tree.languageCode, chunkTexts: tree.chunks ?? [] },
                { addToCollId: rootCollection.id, publish: !!tree.published, fetchFullDoc: true }
            );
            if (tree.roles) {
                await this.assignRoles(doc.id, tree.roles);
            }
            if (tree.readerFeedbackConfig) {
                await this.updateItemFeedbackConfig(doc, tree.readerFeedbackConfig);
            }
            return {
                root: rootCollection,
                items: [doc]
            }
        }

        const collection = await this.createCollection(
            { title: tree.title },
            { addToCollId: rootCollection.id }
        );
        if (tree.readerFeedbackConfig) {
            await this.updateItemFeedbackConfig(collection, tree.readerFeedbackConfig);
        }
        if (tree.roles) {
            await this.assignRoles(collection.id, tree.roles);
        }
        if (!tree.children) {
            return {
                root: rootCollection,
                items: [collection]
            };
        }
        const childTreeResults = [];
        for (const child of tree.children) {
            childTreeResults.push(
                await this.createItemTree(child, collection.id)
            );
        }

        let allItems: (DocumentCollection | Binder)[] = [collection];

        for (const childTreeResult of childTreeResults) {
            allItems = [
                ...allItems,
                ...childTreeResult.items
            ]
        }
        return {
            root: rootCollection,
            items: allItems
        };
    }

    async getBinderObj(
        binderId: string
    ): Promise<BinderClass> {
        const repoClient = await BackendRepoServiceClient.fromConfig(
            this.config,
            "testing"
        );
        return new BinderClass(await repoClient.getBinder(binderId));
    }

    private async getCollectionById(collectionId: string): Promise<DocumentCollection> {
        const repoClient = await BackendRepoServiceClient.fromConfig(
            this.config,
            "testing"
        );
        return await repoClient.getCollection(collectionId);
    }

    async getOrCreateRootCollection(): Promise<DocumentCollection> {
        const repoClient = await BackendRepoServiceClient.fromConfig(
            this.config,
            "testing"
        );
        const rootCollections = await repoClient.getRootCollections([this.accountId]);
        if (rootCollections.length > 0) {
            return rootCollections[0];
        }
        const accountClient = await BackendAccountServiceClient.fromConfig(
            this.config,
            "testing"
        );
        const account = await accountClient.getAccount(this.accountId);
        return await repoClient.createRootCollection(account.id, account.name);
    }

    async getBinderAncestorIds(
        binderId: string
    ): Promise<DocumentAncestors> {
        const repoClient = await BackendRepoServiceClient.fromConfig(
            this.config,
            "testing"
        );
        return repoClient.getAncestors(binderId)
    }

    async addCollToRootCollection(
        collId: string
    ): Promise<void> {
        const rootCollection = await this.getOrCreateRootCollection();
        await this.addCollToCollection(
            rootCollection.id,
            collId
        );
    }

    async addDocToRootCollection(
        docId: string
    ): Promise<void> {
        const rootCollection = await this.getOrCreateRootCollection();
        await this.addDocToCollection(
            rootCollection.id,
            docId
        );
    }

    async publishDoc(
        docId: string,
        languageCodes: string[]
    ): Promise<PublicationSummary[]> {
        const repoClient = await BackendRepoServiceClient.fromConfig(
            this.config,
            "testing"
        );

        return await repoClient.publish(
            docId,
            languageCodes,
        );
    }

    async unublishDoc(
        docId: string,
        languageCodes: string[]
    ): Promise<PublicationSummary[]> {
        const repoClient = await BackendRepoServiceClient.fromConfig(
            this.config,
            "testing"
        );
        return await repoClient.unpublish(
            docId,
            languageCodes,
        );
    }

    async updateDoc(
        doc: Binder
    ): Promise<Binder> {
        const repoClient = await BackendRepoServiceClient.fromConfig(
            this.config,
            "testing"
        );
        return await repoClient.updateBinder(doc);
    }

    async deleteDoc(
        docId: string
    ): Promise<void> {
        const repoClient = await BackendRepoServiceClient.fromConfig(
            this.config,
            "testing"
        );
        await repoClient.deleteBinder(docId, this.accountId);
    }

    async addCollToCollection(
        parentCollectionId: string,
        childCollectionId: string
    ): Promise<DocumentCollection> {
        const repoClient = await BackendRepoServiceClient.fromConfig(
            this.config,
            "testing"
        );
        return await repoClient.addElementToCollection(
            parentCollectionId,
            "collection",
            childCollectionId,
            this.accountId
        );
    }

    async addDocToCollection(
        collectionId: string,
        documentId: string
    ): Promise<DocumentCollection> {
        const repoClient = await BackendRepoServiceClient.fromConfig(
            this.config,
            "testing"
        );
        return await repoClient.addElementToCollection(
            collectionId,
            "document",
            documentId,
            this.accountId
        );
    }

    async removeCollFromCollection(
        parentCollectionId: string,
        childCollectionId: string
    ): Promise<void> {
        const repoClient = await BackendRepoServiceClient.fromConfig(
            this.config,
            "testing"
        );
        await repoClient.removeElementFromCollection(
            parentCollectionId,
            "collection",
            childCollectionId,
            this.accountId,
            true
        );
    }

    async removeDocFromCollection(
        collectionId: string,
        documentId: string
    ): Promise<void> {
        const repoClient = await BackendRepoServiceClient.fromConfig(
            this.config,
            "testing"
        );
        await repoClient.removeElementFromCollection(
            collectionId,
            "document",
            documentId,
            this.accountId,
            true
        );
    }

    async updateCollectionIsHidden(collectionId: string, isHidden: boolean): Promise<void> {
        const repoClient = await BackendRepoServiceClient.fromConfig(
            this.config,
            "testing"
        );
        await repoClient.updateCollectionIsHidden(
            collectionId,
            isHidden,
        );
    }

    async createCollection(
        values?: {
            title?: string;
            languageCode?: string;
            thumbnail?: Thumbnail;
            domainFilterId?: string
        },
        options: {
            addToRoot?: boolean,
            addToCollId?: string, // Incompatible with addToRoot
            public?: boolean
        } = {}
    ): Promise<DocumentCollection> {
        if (options.addToRoot && options.addToCollId) {
            throw new Error("The options addToRoot and addToCollId are incompatible, please choose one.");
        }

        const { title, languageCode, thumbnail } = merge(
            {
                title: "Some-test-collection",
                languageCode: "xx",
                thumbnail: {
                    medium: DEFAULT_COVER_IMAGE,
                    fitBehaviour: "fit",
                    bgColor: "transparent",
                },
                domainFilterId: undefined
            },
            values ?? {}
        );

        const repoClient = await BackendRepoServiceClient.fromConfig(
            this.config,
            "testing"
        );
        const routingClient = await BackendRoutingServiceClient.fromConfig(
            this.config,
            "testing"
        );

        const domainFilters = await routingClient.getDomainFiltersForAccounts([this.accountId]);
        const domainCollectionId = domainFilters.length > 0 ? domainFilters.pop().domainCollectionId : undefined;
        const collection = await repoClient.createCollectionBackend(
            this.accountId,
            title,
            languageCode,
            thumbnail,
            domainCollectionId
        );

        if (options?.addToRoot) {
            await this.addCollToRootCollection(collection.id);
        } else if (options?.addToCollId) {
            await this.addCollToCollection(options.addToCollId, collection.id);
        }

        if (options?.public) {
            const authClient = await UnCachedBackendAuthorizationServiceClient.fromConfig(
                this.config,
                "testing",
            );
            await authClient.grantPublicReadAccess(this.accountId, collection.id);
        }

        return collection;
    }

    async updateCollectionShowInOverview(collectionId: string, showInOverview: boolean): Promise<DocumentCollection> {
        const repoClient = await BackendRepoServiceClient.fromConfig(
            this.config,
            "testing"
        );
        return await repoClient.updateCollectionShowInOverview(collectionId, showInOverview);
    }

    async updateBinderShowInOverview(binderId: string, showInOverview: boolean): Promise<void> {
        const repoClient = await BackendRepoServiceClient.fromConfig(
            this.config,
            "testing"
        );
        await repoClient.setPublicationsShowInOverview(binderId, showInOverview);
    }

    async setChunkApprovalStatus(
        binder: Binder,
        chunkId: string,
        languageCode: string,
        status: ApprovedStatus
    ): Promise<IChunkApproval[]> {
        const repoClient = await BackendRepoServiceClient.fromConfig(
            this.config,
            "testing"
        );
        const binderLog = binder.binderLog.current.find(c => c.uuid === chunkId);
        if (binderLog == null) {
            throw new Error(`Chunk ${chunkId} not found in binder ${binder.id}!`);
        }
        return await repoClient.approveChunk(
            binder.id,
            chunkId,
            binderLog.updatedAt,
            languageCode,
            status
        );
    }

    async waitForBinderToBeSaved(options: BinderSaveOptions): Promise<void> {
        let savedCorrectly = false;
        const timeout = options.timeout || 10_000;
        const end = Date.now() + timeout;
        do {
            if (Date.now() > end) {
                throw new Error("Timeout while waiting for item to be saved");
            }
            savedCorrectly = true;
            try {
                const binder = await this.getBinderObj(options.id);
                if (options.chunkContents) {
                    for (const languageCode in options.chunkContents) {
                        for (const chunkIdx in options.chunkContents[languageCode]) {
                            const chunkContent = binder.getTextModuleChunksByLanguageAndChunkIndex(binder.getLanguageIndex(languageCode), +chunkIdx);
                            const expectedChunkContent = options.chunkContents[languageCode][chunkIdx];
                            savedCorrectly &&= chunkContent.includes(expectedChunkContent);
                        }
                    }
                }
                if (options.visualProperties) {
                    const module = this.getVisualsModule(binder);
                    let visualsOk = 0;
                    const chunks = Object.keys(options.visualProperties);
                    for (const chunk of chunks) {
                        const visuals = module.chunks[chunk];
                        const expectedProps = Object.keys(options.visualProperties[chunk]);
                        for (const visual of visuals) {
                            let visualCorrect = true;
                            for (const prop of expectedProps) {
                                const propCorrect = visual[prop] === options.visualProperties[chunk][prop];
                                if (!propCorrect) {
                                    log(`${prop} expected to be: ${options.visualProperties[chunk][prop]}, actual value: ${visual[prop]}`);
                                }
                                visualCorrect = visualCorrect && propCorrect;
                            }
                            if (!visualCorrect) {
                                log(`Some visual on chunk ${chunk} did not have the expected properties`);
                            } else {
                                visualsOk++;
                            }

                        }
                    }
                    savedCorrectly &&= (visualsOk === chunks.length);
                }
                if (options.visualCounts) {
                    const module = this.getVisualsModule(binder);
                    const chunks = Object.keys(options.visualCounts);
                    const chunksToCheck = chunks.length;
                    let chunksOk = 0;
                    for (const chunk of chunks) {
                        const visualsInChunk = module.chunks[chunk].length;
                        if (visualsInChunk === options.visualCounts[chunk]) {
                            chunksOk++;
                        } else {
                            log(`Chunk ${chunk} has ${visualsInChunk} visuals, expected ${options.visualCounts[chunk]}`);
                        }
                    }
                    savedCorrectly &&= (chunksOk === chunksToCheck);
                }

            } catch (exception) {
                log("Error while waiting for item to be saved", exception);
                savedCorrectly = false
            }
            if (!savedCorrectly) {
                await sleep(500);
            }
        } while (!savedCorrectly);
    }

    private getVisualsModule(binder: BinderClass) {
        const moduleKey = binder.getImagesModuleKey();
        return binder.getImagesModule(moduleKey);
    }

    async updateBinderText(
        binder: Binder,
        languageCode: string,
        text: string
    ): Promise<Binder> {
        const module = binder.modules.meta.find(m => m.iso639_1 === languageCode);
        if (module == null) {
            throw new Error(`No module found for language ${languageCode}!`);
        }
        const binderObj = createBinderObject(binder);
        const moduleIndex = binderObj.getTextModuleIndex(module.key);
        const textModule = binderObj.getModuleByKey(module.key);
        if (textModule.data.length === 0) {
            // There are not text chunks, patching in the new text would corrupt the binder
            // as there would be a difference in the number of image and text chunks
            throw new Error("No text chunks found in module!");
        }
        const patch = patchChunkedRichTextModuleByIndex(moduleIndex, 0, [text], [""]);
        const metaPatch = patchMetaTimestamp(binderObj, module.key);
        const logPatch = patchUpdateBinderLog(binderObj, 0);
        const updateLogPatch = mergePatches([patch, logPatch, metaPatch]);
        const updatedBinderObj = update(binderObj, () => [updateLogPatch], true);
        const updatedBinder = updatedBinderObj.toJSON();

        const repoClient = await BackendRepoServiceClient.fromConfig(this.config, "testing");
        return await repoClient.updateBinder(updatedBinder);
    }

    async updateBinderThumbnail(binder: Binder, visual: Visual): Promise<Binder> {
        const binderObj = createBinderObject(binder);
        const patch = setThumbnailDetails(binderObj, visualToThumbnail(visual));
        const updatedBinderObj = update(binderObj, () => [patch], true);
        const updatedBinder = updatedBinderObj.toJSON();
        const repoClient = await BackendRepoServiceClient.fromConfig(this.config, "testing");
        return await repoClient.updateBinder(updatedBinder);
    }

    async updateItemFeedbackConfig(item: Binder | DocumentCollection, config: Partial<ReaderFeedbackConfig>): Promise<void> {
        const repoClient = await BackendRepoServiceClient.fromConfig(this.config, "testing");
        if (config.readerCommentsEnabled) {
            await repoClient.updateReaderFeedbackConfig(item.id, { readerCommentsEnabled: true });
        }
        if (config.readerRatingEnabled) {
            await repoClient.updateReaderFeedbackConfig(item.id, { readerRatingEnabled: true });
        }
        if (config.readConfirmationEnabled) {
            await repoClient.updateReaderFeedbackConfig(item.id, { readConfirmationEnabled: true });
        }
    }

    async insertComment(
        binderId: string,
        chunkId: string,
        languageCode: string,
        text: string,
        userId: string
    ): Promise<ExtendedCommentThread[]> {
        const repoClient = await BackendCommentServiceClient.fromConfig(this.config, "testing");
        return await repoClient.insertBinderComment(
            binderId,
            chunkId,
            languageCode,
            {
                body: text,
                userId,
            },
            this.accountId
        );
    }

    async resolveComment(
        binderId: string,
        threadId: string,
        userId: string
    ): Promise<void> {
        const repoClient = await BackendCommentServiceClient.fromConfig(this.config, "testing");
        await repoClient.resolveCommentThread(binderId, threadId, userId, this.accountId);
    }

    async addTitleToCollection(
        collection: DocumentCollection,
        title: string,
        languageCode: string
    ): Promise<DocumentCollection> {
        const repoClient = await BackendRepoServiceClient.fromConfig(this.config, "testing");
        return await repoClient.saveCollectionTitle(collection.id, title, languageCode);
    }

    async addLanguageToDocument(
        binder: Binder,
        title: string,
        languageCode: string
    ): Promise<Binder> {
        const repoClient = await BackendRepoServiceClient.fromConfig(this.config, "testing");

        const binderObj = createBinderObject(binder);
        const primaryLanguageCode = binderObj.getFirstLanguage().iso639_1
        const [, imageModuleKey] = binderObj.getModulePairByLanguage(primaryLanguageCode)
        const addLanguagePatch = (binder: BinderClass) => patchAddTranslation(binder, binderObj.getNextTextModuleKey(), languageCode, "", imageModuleKey, title);
        const toBinderUpdate = curriedMultiUpdate([addLanguagePatch], true, binderObj);
        const serializedBinder = serializeEditorStates(toBinderUpdate, true);
        return await repoClient.updateBinder(serializedBinder);
    }

    async getPublicationForBinder(
        binderId: string,
        languageCode: string
    ): Promise<Publication> {
        const repoClient = await BackendRepoServiceClient.fromConfig(this.config, "testing");
        const [publication] = await repoClient.findPublications(
            binderId,
            { languageCodes: [languageCode] },
            { binderSearchResultOptions: { maxResults: 1 } }
        );
        return publication as Publication;
    }

    private setChunkValue(
        binderObj: BinderClass,
        languageCode: string,
        chunkPosition: number,
        text: string
    ) {
        if (text == null || text.length === 0) return binderObj;
        const metaModuleIndex = binderObj.getMetaModuleIndexByLanguageCode(languageCode);
        const metaModuleKey = binderObj.getModules().meta[metaModuleIndex].key;
        const textModuleIndex = binderObj.getTextModuleIndex(metaModuleKey);
        const html = `<p>${text}</p>`;
        const updateChunkPatch = patchChunkedRichTextModuleByIndex(
            textModuleIndex,
            chunkPosition,
            [html],
            RTEState.createFromText(text),
        );
        return updateBinder(
            binderObj,
            () => [
                updateChunkPatch,
                patchAllTextMetaTimestamps(binderObj),
            ],
            true
        );
    }

    // Info: if you plan to publish this document, also add it to the root collection to avoid an error in markAncestorsHavePublications(uniqueAncestors) in the repo service
    async createDocument(
        customValues?: {
            title?: string;
            languageCode?: string | string[];
            languageChunks?: { [languageCode: string]: string[] }
            /**
             * ["chunk one", "chunk two"] will create two chunks with the given text.
             * Warning: Editorstate is not provided
             */
            chunkTexts?: string[];
        },
        options: {
            addToRoot?: boolean,
            addToCollId?: string, // Incompatible with addToRoot
            public?: boolean,
            fetchFullDoc?: boolean,
            publish?: boolean,
        } = {}
    ): Promise<Binder> {
        const values = merge(
            {
                title: "Some-test-document",
                languageCode: "xx",
                chunkTexts: [],
                languageChunks: {}
            },
            customValues ?? {}
        );

        const masterLanguage = Array.isArray(values.languageCode) ? values.languageCode[0] : values.languageCode;
        const otherLanguages = Array.isArray(values.languageCode) ? values.languageCode.slice(1) : [];

        const repoClient = await BackendRepoServiceClient.fromConfig(
            this.config,
            "testing"
        );

        let chunkCount = 1;
        if (values.chunkTexts && values.chunkTexts.length > chunkCount) {
            chunkCount = values.chunkTexts.length;
        }
        for (const chunks of Object.values(values.languageChunks)) {
            if (chunks.length > chunkCount) {
                chunkCount = chunks.length;
            }
        }

        let binderObj = createNewBinder(values.title, masterLanguage, this.accountId, chunkCount);

        if (values.chunkTexts && values.chunkTexts.length > 0) {
            for (const [index, chunk] of values.chunkTexts.entries()) {
                binderObj = this.setChunkValue(binderObj, masterLanguage, index, chunk);
            }
        }

        if (otherLanguages.length > 0) {
            const primaryLanguageCode = binderObj.getFirstLanguage().iso639_1;
            const primaryModuleKeyPair = binderObj.getModulePairByLanguage(primaryLanguageCode);
            const [, primaryImageModuleKey] = primaryModuleKeyPair;
            for (const language of otherLanguages) {
                const textModuleKey = binderObj.getNextTextModuleKey();
                binderObj = updateBinder(
                    binderObj,
                    () => [
                        patchAddTranslation(binderObj, textModuleKey, language, "", primaryImageModuleKey, values.title),
                        patchAllTextMetaTimestamps(binderObj, new Date()),
                    ],
                    true
                );
            }
        }
        if (values.languageChunks && Object.keys(values.languageChunks).length > 0) {
            for (const [languageCode, chunks] of Object.entries(values.languageChunks)) {
                for (const [index, chunk] of chunks.entries()) {
                    binderObj = this.setChunkValue(binderObj, languageCode, index, chunk);
                }
            }
        }

        const binderSer = serializeEditorStates(binderObj.toJSON());
        const binder = await repoClient.createBinderBackend(binderSer);

        if (options?.addToRoot) {
            await this.addDocToRootCollection(binder.id);
        } else if (options?.addToCollId) {
            await this.addDocToCollection(options.addToCollId, binder.id);
        }

        if (options?.public) {
            const authClient = await UnCachedBackendAuthorizationServiceClient.fromConfig(
                this.config,
                "testing",
            );
            await authClient.grantPublicReadAccess(this.accountId, binder.id);
        }
        if (options?.publish) {
            const languageCodes = Array.isArray(values.languageCode) ? values.languageCode : [values.languageCode];
            await repoClient.publish(binder.id, languageCodes, false);
        }
        if (options?.fetchFullDoc) {
            return await repoClient.getBinder(binder.id);
        }
        return binder;
    }

    async duplicateCollection(
        collectionId: string,
        targetCollectionId: string,
        targetDomainCollectionId: string,
        fromAccountId: string,
        toAccountId: string
    ): Promise<DocumentCollection> {
        const repoClient = await BackendRepoServiceClient.fromConfig(
            this.config,
            "testing"
        );
        return repoClient.duplicateCollection(collectionId, targetCollectionId, targetDomainCollectionId, fromAccountId, toAccountId);
    }
}

const createNewBinder = (
    title: string,
    languageCode: string,
    accountId: string,
    chunkCount: number
) => {
    const baseBinder = {
        bindersVersion: "0.3.0",
        authors: [],
        authorIds: [],
        accountId,
        languages: [
            {
                iso639_1: languageCode,
                modules: ["t1"],
                storyTitle: title,
                storyTitleRaw: title,
                priority: 0
            }
        ],
        links: { "index-pairs": [["t1", "i1"]] },
        modules: {
            meta: [
                {
                    key: "t1",
                    type: "text",
                    format: "chunked",
                    markup: "richtext",
                    caption: "Original text",
                    iso639_1: languageCode
                },
                {
                    key: "i1",
                    type: "images",
                    format: "chunked",
                    markup: "url",
                    caption: "Original illustrations"
                }
            ],
            text: {
                chunked: [
                    {
                        key: "t1",
                        chunks: [
                            ...Array.from({ length: chunkCount }).map(() => [])
                        ],
                        editorStates: [
                            ...Array.from({ length: chunkCount }).map(() => RTEState.createEmpty())
                        ]
                    }
                ]
            },
            images: {
                chunked: [
                    {
                        key: "i1",
                        chunks: [
                            ...Array.from({ length: chunkCount }).map(() => [])
                        ]
                    }
                ]
            }
        },
        thumbnail: {
            medium: DEFAULT_COVER_IMAGE,
            fitBehaviour: "fit",
            bgColor: "#000000"
        },
        created: new Date().toISOString()
    };
    return createBinderObject(baseBinder);
};
