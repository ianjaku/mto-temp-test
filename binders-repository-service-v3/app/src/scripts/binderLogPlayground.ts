/* eslint-disable no-console */
import { create as createBinderObject, update } from "@binders/client/lib/binders/custom/class";
import {
    mergePatches,
    patchChunkedRichTextModuleByIndex,
    patchInjectChunk,
    patchMergeChunks,
    patchMetaTimestamp,
    patchUpdateBinderLog
} from "@binders/client/lib/binders/patching";
import { DEFAULT_COVER_IMAGE } from "@binders/client/lib/binders/defaults";
import RTEState from "@binders/client/lib/draftjs/state";

const DEFAULT_FIT_BEHAVIOUR = "fit";
const DEFAULT_THUMBNAIL_BG_COLOR = "#000000";

const DEFAULT_ACCOUNT_ID = "aid-xxxxxxx-xxxxxx-xxxxx";
const DEFAULT_ISO_CODE = "en-us";
const DEFAULT_TITLE = `Binder From Playground: ${Date.now()}`;

const baseBinder = {
    bindersVersion: "0.3.0",
    authors: [],
    authorIds: [],
    accountId: DEFAULT_ACCOUNT_ID,
    languages: [
        {
            iso639_1: DEFAULT_ISO_CODE,
            modules: ["t1"],
            storyTitle: DEFAULT_TITLE,
            storyTitleRaw: DEFAULT_TITLE,
            priority: 0,
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
                iso639_1: DEFAULT_ISO_CODE,
            },
            {
                key: "i1",
                type: "images",
                format: "chunked",
                markup: "url",
                caption: "Original illustrations",
            },
        ],
        text: { chunked: [{ key: "t1", chunks: [[]], editorStates: [RTEState.createEmpty()] }] },
        images: { chunked: [{ key: "i1", chunks: [[]] }] },
    },
    thumbnail: {
        medium: DEFAULT_COVER_IMAGE,
        fitBehaviour: DEFAULT_FIT_BEHAVIOUR,
        bgColor: DEFAULT_THUMBNAIL_BG_COLOR,
    },
};

const binder = createBinderObject(baseBinder);
console.log("Starting Binder log:", JSON.stringify(binder, undefined, 2));

// write something to the first chunk
const moduleKey = "t1";
const text = "Hello, world!";
const paragraphs = [text];
const editorState = RTEState.createFromText(text);
const moduleIndex = binder.getTextModuleIndex(moduleKey);
const patch = patchChunkedRichTextModuleByIndex(moduleIndex, 0, paragraphs, editorState);
const metaPatch = patchMetaTimestamp(binder, moduleKey);
const logPatch = patchUpdateBinderLog(binder, 0);
const updateLogPatch = mergePatches([patch, logPatch, metaPatch]);
let updatedBinder = update(binder, () => [updateLogPatch], true);
console.log("Binder log after first text:", JSON.stringify(updatedBinder.getBinderLog(), undefined, 2));

//
const injectChunk1Patch = patchInjectChunk(binder, 1, 1);
updatedBinder = update(updatedBinder, () => [injectChunk1Patch], true);
console.log("Binder log after inject chunk 1:", JSON.stringify(updatedBinder.getBinderLog(), undefined, 2));
const injectChunk2Patch = patchInjectChunk(updatedBinder, 2, 2);
updatedBinder = update(updatedBinder, () => [injectChunk2Patch], true);
console.log("Binder log after inject chunk 2:", JSON.stringify(updatedBinder.getBinderLog(), undefined, 2));
const mergeIndex = 1;
const deleteChunkPatch = patchMergeChunks(updatedBinder, mergeIndex, false);
updatedBinder = update(updatedBinder, deleteChunkPatch, true);
console.log("Binder log after merge chunk patch at", mergeIndex, ":", JSON.stringify(updatedBinder.getBinderLog(), undefined, 2));

