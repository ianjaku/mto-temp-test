import * as jsdom from "jsdom";
import * as marked from "marked";
import type { Binder, IBinderVisual } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import BinderClass, {
    createNewBinder,
    curriedMultiUpdate,
    update as updateBinder,
} from "@binders/client/lib/binders/custom/class";
import { attachVisual, updateVisualDataPatch } from "./patching";
import { editorStateToMarkdownOrEmpty, toPseudoXml } from "@binders/client/lib/binders/exporting";
import {
    patchAddTranslation,
    patchAllTextMetaTimestamps,
    patchChunkedRichTextModuleByIndex,
    patchImageSetThumbnailDetails,
    patchStoryTitleUpdate
} from "@binders/client/lib/binders/patching";
import { ContentServiceError } from "./errors";
import { ContentServiceErrorCode } from "@binders/client/lib/clients/contentservice/v1/contract";
import RTEState from "@binders/client/lib/draftjs/state";
import { Visual } from "@binders/client/lib/clients/imageservice/v1/contract";

const { JSDOM } = jsdom;

type BinderChunk = {
    chunks: string[];
    editorStates: string;
}

export class BinderOperations {
    private constructor(private binder: BinderClass) { }

    static fromClassObject(binderObj: BinderClass): BinderOperations {
        return new BinderOperations(binderObj)
    }

    static fromApiObject(binder: Binder): BinderOperations {
        return new BinderOperations(new BinderClass(binder))
    }

    toApiObject(): Binder {
        return this.binder.toJSON();
    }

    toClassObject(): BinderClass {
        return this.binder;
    }

    attachVisuals(visualMap: Map<number, string[]>, visuals: Visual[]): BinderOperations {
        let binderToUpdate = this.binder;
        for (const [chunkIndex,] of visualMap.entries()) {
            const chunkVisual = visuals.at(chunkIndex);
            const { patches } = attachVisual(chunkVisual, this.binder.getImagesModuleKey(), chunkIndex, 0);
            binderToUpdate = curriedMultiUpdate(patches, true, binderToUpdate);
        }
        return BinderOperations.fromClassObject(binderToUpdate);
    }

    updateVisualData(chunkIdx: number, visualIdx: number, visual: IBinderVisual): BinderOperations {
        let binderToUpdate = this.binder;
        const { patches } = updateVisualDataPatch(visual, this.binder.getImagesModuleKey(), chunkIdx, visualIdx);
        binderToUpdate = curriedMultiUpdate(patches, true, binderToUpdate);
        return BinderOperations.fromClassObject(binderToUpdate);
    }

    updateThumbnail(thumbnail): BinderOperations {
        let binderToUpdate = this.binder;
        const patch = patchImageSetThumbnailDetails(thumbnail);
        binderToUpdate = updateBinder(binderToUpdate, () => [patch], true);
        return BinderOperations.fromClassObject(binderToUpdate);
    }

    /**
     * Changes title of a Binder with a Markdown formatted text.
     * @param langIdx - language index
     * @param newTitle - new title formatted as plaintext
     */
    changeTitle(langIdx: number, newTitle: string): BinderOperations {
        if (!newTitle.length) return this;
        return BinderOperations.fromClassObject(updateBinder(
            this.binder,
            () => [
                patchStoryTitleUpdate(langIdx, newTitle),
                patchAllTextMetaTimestamps(this.binder, new Date()),
            ],
            true,
            true,
        ));
    }

    /**
     * Returns chunk text formatted as Markdown.
     * @param langIdx - language index
     * @param chunkIdx - chunk index - index 0 is title chunk
     */
    chunkToMarkdown(langIdx: number, chunkIdx: number): string {
        if (chunkIdx === 0) {
            return this.binder.getTitle(this.binder.getLanguageIsoByIndex(langIdx));
        }
        const editorState = this.binder.getTextModuleEditorStateByLanguageAndChunkIndex(langIdx, chunkIdx - 1);
        return editorStateToMarkdownOrEmpty(editorState);
    }

    /**
     * Replaces chunk text with a Markdown formatted text
     * @param langIdx - language index
     * @param chunkIdx - chunk index - index 0 is title chunk
     * @param markdown - new text formatted as Markdown
     */
    replaceChunkWithMarkdown(
        langIdx: number,
        chunkIdx: number,
        markdown: string,
    ): BinderOperations {
        const chunk = markdownToChunk(markdown);
        if (!chunk) {
            return this;
        }
        return BinderOperations.fromClassObject(
            this.binder.setTextModuleChunk(langIdx, chunkIdx, chunk.chunks, chunk.editorStates)
        );
    }

    /**
     * Replaces text of all chunks with a Markdown formatted text
     * @param langIdx - language index
     * @param chunkMarkdowns - array of new chunks texts formatted as markdown
     * @throws Error if the provided chunkMarkdowns has a different length than the number of binder chunks
     */
    replaceAllChunks(
        langIdx: number,
        chunkMarkdowns: string[],
    ): BinderOperations {
        const [chunks, editorStates] = chunkMarkdowns.reduce<[string[][], string[]]>(
            (res, chunkMarkdown) => {
                const { chunks, editorStates } = xmlToChunk(chunkMarkdown);
                return [[...res[0], chunks], [...res[1], editorStates]];
            },
            [[], []],
        );
        const currentChunksCount = this.binder.getBinderLog().current.length;
        if (currentChunksCount !== chunks.length) {
            throw new ContentServiceError(
                ContentServiceErrorCode.InvalidBinder,
                `Number of chunks is not the same (want to replace ${currentChunksCount} with ${chunks.length} chunks)`
            );
        }
        return BinderOperations.fromClassObject(
            this.binder.replaceTextModuleChunks(langIdx, chunks, editorStates)
        );
    }

    /**
     * Returns full Binder text as Markdown.
     * @param langIdx - language index
     */
    toMarkdown(langIdx: number): string {
        const body = this.binder.getAllEditorStatesByLanguageIndex(langIdx);
        const title = this.binder.getTitle(this.binder.getLanguageIsoByIndex(langIdx));
        if (!title.length) return "";
        const chunks = body
            .reduce((md, editorState) => ([
                md,
                editorStateToMarkdownOrEmpty(editorState),
            ].join("\n\n---\n")), "")
        return `# ${title}${chunks}`.trim();
    }

    /**
     * Returns Binder as pseudo XML.
     * @param langIdx - language index
     */
    toPseudoXml(langIdx: number): string {
        return toPseudoXml(this.binder, langIdx);
    }
}

type MinimalBinderValues = {
    accountId: string;
    chunkMarkdowns?: string[];
    languageChunks?: { [languageCode: string]: string[] }
    languageCode: string | string[];
    title: string;
}

export function createBinder(values: MinimalBinderValues): BinderClass {
    const primaryLanguage = Array.isArray(values.languageCode) ? values.languageCode[0] : values.languageCode;
    const otherLanguages = Array.isArray(values.languageCode) ? values.languageCode.slice(1) : [];

    let chunkCount = 0;
    if (values.chunkMarkdowns && values.chunkMarkdowns.length > chunkCount) {
        chunkCount = values.chunkMarkdowns.length;
    }
    for (const chunks of Object.values(values.languageChunks ?? {})) {
        if (chunks.length > chunkCount) {
            chunkCount = chunks.length;
        }
    }

    let binderObj = createNewBinder(values.title, primaryLanguage, values.accountId, chunkCount);

    if (values.chunkMarkdowns && values.chunkMarkdowns.length > 0) {
        for (const [index, chunk] of values.chunkMarkdowns.entries()) {
            binderObj = setChunkValue(binderObj, primaryLanguage, index, chunk);
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
                binderObj = setChunkValue(binderObj, languageCode, index, chunk);
            }
        }
    }

    return binderObj;
}

function editorStateFromHtml(html: string): string {
    const dom = new JSDOM(html);
    global.document = dom.window.document;
    global.HTMLElement = dom.window.HTMLElement;
    return RTEState.serialize(RTEState.createFromHtml(html));
}

function markdownToChunk(markdown: string): BinderChunk {
    if (markdown == null || markdown.length === 0) {
        return null;
    }
    const html = markdownToHtml(markdown);
    const editorStates = editorStateFromHtml(html);
    return {
        chunks: [html],
        editorStates,
    }
}

function xmlToChunk(html: string): BinderChunk {
    if (html == null || html.length === 0) {
        return null;
    }
    const editorStates = editorStateFromHtml(html);
    return {
        chunks: [html],
        editorStates,
    }
}

function markdownToHtml(markdown: string): string {
    // marked.parse returns Promise iff async: true is passed in options, otherwise it returns string
    return (marked.parse(markdown) as string).trim();
}

function setChunkValue(
    binderObj: BinderClass,
    languageCode: string,
    chunkPosition: number,
    markdown: string
) {
    const chunk = markdownToChunk(markdown);
    if (chunk == null) return binderObj;
    const metaModuleIndex = binderObj.getMetaModuleIndexByLanguageCode(languageCode);
    const metaModuleKey = binderObj.getModules().meta?.[metaModuleIndex].key;
    const textModuleIndex = binderObj.getTextModuleIndex(metaModuleKey);
    const updateChunkPatch = patchChunkedRichTextModuleByIndex(
        textModuleIndex,
        chunkPosition,
        chunk.chunks,
        chunk.editorStates,
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

