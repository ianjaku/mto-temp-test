import {
    IBinderVisual,
    IChecklistConfig,
    IChunkApproval
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    addCheckableItem,
    addImage,
    getMergeChunksPatch,
    getRelabelLanguageCode,
    resetThumbnail as getResetThumbnailPatch,
    moveImage,
    addTranslation as patchAddTranslation,
    removeImage,
    repositionChunks
} from "../../actions/editing";
import { deleteComment, migrateCommentThreads } from "../../../bindercomments/actions";
import {
    getBinderMasterLanguage,
    visualToThumbnail
} from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import {
    getInjectChunkPatches,
    updateRichTextChunk,
    updateStoryTitle
} from "@binders/client/lib/binders/editing";
import { onSaveChecklistActivation, updateChunkApproval } from "../../actions";
import {
    patchDeleteContentModule,
    patchDeleteLanguage,
    patchDeleteLinkPairs,
    patchDeleteMetaModule,
    setThumbnailDetails
} from "@binders/client/lib/binders/patching";
import { APITranslate } from "../../../machinetranslation/api";
import Binder from "@binders/client/lib/binders/custom/class";
import { EditorState } from "draft-js";
import { ExtendedCommentThread } from "@binders/client/lib/clients/commentservice/v1/contract";
import { IModuleSet } from "../components/BinderLanguage/types";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import {
    LaunchDarklyFlagsStoreGetters
} from "@binders/ui-kit/lib/thirdparty/launchdarkly/ld-flags-store";
import RTEState from "@binders/client/lib/draftjs/state";
import { TipTapExtensions } from "../components/BinderLanguage/TextEditor/TextEditor";
import { UpdatePatch } from "tcomb";
import { generateJSON } from "@tiptap/core";
import { mergeApprovals } from "./approval";
import { omit } from "ramda";
import { patchBreadCrumbs } from "../../../browsing/actions";
import { prepareVisualForAttach } from "../../../media/helper";
import { relabelBinderLanguage } from "../components/SettingsPane/actions";


export interface IUpdateBinderOptions {
    shouldRenderEmptyChunk?: boolean;
    proposedApprovalResetChunks?: number[];
    newSelectedChunkIndex?: { index: number, isPrimary: boolean, useTimeout?: boolean };
    affectsVisuals?: boolean;
    bumpContentVersion?: boolean;
    postBinderAction?: (binder: Binder) => Promise<void>;
    postBinderSaveCallback?: () => void;
    isEmptyChunk?: boolean;
}

export interface IBinderUpdate {
    patches?: Array<(binder: Binder) => (UpdatePatch[])>;
    updateBinderOptions?: IUpdateBinderOptions;
}

export function setThumbnailFromChunkVisual(imageModuleKey: string, chunkIndex: number, visualIndex: number): IBinderUpdate {
    const patch = (binder: Binder) => {
        const visual = binder.getImagesModule(imageModuleKey).chunks[chunkIndex - 1][visualIndex];
        const thumbnail = visualToThumbnail(visual);
        return [setThumbnailDetails(binder, thumbnail)];
    };
    return {
        patches: [patch],
        updateBinderOptions: {
            proposedApprovalResetChunks: [-1],
            affectsVisuals: true,
            bumpContentVersion: true,
        },
    };
}

/** Clears out visual settings and uses default `rotation`, `fitBehaviour` and `bgColor` */
const resetVisualSettings = <T>(visual: T) => {
    return {
        ...omit(["languageCodes", "audioEnabled", "autoPlay"], visual),
        rotation: 0,
        fitBehaviour: "fit",
        bgColor: "transparent"
    };
}

export function setThumbnailFromGallery(visual: IBinderVisual): IBinderUpdate {
    const thumbnail = resetVisualSettings(visualToThumbnail(visual));
    const patch = (binder: Binder) => [setThumbnailDetails(binder, thumbnail)];
    return {
        patches: [patch],
        updateBinderOptions: {
            proposedApprovalResetChunks: [-1],
            affectsVisuals: true,
            bumpContentVersion: true,
        },
    };
}

export function detachVisual(chunkIndex: number, visualIndex: number): IBinderUpdate {
    const patch = (binder: Binder) => {
        const imageModuleKey = binder.getImagesModuleKey();
        return [removeImage(binder, imageModuleKey, chunkIndex - 1, visualIndex)];
    }
    return {
        patches: [patch],
        updateBinderOptions: {
            affectsVisuals: true,
            bumpContentVersion: true,
            proposedApprovalResetChunks: [chunkIndex - 1],
        }
    };
}

export function attachVisualFromGallery(visual: IBinderVisual, imageModuleKey: string, toChunkIndex: number, toVisualIndex: number): IBinderUpdate {
    const visualToAttach = resetVisualSettings(prepareVisualForAttach(visual));
    const patch = (binder: Binder) => [addImage(binder, imageModuleKey, toChunkIndex - 1, toVisualIndex, visualToAttach)];
    return {
        patches: [patch],
        updateBinderOptions: {
            affectsVisuals: true,
            bumpContentVersion: true,
            proposedApprovalResetChunks: [toChunkIndex - 1],
        }
    };
}

export function attachVisualFromThumbnail(imageModuleKey: string, toChunkIndex: number, toVisualIndex: number): IBinderUpdate {
    const patch = (binder: Binder) => {
        const thumbnail = binder.getThumbnail();
        if (!thumbnail || !thumbnail.medium) {
            throw new Error("No thumbnail to move");
        }
        const urlParts = thumbnail.medium.split("/");
        const visualId = urlParts[urlParts.length - 1].split("?")[0];
        const visualToAttach = {
            id: visualId,
            url: thumbnail.medium,
            bgColor: thumbnail.bgColor,
            fitBehaviour: thumbnail.fitBehaviour,
            rotation: thumbnail.rotation,
        };
        return [addImage(binder, imageModuleKey, toChunkIndex - 1, toVisualIndex, visualToAttach)];
    };
    return {
        patches: [patch],
        updateBinderOptions: {
            affectsVisuals: true,
            bumpContentVersion: true,
            proposedApprovalResetChunks: [toChunkIndex - 1],
        }
    };
}

export function moveVisual(
    imageModuleKey: string,
    fromChunkIndex: number,
    fromVisualIndex: number,
    toChunkIndex: number,
    toVisualIndex: number
): IBinderUpdate {
    const patch = (binder: Binder) => {
        const visual = binder.getImagesModule(imageModuleKey).chunks[fromChunkIndex - 1][fromVisualIndex];
        return [ moveImage(binder, imageModuleKey, fromChunkIndex - 1, fromVisualIndex, toChunkIndex - 1, toVisualIndex, visual) ];
    };
    return {
        patches: [patch],
        updateBinderOptions: {
            affectsVisuals: true,
            bumpContentVersion: true,
            proposedApprovalResetChunks: [fromChunkIndex - 1, toChunkIndex - 1],
        }
    };
}

export function resetThumbnail(): IBinderUpdate {
    const patch = (binder: Binder) => [getResetThumbnailPatch(binder)];
    return {
        patches: [patch],
        updateBinderOptions: {
            affectsVisuals: true,
            bumpContentVersion: true,
            proposedApprovalResetChunks: [-1],
        }
    };
}

export function setTitle(title: string, languageCode: string): IBinderUpdate {
    const bumpContentVersion = false;
    const patch = (binder: Binder) => [updateStoryTitle(binder, languageCode, title)];
    return {
        patches: [patch],
        updateBinderOptions: {
            bumpContentVersion,
            postBinderAction: async (binder) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if (getBinderMasterLanguage(binder as any).iso639_1 === languageCode) {
                    patchBreadCrumbs(binder["id"], languageCode, title);
                }
            }
        },
    };
}

export function setChunkText(
    editorState: EditorState,
    json: string | undefined,
    chunkHtml: string | undefined,
    metaKey: string,
    chunkIndex: number,
    bumpContentVersion?: boolean,
    postBinderAction?: (binder: Binder) => Promise<void>
): IBinderUpdate {

    let html;

    if (!chunkHtml) {
        // setChunkText was called via draft.js editor, get html from incoming editorState
        const rawHtml = RTEState.toHTML(editorState);
        html = rawHtml.split(/(\r?\n){2,2}/);
        html = html.filter((p, i) => i === html.length - 1 || p.trim().length > 0);
    } else {
        html = [chunkHtml];
    }

    const patch = (binder: Binder) => updateRichTextChunk(binder, metaKey, chunkIndex, html, editorState, json);
    return {
        patches: [patch],
        updateBinderOptions: {
            bumpContentVersion,
            postBinderAction,
        },
    };
}

export function doRepositionChunks(chunkIndexFrom: number, chunkIndexTo: number): IBinderUpdate {
    if (chunkIndexFrom === chunkIndexTo) {
        return {
            patches: [],
        }
    }
    const patch = repositionChunks(chunkIndexFrom, chunkIndexTo);

    const updateBinderOptions = {
        newSelectedChunkIndex: { index: (chunkIndexTo + 1), isPrimary: true, useTimeout: true },
        bumpContentVersion: true,
    };

    return {
        patches: [patch],
        updateBinderOptions,
    }
}

export function relabelBinderLanguageUpdate(fromLanguageCode: string, toLanguageCode: string): IBinderUpdate {
    const deletePatches = (binder: Binder) => {
        const patches: UpdatePatch[] = [];
        const currentMetaModuleIndex = binder.getMetaModuleIndexByLanguageCode(toLanguageCode);
        const currentMetaModule = binder.getMetaModuleByIndex(currentMetaModuleIndex);
        if (currentMetaModule?.isDeleted) {
            const key = currentMetaModule.key;
            patches.push(patchDeleteMetaModule(currentMetaModuleIndex));
            patches.push(patchDeleteContentModule("text", binder.getTextModuleIndex(key)));
            patches.push(patchDeleteLanguage(binder.getLanguageIndex(toLanguageCode)));
            patches.push(patchDeleteLinkPairs(binder.getLinkIndexesContainingKey(key)["index-pairs"]));
            const imagesModuleIndex = binder.getImagesModuleIndex(key);
            if (imagesModuleIndex >= 0) {
                patches.push(patchDeleteContentModule("images", imagesModuleIndex));
            }
        }
        return patches;
    };

    const relabelPatches = (binder: Binder) => [
        getRelabelLanguageCode(binder, fromLanguageCode, toLanguageCode),
    ];

    return {
        patches: [deletePatches, relabelPatches],
        updateBinderOptions: {
            bumpContentVersion: true,
            postBinderAction: async (binder: Binder) => {
                await relabelBinderLanguage(binder.id, fromLanguageCode, toLanguageCode);
            }
        }
    };
}

export function addTranslation(textModuleKey: string, languageCode: string, caption: string, imageModuleKey: string, storyTitle: string): IBinderUpdate {
    const patch = (binder: Binder) => [patchAddTranslation(binder, textModuleKey, languageCode, caption, imageModuleKey, storyTitle)];
    return {
        patches: [patch],
        updateBinderOptions: {
            bumpContentVersion: true,
        }
    };
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types,@typescript-eslint/no-explicit-any
export function replaceVisualInComposer(patch: any, affectedChunkIndices: number[]): IBinderUpdate {
    return {
        patches: [patch],
        updateBinderOptions: {
            newSelectedChunkIndex: { index: -1, isPrimary: true },
            affectsVisuals: true,
            bumpContentVersion: true,
            proposedApprovalResetChunks: affectedChunkIndices,
        },
    };
}

export function injectChunk(chunkIndex: number, originalIndex: number, isSecondary?: boolean): IBinderUpdate {
    const shouldUseNewTextEditor = LaunchDarklyFlagsStoreGetters.getLaunchDarklyFlags()[LDFlags.USE_TIP_TAP];
    const patch = (binder: Binder) => getInjectChunkPatches(binder, chunkIndex, originalIndex, shouldUseNewTextEditor);
    return {
        patches: [patch],
        updateBinderOptions: {
            newSelectedChunkIndex: { index: chunkIndex + 2, isPrimary: !isSecondary },
            affectsVisuals: true,
            bumpContentVersion: true,
        }
    };
}

export async function mergeChunks(
    chunkIndex: number,
    chunkApprovals: IChunkApproval[],
    moduleSets: IModuleSet[],
    accountId: string,
    checklistConfigs: IChecklistConfig[],
    isSecondary?: boolean,
    commentsThread?: ExtendedCommentThread[]
): Promise<IBinderUpdate> {
    const patch = (binder: Binder) => [getMergeChunksPatch(binder, chunkIndex)];

    const postBinderAction = async (updatedBinder: Binder) => {
        const mergedChunkUuid = updatedBinder.getBinderLog().current[chunkIndex].uuid;

        const chunk1 = moduleSets[chunkIndex];
        const chunk2 = moduleSets[chunkIndex + 1];
        const { uuid: uuid1 } = chunk1;
        const { uuid: uuid2 } = chunk2;

        if (commentsThread && commentsThread.length > 0) {
            await maybeDeleteComments(accountId, updatedBinder.getBinderId(), uuid2, commentsThread)
        }
        await migrateCommentThreads(accountId, updatedBinder["id"], [uuid1, uuid2], mergedChunkUuid);

        const dirtyChunks = [uuid1, uuid2];
        let firstChunkIsActiveValue = undefined;
        if (checklistConfigs) {
            await Promise.all(dirtyChunks.map((id, index) => {
                const checklistConfig = checklistConfigs.find(config => config.chunkId === id);
                if (checklistConfig) {
                    if (index === 0) {
                        firstChunkIsActiveValue = checklistConfig.isActive
                    }
                    return checklistConfig.isActive && onSaveChecklistActivation(updatedBinder["id"], id, false);
                }
                return Promise.resolve()
            }));
        }

        if (firstChunkIsActiveValue === true) {
            await onSaveChecklistActivation(updatedBinder["id"], mergedChunkUuid, firstChunkIsActiveValue);
        }

        const shouldUseNewTextEditor = LaunchDarklyFlagsStoreGetters.getLaunchDarklyFlags()[LDFlags.USE_TIP_TAP] as boolean;
        const newApprovalStatuses = updatedBinder.getVisibleLanguages().map(language => {
            return {
                languageCode: language.iso639_1,
                approval: mergeApprovals(chunkApprovals, chunk1, chunk2, { shouldUseNewTextEditor }),
            }
        });
        for (const newApprovalStatus of newApprovalStatuses) {
            const { languageCode, approval } = newApprovalStatus;
            if (approval) {
                await updateChunkApproval(updatedBinder["id"], mergedChunkUuid, languageCode, approval.chunkLastUpdate, approval.approved);
            }
        }
    }

    // merge comment threads

    return {
        patches: [patch],
        updateBinderOptions: {
            newSelectedChunkIndex: { index: chunkIndex + 1, isPrimary: !isSecondary, useTimeout: true },
            affectsVisuals: true,
            bumpContentVersion: true,
            postBinderAction,
        },
    };
}

async function maybeDeleteComments(accountId: string, binderId: string, chunkId: string, commentThreads: ExtendedCommentThread[]) {
    const results = []
    commentThreads
        .filter(commentThread => commentThread.chunkId === chunkId && commentThread.binderId === binderId)
        .map(commentThread => {
            return commentThread.comments.map(comment => results.push(deleteComment(accountId, binderId, commentThread.id, comment.id)))
        }
        )
    return Promise.all(results)
}

export async function deleteChunk(
    chunkIndex: number,
    chunkApprovals: IChunkApproval[],
    moduleSets: IModuleSet[],
    accountId: string,
    checklistConfigs: IChecklistConfig[],
    commentsThread: ExtendedCommentThread[],
    isSecondary?: boolean,
): Promise<IBinderUpdate> {
    if (chunkIndex === 1) {
        return mergeChunks(0, chunkApprovals, moduleSets, accountId, checklistConfigs, isSecondary, commentsThread);
    }
    return mergeChunks(chunkIndex - 2, chunkApprovals, moduleSets, accountId, checklistConfigs, isSecondary, commentsThread);
}

export async function translate(
    accountId: string,
    htmlFrom: string,
    fromLanguageCode: string,
    toLanguageCode: string,
    toMetaKey: string,
    chunkIndex: number,
): Promise<IBinderUpdate> {
    const translatedHtml = await APITranslate(accountId, htmlFrom, fromLanguageCode, toLanguageCode, true);
    if (translatedHtml) {
        const shouldUseNewTextEditor = LaunchDarklyFlagsStoreGetters.getLaunchDarklyFlags()[LDFlags.USE_TIP_TAP] as boolean;
        let editorState, json;
        if (shouldUseNewTextEditor) {
            json = JSON.stringify(generateJSON(translatedHtml, TipTapExtensions));
        } else {
            editorState = RTEState.createFromHtml(translatedHtml);
        }
        const patch = (binder: Binder) => updateRichTextChunk(binder, toMetaKey, chunkIndex, [translatedHtml], editorState, json);
        return {
            patches: [patch],
            updateBinderOptions: {
                bumpContentVersion: true,
            }
        };
    }
    return {
        patches: [],
    }
}

export async function addChecklistItem(chunkIndex: number): Promise<IBinderUpdate> {
    const patch = (binder: Binder) => [addCheckableItem(binder, chunkIndex)]
    return Promise.resolve({
        patches: [patch],
        updateBinderOptions: {
            bumpContentVersion: true,
        },
    });
}

export async function translateTitle(
    accountId: string,
    htmlFrom: string,
    fromLanguageCode: string,
    toLanguageCode: string,
): Promise<IBinderUpdate> {
    const translatedHtml = await APITranslate(accountId, htmlFrom, fromLanguageCode, toLanguageCode, false);
    if (translatedHtml) {
        const patch = (binder: Binder) => [updateStoryTitle(binder, toLanguageCode, translatedHtml)];
        return {
            patches: [patch],
            updateBinderOptions: {
                bumpContentVersion: true,
            }
        };
    }
    return {
        patches: [],
    }
}
