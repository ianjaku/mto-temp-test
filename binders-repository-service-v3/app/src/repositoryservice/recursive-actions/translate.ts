import { updateRichTextChunk, updateStoryTitle } from "@binders/client/lib/binders/editing";
import BinderClass from "@binders/client/lib/binders/custom/class";
import { DocumentCollection } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { UpdatePatch } from "tcomb";
import { patchAddTranslation } from "@binders/client/lib/binders/patching";

export type UpdatePatchFn = (b: BinderClass) => UpdatePatch | UpdatePatch[]

export interface TranslateChunkParams {
    binderObject: BinderClass,
    sourceModuleKey: string
    sourceLanguageCode: string,
    targetModuleKey: string,
    targetLanguageCode: string
}


export function addMissingLanguage(binderObject: BinderClass, targetLanguageCode: string) {
    const textModuleKey = binderObject.getNextTextModuleKey();
    const caption = "";
    const storyTitle = "";

    const primaryLanguageCode = binderObject.getFirstLanguage().iso639_1
    const [, imageModuleKey] = binderObject.getModulePairByLanguage(primaryLanguageCode)
    return (binder: BinderClass) => patchAddTranslation(binder, textModuleKey, targetLanguageCode, caption, imageModuleKey, storyTitle);
}

export async function translateTitle(
    binderObject: BinderClass,
    sourceLanguageCode: string,
    targetLanguageCode: string,
    translateFn: (txt: string, sourceLangCode: string, targetLangCode: string, isHtml?: false) => Promise<string>,
    overwriteExistingContent = false
): Promise<UpdatePatchFn> {
    const targetTitle = binderObject.getTitle(targetLanguageCode)
    if (targetTitle === "" || overwriteExistingContent) {
        const sourceTitle = binderObject.getTitle(sourceLanguageCode)
        const translatedTitle = await translateFn(sourceTitle, sourceLanguageCode, targetLanguageCode)
        return (binder) => updateStoryTitle(binder, targetLanguageCode, translatedTitle)
    }
    return undefined
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function translateCollectionTitle(collectionObject: DocumentCollection, sourceLanguageCode: string, targetLanguageCode: string, translateFn): Promise<string> {
    const targetTitle = collectionObject.titles.find(title => title.languageCode === targetLanguageCode);
    const sourceTitle = collectionObject.titles.find(title => title.languageCode === sourceLanguageCode);
    if (!targetTitle && sourceTitle) {
        const translatedTitle = await translateFn(sourceTitle.title, sourceLanguageCode, targetLanguageCode);
        return translatedTitle;
    }
    return undefined
}

export async function translateChunks(
    params: TranslateChunkParams,
    translateFn: (txt: string, sourceLangCode: string, targetLangCode: string, isHtml?: boolean) => Promise<string>,
    overwriteExistingContent = false
): Promise<UpdatePatchFn[]> {
    const {
        binderObject,
        sourceModuleKey,
        sourceLanguageCode,
        targetModuleKey,
        targetLanguageCode
    } = params
    const sourceChunks = binderObject.getAllTextChunks(sourceModuleKey)
    const targetChunks = binderObject.getAllTextChunks(targetModuleKey)
    const translatePromises = []
    for (let i = 0; i < sourceChunks.length; i++) {
        const targetChunkHtml = targetChunks[i] && targetChunks[i].length > 0 && targetChunks[i][0]
        const html = sourceChunks[i][0]
        if ((overwriteExistingContent || isChunkEmpty(targetChunkHtml)) && html) {
            const translateResult = translateFn(html, sourceLanguageCode, targetLanguageCode, true)
            translatePromises.push(translateResult)
        } else {
            translatePromises.push(Promise.resolve(undefined)) // needed to have correct chunk index
        }
    }
    const translationResults = await Promise.all(translatePromises)
    return translationResults
        .map(
            (translationResult, chunkIndex) => {
                const editorState = undefined
                return translationResult ?
                    (binder) => updateRichTextChunk(binder, targetModuleKey, chunkIndex, [translationResult], editorState) :
                    undefined
            }
        )
        .filter(res => !!res)
}

function isChunkEmpty(html) {
    if (!html) {
        return true
    }
    const rawText = html.replace(/<\/?[^>]+(>|$)/g, "").replace(/&nbsp;/g, "").trim()
    return rawText === ""
}
