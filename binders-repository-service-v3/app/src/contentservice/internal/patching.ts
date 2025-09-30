import type { Binder, IBinderVisual } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    mergePatches,
    patchAllTextMetaTimestamps,
} from "@binders/client/lib/binders/patching";
import BinderClass from "@binders/client/lib/binders/custom/class";
import { Visual } from "@binders/client/lib/clients/imageservice/v1/contract";
import { pick } from "ramda";

export function attachVisual(
    visual: Visual,
    imageModuleKey: string,
    toChunkIndex: number,
    toVisualIndex: number
): IBinderUpdate {
    const visualToAttach = prepareVisualForAttach(visual);
    const patch = (binder: BinderClass) => [
        addImage(binder, imageModuleKey, toChunkIndex, toVisualIndex, visualToAttach) // Note: different from editor version of this function (toChunkIndex - 1 there)
    ];
    return {
        patches: [patch],
        updateBinderOptions: {
            affectsVisuals: true,
            bumpContentVersion: true,
            proposedApprovalResetChunks: [toChunkIndex], // Note: different from editor version of this function (toChunkIndex - 1 there)
        }
    };
}

export function updateVisualDataPatch(
    visual: IBinderVisual,
    imageModuleKey: string,
    chunkIndex: number,
    imageIndex: number,
): IBinderUpdate {
    const patch = (binder: BinderClass) => {
        const moduleIndex = binder.getImagesModuleIndex(imageModuleKey);
        const patch = chunkedImagesModulePatchBase();
        (patch.modules.images.chunked[moduleIndex] = {
            chunks: {
                [chunkIndex]: {
                    [imageIndex]: { $set: visual }
                }
            }
        });
        const metaPatch = patchAllTextMetaTimestamps(binder);
        const patches = [patch, metaPatch];
        return mergePatches(patches);
    };
    return {
        patches: [patch],
        updateBinderOptions: {
            affectsVisuals: true,
            bumpContentVersion: true,
            proposedApprovalResetChunks: [chunkIndex],
        }
    };
}

const prepareVisualForAttach = (visual: Visual): Record<string, unknown> => {
    return {
        ...pick(
            [
                "id",
                "fitBehaviour",
                "bgColor",
                "languageCodes",
                "audioEnabled",
                "autoPlay",
                "rotation",
                "startTimeMs",
                "endTimeMs",
            ],
            visual
        ),
        url: visual.urls["bare"], // Note: different from editor version of this function
    };
}

const addImage = (binder, moduleKey, chunkIndex, imageIndex, image) => {
    const moduleIndex = binder.getImagesModuleIndex(moduleKey);
    const patch = patchImageIntoPosition(moduleIndex, chunkIndex, imageIndex, image);
    const metaPatch = patchAllTextMetaTimestamps(binder);
    const patches = [patch, metaPatch];
    return mergePatches(patches);
};

interface IUpdateBinderOptions {
    shouldRenderEmptyChunk?: boolean;
    proposedApprovalResetChunks?: number[];
    newSelectedChunkIndex?: { index: number, isPrimary: boolean, useTimeout?: boolean };
    affectsVisuals?: boolean;
    bumpContentVersion?: boolean;
    postBinderAction?: (binder: Binder) => Promise<void>;
    postBinderSaveCallback?: () => void;
    isEmptyChunk?: boolean;
}

interface IBinderUpdate {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    patches?: Array<(binder: BinderClass) => (any[])>;
    updateBinderOptions?: IUpdateBinderOptions;
}

const chunkedImagesModulePatchBase = () => ({
    modules: {
        images: {
            chunked: {}
        }
    }
});

const patchImageIntoPosition = (moduleIndex, chunkIndex, imageIndex, image) => {
    const patch = chunkedImagesModulePatchBase();
    const moduleData = (patch.modules.images.chunked[moduleIndex] = {
        chunks: {}
    });
    moduleData.chunks[chunkIndex] = {
        $splice: [[imageIndex, 0, image]]
    };
    return patch;
};
