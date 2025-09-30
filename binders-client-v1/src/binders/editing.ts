import {
    mergePatches,
    patchAllTextMetaTimestamps,
    patchChunkedRichTextModuleByIndex,
    patchEnsureJsonPropInTextModule,
    patchInjectChunk,
    patchMetaTimestamp,
    patchStoryTitleUpdate,
    patchUpdateBinderLog
} from "./patching";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const updateStoryTitle = (binder, isoCode, storyTitle) => {
    const languageIndex = binder.getLanguageIndex(isoCode);
    const patch = patchStoryTitleUpdate(languageIndex, storyTitle);
    const moduleKey = binder.getLanguageByIso(isoCode).modules[0];
    const metaPatch = patchMetaTimestamp(binder, moduleKey);
    return mergePatches([patch, metaPatch]);
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const updateRichTextChunk = (binder, moduleKey, chunkIndex, paragraphs, editorState, json?) => {
    const moduleIndex = binder.getTextModuleIndex(moduleKey);
    const patch = patchChunkedRichTextModuleByIndex(moduleIndex, chunkIndex, paragraphs, editorState, json);
    const metaPatch = patchMetaTimestamp(binder, moduleKey);
    const logPatch = patchUpdateBinderLog(binder, chunkIndex);
    return [
        ...(json ? [patchEnsureJsonPropInTextModule()] : []),
        mergePatches([patch, logPatch, metaPatch])
    ];
};

export const getInjectChunkPatches = (binder, chunkIndex, originalIndex, shouldUseNewTextEditor) => {
    const patch = patchInjectChunk(binder, chunkIndex, originalIndex, shouldUseNewTextEditor);
    const metaPatch = patchAllTextMetaTimestamps(binder);
    return [
        ...(shouldUseNewTextEditor ? [patchEnsureJsonPropInTextModule()] : []),
        mergePatches([patch, metaPatch]),
    ];
};