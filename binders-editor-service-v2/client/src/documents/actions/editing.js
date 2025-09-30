import { ACTION_LIFT_ACTIVE_BINDER, KEY_BINDER_IS_DIRTY } from "../store";
import {
    mergePatches,
    patchAddTranslation,
    patchAllTextMetaTimestamps,
    patchImageSetThumbnailDetails,
    patchMergeChunks,
    patchMetaModuleIsDeleted,
    patchRelabelLanguageCode,
    patchRepositionChunks,
    patchUpdateBinderLog
} from "@binders/client/lib/binders/patching";
import { DEFAULT_COVER_IMAGE } from "@binders/client/lib/binders/defaults";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import {
    LaunchDarklyFlagsStoreGetters
} from "@binders/ui-kit/lib/thirdparty/launchdarkly/ld-flags-store";
import { VisualKind } from "@binders/client/lib/clients/imageservice/v1/contract";
import { dispatch } from "@binders/client/lib/react/flux/dispatcher";
import { thumbnailHasId } from "../../media/helper";
import { update as updateBinder } from "@binders/client/lib/binders/custom/class";


const chunkedImagesModulePatchBase = () => ({
    modules: {
        images: {
            chunked: {}
        }
    }
});

export const patchImageIntoPosition = (moduleIndex, chunkIndex, imageIndex, image) => {
    const patch = chunkedImagesModulePatchBase();
    const moduleData = (patch.modules.images.chunked[moduleIndex] = {
        chunks: {}
    });
    moduleData.chunks[chunkIndex] = {
        $splice: [[imageIndex, 0, image]]
    };
    return patch;
};

export const patchImageRemove = (moduleIndex, fromChunkIndex, fromImageIndex) => {
    const patch = chunkedImagesModulePatchBase();
    const moduleData = (patch.modules.images.chunked[moduleIndex] = {
        chunks: {}
    });
    moduleData.chunks[fromChunkIndex] = {
        $splice: [[fromImageIndex, 1]]
    };
    return patch;
};

export const patchImageMove = (moduleIndex, fromChunkIndex, fromImageIndex, chunkIndex, imageIndex, image) => {
    const patch = patchImageRemove(moduleIndex, fromChunkIndex, fromImageIndex);
    const moduleData = patch.modules.images.chunked[moduleIndex];

    //When moving from the same chunk, the remove operation may shift the index to insert by one.
    if (fromChunkIndex === chunkIndex) {
        moduleData.chunks[chunkIndex].$splice.push([
            imageIndex,
            0,
            image
        ]);
    } else {
        //Otherwise use a separate splice operation.
        moduleData.chunks[chunkIndex] = {
            $splice: [[imageIndex, 0, image]]
        };
    }
    return patch;
};

export const patchReplaceVisual = (binder, moduleIndex, visualIndicesToReplace, oldVisual, newVisual) => {
    let patch = chunkedImagesModulePatchBase();
    const moduleData = (patch.modules.images.chunked[moduleIndex] = {
        chunks: {}
    });
    for (let chunkPos of Object.keys(visualIndicesToReplace[moduleIndex])) {
        moduleData.chunks[chunkPos] = {};
        for (let visualPos of Object.keys(visualIndicesToReplace[moduleIndex][chunkPos])) {
            const existingBinderVisual = binder.modules.images.chunked[moduleIndex].chunks[chunkPos][visualPos];
            moduleData.chunks[chunkPos][visualPos] = {
                $merge: {
                    id: newVisual.id,
                    url: newVisual.url,
                    // Preserve existing chunk-specific properties
                    fitBehaviour: existingBinderVisual.fitBehaviour,
                    bgColor: existingBinderVisual.bgColor || oldVisual.bgColor,
                    languageCodes: existingBinderVisual.languageCodes,
                    audioEnabled: existingBinderVisual.audioEnabled,
                    autoPlay: existingBinderVisual.autoPlay,
                }
            };
        }
    }
    if (binder.thumbnail && thumbnailHasId(binder.thumbnail, oldVisual.id)) {
        if (newVisual.kind !== VisualKind.VIDEO && !newVisual.id.startsWith("vid-")) {
            const existingThumbnail = binder.thumbnail;
            patch.thumbnail = {
                medium: {
                    $set: newVisual.url
                },
                bgColor: {
                    $set: existingThumbnail.bgColor || oldVisual.bgColor,
                },
                fitBehaviour: {
                    $set: existingThumbnail.fitBehaviour || oldVisual.fitBehaviour,
                },
            };
        }
    }
    return patch;
};

export const patchImageEditProps = (binder, moduleIndex, imageId, props) => {
    const patch = chunkedImagesModulePatchBase();
    const chunks = {};

    let setProps = {};
    for (let prop in props) {
        setProps[prop] = { $set: props[prop] };
    }

    if (binder.thumbnail && thumbnailHasId(binder.thumbnail, imageId)) {
        patch["thumbnail"] = setProps;
    }

    for (let i = 0; i < binder.modules.images.chunked[0].chunks.length; i++) {
        let chunk = binder.modules.images.chunked[0].chunks[i];
        for (let j = 0; j < chunk.length; j++) {
            if (chunk[j].id === imageId || (chunk[j].id === undefined && chunk[j].url.indexOf(imageId) !== -1)) {
                chunks[i] = chunks[i] || {};
                chunks[i][j] = setProps;
            }
        }
    }
    patch.modules.images.chunked[moduleIndex] = {
        chunks
    };
    const metaPatch = patchAllTextMetaTimestamps(binder);
    return mergePatches([patch, metaPatch]);
};

export const patchImageEditPropsAtIndex = (binder, moduleIndex, chunkIdx, visualIdx, props) => {
    const setProps = {};
    for (let prop in props) {
        setProps[prop] = { $set: props[prop] };
    }

    const patch = chunkedImagesModulePatchBase();
    const chunks = {};

    if (chunkIdx === 0) {
        patch["thumbnail"] = setProps;
    } else {
        chunks[chunkIdx - 1] = { [visualIdx]: setProps };
    }
    patch.modules.images.chunked[moduleIndex] = { chunks };
    const metaPatch = patchAllTextMetaTimestamps(binder);
    return mergePatches([patch, metaPatch]);
};

export const patchMetaPDFExportOptions = (metaModuleIndex, pdfExportOptions) => {
    const patch = {
        modules: {
            meta: {},
        },
    };
    patch.modules.meta[metaModuleIndex] = {
        $merge: {
            pdfExportOptions,
        },
    };
    return patch;
};

export const resetThumbnail = (binder) => {
    const defaultThumbnailDetails = {
        medium: DEFAULT_COVER_IMAGE,
        fitBehaviour: "fit",
        bgColor: "transparent",
    }
    const patch = patchImageSetThumbnailDetails(defaultThumbnailDetails);
    const metaPatch = patchAllTextMetaTimestamps(binder);
    return mergePatches([patch, metaPatch])
}

export const addCheckableItem = (binder, chunkIndex) => {
    const logPatch = patchUpdateBinderLog(binder, chunkIndex);
    const metaPatch = patchAllTextMetaTimestamps(binder);
    const patches = [logPatch, metaPatch];
    return mergePatches(patches);
};

export const addImage = (binder, moduleKey, chunkIndex, imageIndex, image) => {
    const moduleIndex = binder.getImagesModuleIndex(moduleKey);
    const patch = patchImageIntoPosition(moduleIndex, chunkIndex, imageIndex, image);
    const logPatch = patchUpdateBinderLog(binder, chunkIndex);
    const metaPatch = patchAllTextMetaTimestamps(binder);
    const patches = [patch, logPatch, metaPatch];
    return mergePatches(patches);
};

export const moveImage = (binder, moduleKey, fromChunkIndex, fromImageIndex, chunkIndex, imageIndex, image) => {
    const moduleIndex = binder.getImagesModuleIndex(moduleKey);
    const patch = patchImageMove(moduleIndex, fromChunkIndex, fromImageIndex, chunkIndex, imageIndex, image);
    const logPatchFromChunk = patchUpdateBinderLog(binder, fromChunkIndex);
    const logPatchToChunk = patchUpdateBinderLog(binder, chunkIndex);
    const metaPatch = patchAllTextMetaTimestamps(binder);
    const patches = [patch, logPatchFromChunk, logPatchToChunk, metaPatch];
    return mergePatches(patches);
};

export const removeImage = (binder, moduleKey, fromChunkIndex, fromImageIndex) => {
    const moduleIndex = binder.getImagesModuleIndex(moduleKey);
    const patch = patchImageRemove(moduleIndex, fromChunkIndex, fromImageIndex);
    const logPatch = patchUpdateBinderLog(binder, fromChunkIndex);
    const metaPatch = patchAllTextMetaTimestamps(binder);
    const patches = [patch, logPatch, metaPatch];
    return mergePatches(patches);
};

export const replaceVisual = (binder, moduleKey, oldVisual, newVisual) => {
    const moduleIndex = binder.getImagesModuleIndex(moduleKey);
    const visualIndicesToReplace = binder.getVisualIndices(moduleKey, oldVisual);
    const patch = patchReplaceVisual(binder, moduleIndex, visualIndicesToReplace, oldVisual, newVisual);
    const metaPatch = patchAllTextMetaTimestamps(binder);
    return mergePatches([patch, metaPatch]);
};

export const addTranslation = (binder, textModuleKey, isoCode, caption, imageModuleKey, storyTitle) => {
    const shouldUseNewTextEditor = (binder.hasJsonTextModules() || LaunchDarklyFlagsStoreGetters.getLaunchDarklyFlags()[LDFlags.USE_TIP_TAP]) ?? false;
    const patch = patchAddTranslation(binder, textModuleKey, isoCode, caption, imageModuleKey, storyTitle, shouldUseNewTextEditor);
    return patch;
};

export const getMergeChunksPatch = (binder, chunkIndex) => {
    const shouldUseNewTextEditor = (binder.hasJsonTextModules() || LaunchDarklyFlagsStoreGetters.getLaunchDarklyFlags()[LDFlags.USE_TIP_TAP]) ?? false;
    return patchMergeChunks(binder, chunkIndex, shouldUseNewTextEditor);
}

export function saveActiveBinder(activeBinder) {
    dispatch({ type: ACTION_LIFT_ACTIVE_BINDER, body: activeBinder });
}

export const getUpdateLanguageOrderPatch = (binder, languageCodes) => {
    const languageIndices = languageCodes.map(isoCode => binder.getLanguageIndex(isoCode));
    const patch = languageIndices.reduce((patchSoFar, languageIndex, index) => {
        patchSoFar.languages[languageIndex] = {
            $merge: {
                priority: index
            }
        }
        return patchSoFar;
    }, { languages: {} });
    return patch;
}

export const updateLanguageOrder = (binder, languageCodes) => {
    const patch = getUpdateLanguageOrderPatch(binder, languageCodes);
    return patch;
};

export const deleteTranslation = (binder, languageCode) => {
    const patch = getDeleteTranslationPatch(binder, languageCode);
    return patch;
};

export const getDeleteTranslationPatch = (binder, languageCode) => {
    const metaModuleIndex = binder.getMetaModuleIndexByLanguageCode(languageCode);
    return patchMetaModuleIsDeleted(metaModuleIndex, true);
}

export const updateMetaPDFExportOptions = (binder, languageCode, pdfExportOptions) => {
    const metaModuleIndex = binder.getMetaModuleIndexByLanguageCode(languageCode);
    const patch = patchMetaPDFExportOptions(metaModuleIndex, pdfExportOptions);
    const updatedBinder = updateBinder(binder, () => [patch], true);
    saveActiveBinder(updatedBinder);
    dispatch({ type: KEY_BINDER_IS_DIRTY });
    return patch;
}

const getRepositionChunksPatches = (binder, chunkIndex1, chunkIndex2) => {
    const shouldUseNewTextEditor = (binder.hasJsonTextModules() || LaunchDarklyFlagsStoreGetters.getLaunchDarklyFlags()[LDFlags.USE_TIP_TAP]) ?? false;
    return patchRepositionChunks(binder, chunkIndex1, chunkIndex2, shouldUseNewTextEditor);
}


export const repositionChunks = (chunkIndexFrom, chunkIndexTo) => {
    return (binder) => {
        const repositionPatches = getRepositionChunksPatches(binder, chunkIndexFrom, chunkIndexTo);
        const metaPatch = patchAllTextMetaTimestamps(binder);
        return [...repositionPatches, metaPatch];
    }
}

export const getRelabelLanguageCode = (binder, fromLanguageCode, toLanguageCode) => {
    const langIndexInLanguages = binder.getLanguageIndex(fromLanguageCode);
    const langIndexInMeta = binder.getMetaModuleIndexByLanguageCode(fromLanguageCode);
    return patchRelabelLanguageCode(langIndexInLanguages, langIndexInMeta, toLanguageCode);
};
