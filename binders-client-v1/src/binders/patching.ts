/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
// these are the patching functions moved over from the editor. TODO: merge / sync this with the new patches in patch.ts
import {
    BinderContentModuleName,
    IChunkCurrentPositionLog,
    IThumbnail
} from "../clients/repositoryservice/v3/contract";
import { EMPTY_JSON_DOCUMENT, mergeRawJsonDocuments } from "../util/tiptap";
import { insert, mergeAll, mergeDeepLeft, remove, repeat, times } from "ramda";
import BinderClass from "./custom/class";
import { DATE_CHANGED_MARKER } from "./defaults";
import { EditorState } from "draft-js";
import RTEState from "../draftjs/state";
import UUID from "../util/uuid";
import { UpdatePatch } from "tcomb";

const chunkedTextModulePatchBase = () => ({
    modules: {
        text: {
            chunked: {}
        }
    }
});

export const patchMetaModuleIsDeleted = (metaModuleIndex: number, isDeleted: boolean) => {
    const patch = {
        modules: {
            meta: {}
        }
    };
    patch.modules.meta[metaModuleIndex] = {
        $merge: {
            isDeleted,
            lastModifiedDate: DATE_CHANGED_MARKER,
        }
    };
    return patch;
};

export function patchDeleteMetaModule(moduleIndex: number): UpdatePatch {
    return {
        modules: {
            meta: {
                $splice: [[moduleIndex, 1]]
            }
        }
    };
}

export function patchDeleteContentModule(moduleName: BinderContentModuleName, moduleIndex: number): UpdatePatch {
    const patch = {
        modules: {}
    };
    patch.modules[moduleName] = {
        chunked: {
            $splice: [[moduleIndex, 1]]
        }
    };
    return patch;
}

export function patchDeleteLanguage(languageIndex: number): UpdatePatch {
    return {
        languages: {
            $splice: [[languageIndex, 1]]
        }
    };
}

export function patchDeleteLinkPairs(indices: number[]): UpdatePatch {
    return {
        links: {
            "index-pairs": {
                $splice: indices.map(i => [i, 1]),
            }
        }
    };
}

export function patchRelabelLanguageCode(
    langIndexInLanguages: number,
    langIndexInMeta: number,
    toLanguageCode: string,
): UpdatePatch {
    const patch = {
        languages: {},
        modules: { meta: {} },
    };
    patch.languages[langIndexInLanguages] = {
        $merge: {
            iso639_1: toLanguageCode,
        }
    };
    patch.modules.meta[langIndexInMeta] = {
        $merge: {
            iso639_1: toLanguageCode,
        }
    };
    return patch;
}

const patchNewTextModule = (
    chunks: string[][],
    json: string[] | undefined,
    editorStates: EditorState[],
    moduleKey: string,
    isoCode: string,
    caption: string,
    markup: string,
) => ({
    modules: {
        meta: {
            $push: [
                {
                    key: moduleKey,
                    type: "text",
                    format: "chunked",
                    markup,
                    caption,
                    iso639_1: isoCode,
                    lastModifiedDate: DATE_CHANGED_MARKER,
                }
            ]
        },
        text: {
            chunked: {
                $push: [
                    {
                        key: moduleKey,
                        chunks,
                        ...(json ? { json } : {}),
                        editorStates
                    }
                ]
            }
        }
    }
});

const binderLogTime = () => Date.now();
const createNewLogUUID = () => UUID.random().toString();

const buildNewBinderLogCurrentEntry = (chunkIndex: number): IChunkCurrentPositionLog => {
    const now = binderLogTime();
    return {
        createdAt: now,
        position: chunkIndex,
        updatedAt: now,
        uuid: createNewLogUUID(),
        targetId: [],
    };
};

export const patchInjectChunk = (
    binder: BinderClass,
    chunkIndex: number,
    originalIndex: number,
    shouldUseNewTextEditor = false,
) => {
    const logIndex = originalIndex || chunkIndex;
    const patch = {
        modules: {
            text: {
                chunked: {}
            },
            images: {
                chunked: {}
            }
        },
    };
    binder.getModules().text.chunked.forEach((_module, moduleIndex) => {
        patch.modules.text.chunked[moduleIndex] = {
            chunks: {
                $splice: [[chunkIndex + 1, 0, []]]
            },
            ...(shouldUseNewTextEditor ?
                {
                    json: {
                        $splice: [[chunkIndex + 1, 0, EMPTY_JSON_DOCUMENT]]
                    },
                } :
                {}),
            editorStates: {
                $splice: [[chunkIndex + 1, 0, RTEState.createEmpty()]]
            }
        };
    });

    binder.getModules().images.chunked.forEach((_module, moduleIndex) => {
        patch.modules.images.chunked[moduleIndex] = {
            chunks: {
                $splice: [[chunkIndex + 1, 0, []]]
            }
        };
    });
    const oldBinderLog = binder.getBinderLog() || baseBinderLogPatch();
    const currentLog = oldBinderLog.current;
    if (logIndex === currentLog.length) {
        patch["binderLog"] = {
            current: {
                $push: [buildNewBinderLogCurrentEntry(logIndex)],
            },
        };
        return patch;
    }

    const newLogEntries = currentLog.reduce((out, log) => {
        if (log.position < logIndex) {
            return [...out, log];
        }
        if (log.position === logIndex) {
            return [
                ...out,
                buildNewBinderLogCurrentEntry(logIndex),
                {
                    ...log,
                    position: log.position + 1,
                    updatedAt: binderLogTime(),
                },
            ]
        }
        return out.concat({
            ...log,
            position: log.position + 1,
            updatedAt: binderLogTime(),
        });
    }, []);
    patch["binderLog"] = {
        $set: { current: newLogEntries },
    };

    return patch;
};

const baseBinderLogPatch = () => ({
    current: [] as IChunkCurrentPositionLog[],
});

export const patchImageSetThumbnailDetails = (thumbnailDetails: IThumbnail) => {
    return {
        thumbnail: {
            $set: thumbnailDetails
        }
    };
}

export const setThumbnailDetails = (binder: BinderClass, thumbnailDetails: IThumbnail) => {
    const patch = patchImageSetThumbnailDetails(thumbnailDetails);
    const metaPatch = patchAllTextMetaTimestamps(binder);
    return mergePatches([patch, metaPatch]);
};

/**
 * patch used to ensure there's a json prop in all text modules with equal length to chunks
 * it's safe to include this patch when using patchChunkedRichTextModuleByIndex with json prop set
 */
export const patchEnsureJsonPropInTextModule = () => {
    const patch = chunkedTextModulePatchBase();
    patch.modules.text.chunked = {
        $apply: (chunked) => {
            return chunked.map((module) => {
                return {
                    ...module,
                    json: module.json || times<string>(() => "", module.chunks.length),
                };
            });
        }
    }
    return patch;
};

export const patchChunkedRichTextModuleByIndex = (
    moduleIndex: number,
    chunkIndex: number,
    chunks: string[],
    editorState?: EditorState | string | string[],
    json?: string,
) => {
    const patch = chunkedTextModulePatchBase();
    const moduleData = (patch.modules.text.chunked[moduleIndex] = {
        chunks: {},
        ...(json ? { json: {} } : {}),
        editorStates: {}
    });
    moduleData.chunks[chunkIndex] = {
        $set: chunks
    };
    if (json) {
        moduleData.json[chunkIndex] = {
            $set: json
        };
    }
    if (editorState) {
        moduleData.editorStates[chunkIndex] = {
            $set: editorState
        };
    }
    return patch;
};

export const patchUpdateBinderLog = (binder: BinderClass, chunkIndex: number) => {
    const oldBinderLog = binder.getBinderLog() || baseBinderLogPatch();
    const currentLogEntry = oldBinderLog.current.find(log => log.position === chunkIndex) || buildNewBinderLogCurrentEntry(chunkIndex);
    const current = {
        ...currentLogEntry,
        updatedAt: binderLogTime(),
    };
    return {
        binderLog: {
            current: {
                $splice: [[chunkIndex, 1, current]]
            }
        },
    };
}

const patchNewLanguage = (moduleKey: string, isoCode: string, storyTitle: string, priority: number) => ({
    languages: {
        $push: [
            {
                iso639_1: isoCode,
                modules: [moduleKey],
                storyTitle,
                storyTitleRaw: storyTitle,
                priority
            }
        ]
    }
});

const patchNewLink = (moduleKeyA: string, moduleKeyB: string) => ({
    links: {
        "index-pairs": {
            $push: [[moduleKeyA, moduleKeyB]]
        }
    }
});


export const patchAddTranslation = (
    binder: BinderClass,
    textModuleKey: string,
    isoCode: string,
    caption: string,
    imageModuleKey: string,
    storyTitle: string,
    shouldUseNewTextEditor = false,
) => {
    const currentMetaModuleIndex = binder.getMetaModuleIndexByLanguageCode(isoCode);
    if (currentMetaModuleIndex >= 0) {
        return patchMetaModuleIsDeleted(currentMetaModuleIndex, false);
    } else {
        const chunkCount = binder.getTextModuleByLanguageIndex(0)?.chunks?.length;
        const markup = binder.getMetaModuleByIndex(0).markup;
        const chunks = repeat<string[]>([], chunkCount);
        const json = shouldUseNewTextEditor ? repeat(EMPTY_JSON_DOCUMENT, chunkCount) : undefined;
        const editorStates = repeat(undefined, chunkCount).map(() => RTEState.createEmpty());
        return mergeAll([
            patchNewTextModule(chunks, json, editorStates, textModuleKey, isoCode, caption, markup),
            patchNewLanguage(textModuleKey, isoCode, storyTitle, binder.getLanguages().length),
            patchNewLink(textModuleKey, imageModuleKey)
        ]);
    }
};


/** Merge Operation */

const metaModulePatchBase = () => ({
    modules: {
        meta: {}
    },
});

export const patchMetaTimestamp = (binder: BinderClass, moduleKey: string) => {
    const details = binder.updateMetaTimestamp(moduleKey);
    const metaPatch = metaModulePatchBase();
    metaPatch.modules.meta[details.index] = {
        $set: details.module
    };
    return metaPatch;
};

export const patchAllTextMetaTimestamps = (
    binder: BinderClass,
    date: Date | string = DATE_CHANGED_MARKER
) => {
    const metaPatch = metaModulePatchBase();
    const metaModulesLength = binder.getMetaModulesLength();
    Array.from(Array(metaModulesLength).keys()).map(m => {
        metaPatch.modules.meta[m] = {
            $merge: {
                lastModifiedDate: date
            }
        };
    });
    return metaPatch;
};

export const patchStoryTitleUpdate = (languageIndex: number, storyTitle: string) => {
    const patch = {
        languages: {}
    };
    patch.languages[languageIndex] = {
        $merge: {
            storyTitle,
            storyTitleRaw: storyTitle
        }
    };
    return patch;
};

const basePatch = () => ({
    modules: {
        text: {
            chunked: {},
        },
        images: {
            chunked: {},
        },
    },
});

const addMergeOperations = (
    binder: BinderClass,
    dataPatch: ReturnType<typeof basePatch>,
    removePatch: ReturnType<typeof basePatch>,
    chunkIndex: number
) => (type: "text" | "image") => {
    const modules = binder.getModules();
    modules[type].chunked.forEach((_: unknown, index: number) => {
        dataPatch.modules[type].chunked[index] = {
            chunks: {}
        };
        dataPatch.modules[type].chunked[index].chunks[chunkIndex] = {
            $set: modules[type].chunked[index].chunks[chunkIndex].concat(
                modules[type].chunked[index].chunks[chunkIndex + 1]
            )
        };
        removePatch.modules[type].chunked[index] = {
            chunks: {
                $splice: [[chunkIndex + 1, 1]]
            }
        };
    });
};

const mergeChunksEditorStates = (binder: BinderClass, chunkIndex: number) => {
    const dataPatch = basePatch();
    const removePatch = basePatch();
    const modules = binder.getModules();
    modules.text.chunked.forEach((_module, moduleIndex) => {
        dataPatch.modules.text.chunked[moduleIndex] = {
            editorStates: {}
        };
        dataPatch.modules.text.chunked[moduleIndex].editorStates[chunkIndex] = {
            $set: RTEState.mergeStates(
                modules.text.chunked[moduleIndex].editorStates[chunkIndex],
                modules.text.chunked[moduleIndex].editorStates[chunkIndex + 1]
            )
        };
        removePatch.modules.text.chunked[moduleIndex] = {
            editorStates: {
                $splice: [[chunkIndex + 1, 1]]
            }
        };
    });
    return { dataPatch, removePatch };
}

const mergeChunksJsonDocuments = (binder: BinderClass, chunkIndex: number, shouldUseNewTextEditor: boolean) => {
    const dataPatch = basePatch();
    const removePatch = basePatch();
    const modules = binder.getModules();
    modules.text.chunked.forEach((_module, moduleIndex) => {
        dataPatch.modules.text.chunked[moduleIndex] = {
            json: {}
        };
        if (shouldUseNewTextEditor) {
            dataPatch.modules.text.chunked[moduleIndex].json[chunkIndex] = {
                $set: mergeRawJsonDocuments([
                    modules.text.chunked[moduleIndex].json[chunkIndex],
                    modules.text.chunked[moduleIndex].json[chunkIndex + 1]
                ])
            };
        }
        removePatch.modules.text.chunked[moduleIndex] = {
            json: {
                $splice: [[chunkIndex + 1, 1]]
            }
        };
    });
    return { dataPatch, removePatch };
}

const mergeBinderLogEntries = (binder: BinderClass, chunkIndex: number) => {
    const oldBinderLog = binder.getBinderLog() || baseBinderLogPatch();
    const current = oldBinderLog.current.reduce<IChunkCurrentPositionLog[]>((out, log) => {
        if (log.position === chunkIndex) {
            return out.concat({
                ...log,
                uuid: createNewLogUUID(),
                updatedAt: binderLogTime(),
                targetId: [
                    log.uuid,
                    oldBinderLog.current[chunkIndex + 1] ? oldBinderLog.current[chunkIndex + 1].uuid : undefined,
                    ...log.targetId,
                ],
            });
        }
        if (log.position === chunkIndex + 1) {
            return out;
        }
        return out.concat({
            ...log,
            position: log.position > chunkIndex + 1 ? log.position - 1 : log.position,
            updatedAt: binderLogTime(),
        });
    }, [])
    return {
        binderLog: {
            $set: { current },
        },
    };
}

export const patchMergeChunks = (binder: BinderClass, chunkIndex: number, shouldUseNewTextEditor: boolean) => {
    const dataPatch = basePatch();
    const removePatch = basePatch();
    ["text", "images"].forEach(addMergeOperations(binder, dataPatch, removePatch, chunkIndex));
    const { dataPatch: dataPatchEditorState, removePatch: removePatchEditorState } = mergeChunksEditorStates(binder, chunkIndex);
    const patches: Array<unknown> = [dataPatch, dataPatchEditorState];
    if (shouldUseNewTextEditor) {
        const { dataPatch: dataPatchJson, removePatch: removePatchJson } = mergeChunksJsonDocuments(binder, chunkIndex, true);
        patches.push(dataPatchJson);
        patches.push(removePatchEditorState);
        patches.push(removePatch);
        patches.push(removePatchJson);
    } else {
        patches.push(removePatchEditorState);
        patches.push(removePatch);
    }
    const logPatch = mergeBinderLogEntries(binder, chunkIndex);
    const metaPatch = patchAllTextMetaTimestamps(binder);
    patches.push(logPatch);
    patches.push(metaPatch);
    return mergePatches(patches);
}

export function mergePatches(patches) {
    return patches.reduce(mergeDeepLeft, {});
}

/** Reposition operations */

export const patchRepositionChunks = (binder: BinderClass, chunkIndex1: number, chunkIndex2: number, shouldUseNewTextEditor: boolean) => {
    const basePatch = () => ({
        modules: {
            text: {
                chunked: {}
            },
            images: {
                chunked: {}
            }
        }
    });
    const removeChunkPatch = basePatch();
    const reinsertChunkPatch = basePatch();
    const repositionOperations = (type: "text" | "images") => {
        binder.getModules()[type].chunked.forEach((module, index: number) => {
            removeChunkPatch.modules[type].chunked[index] = {
                chunks: {}
            };
            reinsertChunkPatch.modules[type].chunked[index] = {
                chunks: {}
            };
            removeChunkPatch.modules[type].chunked[index].chunks = {
                $splice: [[chunkIndex1, 1]]
            };
            reinsertChunkPatch.modules[type].chunked[index].chunks = {
                $splice: [[chunkIndex2, 0, module.chunks[chunkIndex1]]]
            };
            if (type === "text") {
                removeChunkPatch.modules["text"].chunked[index].editorStates = { "$splice": [[chunkIndex1, 1]] };
                reinsertChunkPatch.modules["text"].chunked[index].editorStates = { "$splice": [[chunkIndex2, 0, module.editorStates[chunkIndex1]]] };
                if (shouldUseNewTextEditor) {
                    removeChunkPatch.modules["text"].chunked[index].json = { "$splice": [[chunkIndex1, 1]] };
                    reinsertChunkPatch.modules["text"].chunked[index].json = { "$splice": [[chunkIndex2, 0, module.json[chunkIndex1]]] };
                }
            }
        });
    };
    ["text", "images"].forEach(repositionOperations);
    const logPatch = repositionBinderLogEntries(binder, chunkIndex1, chunkIndex2);
    return [removeChunkPatch, reinsertChunkPatch, logPatch];
};

const move = (i1: number, i2: number, arr: IChunkCurrentPositionLog[]) => {
    const el = arr[i1];
    const a = remove(i1, 1, arr);
    return insert(i2, el, a);
};

const repositionBinderLogEntries = (binder: BinderClass, chunkIndex1: number, chunkIndex2: number) => {
    const { current: previous } = binder.getBinderLog() || baseBinderLogPatch();
    const now = binderLogTime();
    // sort items with position indicator
    const sortedWithPosition = [...previous].sort((e1, e2) => e1.position - e2.position);
    // move items in position -now the order in array is fine
    const movedItems = move(chunkIndex1, chunkIndex2, sortedWithPosition);
    // just need to fix internal position marker to match array index and set updatedAt to now for moved one
    const current = movedItems.map((e, i) => {
        // MT-3388 [fix] trying to spread an array into an object
        const objE = Object.keys(e).reduce((res, item) => ({ ...res, [item]: e[item] }), {});
        if (i === chunkIndex2) {
            return { ...objE, updatedAt: now, position: i }
        }
        return { ...objE, position: i };
    });
    return {
        binderLog: {
            $set: { current },
        },
    };
}

/** New Binder Log */

export const patchBinderLogForOldBinder = (binder: BinderClass) => {
    const current: IChunkCurrentPositionLog[] = [];
    binder.getModules().text.chunked.find(chunk => chunk.key === "t1").chunks.forEach((_, index) => {
        current.push(buildNewBinderLogCurrentEntry(index));
    });
    return {
        binderLog: {
            $set: { current },
        }
    };
}