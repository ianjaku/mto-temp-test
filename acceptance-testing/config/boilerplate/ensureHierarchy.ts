import {
    BackendRepoServiceClient,
    BackendRoutingServiceClient,
    BackendUserServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import {
    Binder,
    CollectionElement
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { ItemHierarchy, LanguageSpec } from "./contract";
import {
    create as createBinderObject,
    update as updateBinder
} from "@binders/client/lib/binders/custom/class";
import {
    deserializeEditorStates,
    serializeEditorStates
} from "@binders/client/lib/draftjs/helpers";
import {
    patchAddTranslation,
    patchAllTextMetaTimestamps,
    patchChunkedRichTextModuleByIndex,
    patchInjectChunk
} from "@binders/client/lib/binders/patching";
import { AssigneeType } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { DEFAULT_COVER_IMAGE } from "@binders/client/lib/binders/defaults";
import { DocumentType } from "@binders/client/lib/clients/model";
import { ISemanticLink } from "@binders/client/lib/clients/routingservice/v1/contract";
import RTEState from "@binders/client/lib/draftjs/state";
import Thumbnail from "@binders/client/lib/clients/repositoryservice/v3/Thumbnail";
import { UNDEFINED_LANG } from "@binders/client/lib/util/languages";
import {
    UnCachedBackendAuthorizationServiceClient
} from "@binders/binders-service-common/lib/authorization/backendclient";
import { log } from "../../shared/logging";

const config = BindersConfig.get();

interface ISeedChunkSpecs {
    text: string,
}

interface AclToAssign {
    login: string;
}
interface ISeedLanguageSpecs {
    languageCode: string,
    isPublished: boolean,
    isPrimary?: boolean,
    chunks?: ISeedChunkSpecs[];
    title: string;
    isPublic?: boolean;
    isAdvertised?: boolean;
    aclsToAssign?: AclToAssign[];
}

export default async function ensureHierarchy(accountId: string, domain: string, itemHierarchy: ItemHierarchy): Promise<void> {
    const { children } = itemHierarchy;
    const repoServiceClient = await BackendRepoServiceClient.fromConfig(config, "acceptance-testing-setup");
    const routingServiceClient = await BackendRoutingServiceClient.fromConfig(config, "acceptance-testing-setup");
    const authorizationServiceClient = await UnCachedBackendAuthorizationServiceClient.fromConfig(config, "acceptance-testing-setup");
    const userServiceClient = await BackendUserServiceClient.fromConfig(config, "acceptance-testing-setup");
    const [{ id: rootCollectionId }] = await repoServiceClient.getRootCollections([accountId]);

    const createHierarchy = async (itemHierarchy: ItemHierarchy, parentCollectionId: string) => {
        const { type, children } = itemHierarchy;
        switch (type) {
            case "collection": {
                const collectionId = await createCollection(parentCollectionId, itemHierarchy);
                for (const child of (children || [])) {
                    await createHierarchy(child, collectionId);
                }
                break;
            }
            case "document": {
                await createDocument(parentCollectionId, itemHierarchy);
                break;
            }
        }
    }

    const sortOutElements = (elements: CollectionElement[]) => {
        return elements.reduce((reduced, elem) => {
            if (elem.kind === "collection") {
                reduced.colElements.push(elem);
            } else {
                reduced.docElements.push(elem);
            }
            return reduced;
        }, { colElements: [], docElements: [] });
    }

    const createCollection = async (parentCollectionId, item) => {
        const { name: title, aclsToAssign, languages } = item;
        const thumbnail = { medium: DEFAULT_COVER_IMAGE, fitBehaviour: "fit", bgColor: "transparent" } as Thumbnail;
        const languagesSource = languages || [{ languageCode: UNDEFINED_LANG, isPrimary: true, title }];
        const languagesToUse = [...languagesSource];
        const primaryLanguage = languagesToUse.pop();
        log(`creating collection ${primaryLanguage.title}`);
        const collection = await repoServiceClient.createCollectionBackend(
            accountId,
            primaryLanguage.title,
            primaryLanguage.languageCode,
            thumbnail,
            rootCollectionId
        );
        const addSemanticLinkRequest = async (language: LanguageSpec) => {
            if (language.semanticLinks) {
                for (const semanticLink of language.semanticLinks) {
                    const link: ISemanticLink = {
                        binderId: collection.id,
                        domain,
                        languageCode: language.languageCode,
                        documentType: DocumentType.COLLECTION,
                        semanticId: semanticLink
                    }
                    log(`adding semantic link ${language.languageCode} - ${semanticLink}`)
                    await routingServiceClient.setSemanticLink(link, collection.id);
                }
            }
        }
        await addSemanticLinkRequest(primaryLanguage);
        for (const language of languagesToUse) {
            await repoServiceClient.saveCollectionTitle(collection.id, language.title, language.languageCode);
            await addSemanticLinkRequest(language);
        }
        await repoServiceClient.addElementToCollection(parentCollectionId, "collection", collection.id, accountId);
        if (aclsToAssign) {
            for (const { login, roleId } of aclsToAssign) {
                const user = await userServiceClient.getUserByLogin(login);
                log(`adding acl for user ${user.id} to collection "${primaryLanguage.title}" - ${collection.id} `);
                const newAcl = await authorizationServiceClient.addDocumentAcl(accountId, collection.id, roleId);
                await authorizationServiceClient.addAclAssignee(newAcl.id, accountId, AssigneeType.USER, user.id);
            }
        }
        return collection.id;
    }

    const deleteExistingItems = async (colElements, docElements) => {
        const colElementIds = colElements.map(({ key }) => key);
        const docElementIds = docElements.map(({ key }) => key);
        for (const docElementId of docElementIds) {
            try {
                await repoServiceClient.unpublish(docElementId, []);
            } catch (err) {
                if (err?.errorDetails?.name !== "NothingToUnpublish") {
                    throw err;
                }
            }
            await repoServiceClient.deleteBinder(docElementId, accountId);
        }
        for (const colElementId of colElementIds) {
            await deleteExistingCollection(colElementId);
        }
    }

    const deleteExistingCollection = async (collectionId: string) => {
        const { elements } = await repoServiceClient.getCollection(collectionId);
        const { colElements, docElements } = sortOutElements(elements);
        await deleteExistingItems(colElements, docElements);
        await new Promise((resolve) => setTimeout(resolve, 200));
        await repoServiceClient.deleteCollection(collectionId, accountId);
    }

    const deleteExistingHierarchy = async () => {
        log("Deleting existing hierarchy");
        const { elements } = await repoServiceClient.getCollection(rootCollectionId);
        const { colElements, docElements } = sortOutElements(elements);
        await deleteExistingItems(colElements, docElements);
    }

    const createDocument = async (parentCollectionId, props) => {
        const { name: title, languages, isPublic, isAdvertised, aclsToAssign } = props;
        log(`creating document ${title} `);

        const { languageCode: primaryLanguageCode } = languages ?
            languages.find(l => l.isPrimary === true) || languages[0] :
            { languageCode: UNDEFINED_LANG };
        const binderObject = createNewBinder(title, primaryLanguageCode, accountId);
        const binderWithSerializedES = serializeEditorStates(binderObject);
        const responseBinder = await repoServiceClient.createBinderBackend(binderWithSerializedES as Binder);
        await repoServiceClient.addElementToCollection(parentCollectionId, "document", responseBinder.id, accountId);
        const serviceBinder = await repoServiceClient.getBinder(responseBinder.id);
        const responseBinderDes = deserializeEditorStates(serviceBinder);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const binder = createBinderObject(responseBinderDes) as any;


        if (languages) {
            await addLanguages(binder, languages, primaryLanguageCode);
        }
        if (isPublic) {
            await authorizationServiceClient.grantPublicReadAccess(accountId, binder.id);
            if (isAdvertised) {
                await repoServiceClient.setPublicationsShowInOverview(binder.id, true);
            }
        }
        if (aclsToAssign) {
            for (const { login, roleId } of aclsToAssign) {
                const user = await userServiceClient.getUserByLogin(login);
                log(`adding acl for user ${user.id} to binder "${title}" - ${binder.id} `);
                const newAcl = await authorizationServiceClient.addDocumentAcl(accountId, binder.id, roleId);
                await authorizationServiceClient.addAclAssignee(newAcl.id, accountId, AssigneeType.USER, user.id);
            }
        }

        for (const language of languages || []) {
            for (const semanticLink of (language.semanticLinks || [])) {
                const link: ISemanticLink = {
                    binderId: binder.id,
                    domain,
                    languageCode: language.languageCode,
                    documentType: DocumentType.DOCUMENT,
                    semanticId: semanticLink
                }
                log(`adding semantic link ${language.languageCode} - ${semanticLink} `)
                await routingServiceClient.setSemanticLink(link, binder.id);
            }
        }

        return binder.id;
    }

    const addLanguages = async (binder: Binder, languageSpecsArr: ISeedLanguageSpecs[], primaryLanguageCode: string) => {
        const secondaryLanguages = languageSpecsArr.filter(({ languageCode }) => languageCode !== primaryLanguageCode);
        if (secondaryLanguages.length) {
            binder = await addBinderLanguages(binder, secondaryLanguages);
        }
        binder = await addChunks(binder, languageSpecsArr);
        const publishedLanguageCodes = languageSpecsArr
            .filter(({ isPublished }) => isPublished)
            .map(s => s.languageCode);
        if (publishedLanguageCodes && publishedLanguageCodes.length) {
            await repoServiceClient.publish(binder.id, publishedLanguageCodes);
        }
    }

    function getEditorStateFromHtml(html: string) {
        try {
            return RTEState.createFromHtml(html);
        } catch (err) {
            return null;
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const addChunks = async (binder: any, languageSpecsArr: ISeedLanguageSpecs[]) => {
        const hasLanguagesWithChunks = languageSpecsArr.findIndex(l => l.chunks && !!l.chunks.length) >= 0;
        if (!hasLanguagesWithChunks) {
            return binder;
        }
        let languageIndex = 0;
        for (const { languageCode, chunks } of languageSpecsArr) {
            if (chunks && chunks.length) {
                let chunkIndex = 0;
                for (const { text } of chunks) {
                    if (languageIndex === 0) {
                        binder = updateBinder(
                            binder,
                            () => [
                                patchInjectChunk(binder, chunkIndex, undefined),
                                patchAllTextMetaTimestamps(binder),
                            ],
                            true
                        );
                    }
                    const metaModuleIndex = binder.getMetaModuleIndexByLanguageCode(languageCode);
                    const metaModuleKey = binder.modules.meta[metaModuleIndex].key;
                    const textModuleIndex = binder.getTextModuleIndex(metaModuleKey);
                    const html = `<p>${text}</p>`;
                    const updateChunkPatch = patchChunkedRichTextModuleByIndex(textModuleIndex, chunkIndex, [html], getEditorStateFromHtml(html));
                    binder = updateBinder(
                        binder,
                        () => [
                            updateChunkPatch,
                            patchAllTextMetaTimestamps(binder),
                        ],
                        true
                    );
                    chunkIndex++;
                }
            }
            languageIndex++;
        }
        const binderSer = serializeEditorStates(binder.toJSON());
        await repoServiceClient.updateBinder(binderSer);
        return binder;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const addBinderLanguages = async (binder: any, languageSpecs: ISeedLanguageSpecs[]) => {
        const primaryLanguageCode = binder && binder.getFirstLanguage().iso639_1;
        const primaryModuleKeyPair = binder.getModulePairByLanguage(primaryLanguageCode);
        const [, primaryImageModuleKey] = primaryModuleKeyPair;

        for (const languageSpec of languageSpecs) {
            const { languageCode, title } = languageSpec;
            const textModuleKey = binder.getNextTextModuleKey();
            binder = updateBinder(
                binder,
                () => [
                    patchAddTranslation(binder, textModuleKey, languageCode, "", primaryImageModuleKey, title),
                    patchAllTextMetaTimestamps(binder),
                ],
                true
            );
        }
        const binderSer = serializeEditorStates(binder.toJSON());
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await repoServiceClient.updateBinder(binderSer as any);
        return binder;
    }

    const clearSemanticLinksForDomain = async () => {
        const items = await repoServiceClient.findItems({ accountId }, { maxResults: 9999 });
        for (const item of items) {
            await Promise.all([
                routingServiceClient.deleteSemanticLinks({ domain: `http://${domain}`, binderId: item.id }),
                routingServiceClient.deleteSemanticLinks({ domain: `https://${domain}`, binderId: item.id }),
            ]);
        }

    }

    log("ensuring hierarchy...");

    await deleteExistingHierarchy();
    for (const child of (children || [])) {
        await createHierarchy(child, rootCollectionId);
    }
    await clearSemanticLinksForDomain();
    log("hierarchy ensured");
}

const createNewBinder = (title: string, languageCode: string, accountId: string) => {
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
            text: { chunked: [{ key: "t1", chunks: [[]], editorStates: [RTEState.createEmpty()] }] },
            images: { chunked: [{ key: "i1", chunks: [[]] }] }
        },
        thumbnail: {
            medium: DEFAULT_COVER_IMAGE,
            fitBehaviour: "fit",
            bgColor: "#000000"
        }
    };
    return createBinderObject(baseBinder);
};
