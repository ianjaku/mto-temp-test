import { ChunkLoadingState, useChunkStateSetter } from "../documents/Composer/contexts/chunkStateContext";
import {
    EventBinderContextProps,
    EventBinderDiffProps,
    captureEventOptimizeChunkSucceeded,
    captureEventUndoAiFormatting,
    computeEventBinderDiffProps,
} from "./events";
import type {
    OptimizeBinderContentRequest,
    OptimizeBinderContentResponse,
    OptimizeChunkContentRequest,
    OptimizeChunkContentResponse,
} from "@binders/client/lib/clients/contentservice/v1/contract";
import { UseMutationResult, useMutation } from "@tanstack/react-query";
import { updateRichTextChunk, updateStoryTitle } from "@binders/client/lib/binders/editing";
import { Binder } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import BinderClass from "@binders/client/lib/binders/custom/class";
import { BinderMediaStoreActions } from "../media/binder-media-store";
import { ClientV2Error } from "@binders/client/lib/clients/client";
import { EditorState } from "draft-js";
import { FlashMessages } from "../logging/FlashMessages";
import { IBinderUpdate } from "../documents/Composer/helpers/binderUpdates";
import RTEState from "@binders/client/lib/draftjs/state";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { client } from "./api";
import { toPseudoXml } from "@binders/client/lib/binders/exporting";
import { useActiveAccountId } from "../accounts/hooks";
import { useBinderDiff } from "./BinderDiffProvider";
import { useBinderUpdate } from "./BinderUpdateProvider";
import { useCallback } from "react";
import { useMemo } from "react";
import { useTranslation } from "@binders/client/lib/react/i18n";

export const contentServiceName = "@binders/content-v1";

/**
 * Call optimizeChunkContent API endpoint
 */
export function useOptimizeChunk(
    props: Partial<OptimizeChunkContentRequest>,
    options?: {
        onSuccess?: (res: OptimizeChunkContentResponse, req: OptimizeChunkContentRequest) => void;
        onError?: (err: unknown) => void;
    }
): UseMutationResult<OptimizeChunkContentResponse> {
    const accountId = useActiveAccountId();
    return useMutation<OptimizeChunkContentResponse, unknown, OptimizeChunkContentRequest>(
        [contentServiceName, "modifyChunk", props.binderId, props.langIdx, props.chunkIdx],
        overrides => client.optimizeChunkContent({ accountId, ...props, ...overrides }),
        { onError: options?.onError, onSuccess: options?.onSuccess },
    )
}

/**
 * Call optimizeBinderContent API endpoint
 */
export function useOptimizeBinder(
    props: Partial<OptimizeBinderContentRequest>,
    options?: {
        onSuccess?: (res: OptimizeBinderContentResponse, req: OptimizeBinderContentRequest) => void;
        onError?: (errMsgKey: string) => void;
    }
): UseMutationResult<OptimizeBinderContentResponse> {
    const accountId = useActiveAccountId();
    const onError = useCallback((error) => {
        let errorMsgKey = TK.Edit_AiOptimizeFailedGeneral;
        if (error instanceof ClientV2Error) {
            errorMsgKey = error.toLanguageErrorMsgKey() ?? errorMsgKey;
        }
        options?.onError?.(errorMsgKey);
    }, [options]);
    return useMutation<OptimizeBinderContentResponse, unknown, OptimizeBinderContentRequest>(
        [contentServiceName, "optimizeChunkContent", props.binderId, props.langIdx],
        overrides => client.optimizeBinderContent({ accountId, ...props, ...overrides }),
        { onError, onSuccess: options?.onSuccess },
    )
}

type BinderChunkUpdateFn = (binder: Binder, langIdx: number, chunkIdx: number) => void
/**
 * Creates a callback function that updates the specified chunk, in the currently loaded Binder,
 * for the specified language.
 */
export function useBinderChunkUpdate({ updateBinder, binder: prevBinderObj }: {
    binder: BinderClass;
    updateBinder: (update: IBinderUpdate) => void;
}): BinderChunkUpdateFn {
    const patch = useBinderChunkRichTextPatch({ binder: prevBinderObj, updateBinder });
    const updateChunk = useCallback<BinderChunkUpdateFn>((newBinder, langIdx, chunkIdx) => {
        const newBinderObj = new BinderClass(newBinder);
        const languageCode = newBinderObj.getLanguageIsoByIndex(langIdx);
        if (chunkIdx === 0) {
            const title = newBinderObj.getTitle(languageCode);
            updateBinder({
                patches: [
                    binder => [updateStoryTitle(binder, languageCode, title)],
                ]
            })
        } else {
            const prevEditorState = prevBinderObj.getTextModuleEditorStateByLanguageAndChunkIndex(langIdx, chunkIdx - 1) as unknown as EditorState;
            const nextContent = RTEState.deserialize(newBinderObj.getTextModuleEditorStateByLanguageAndChunkIndex(langIdx, chunkIdx - 1)).getCurrentContent();
            const nextState = EditorState.push(prevEditorState, nextContent, "insert-fragment");
            patch(langIdx, chunkIdx, nextState);
        }
    }, [prevBinderObj, patch, updateBinder])
    return updateChunk;
}

type BinderContentUpdateFn = (binder: BinderClass, langIdx: number) => void
/**
 * Creates a callback function that updates the content of all chunks in the currently loaded Binder 
 * for the specified language, using the chunks from the given (updated) Binder.
 */
export function useBinderContentUpdate(): BinderContentUpdateFn {
    const { binder: prevBinderObj } = useBinderUpdate();
    const patch = useBinderRichTextPatch();
    const updateBinderContent = useCallback<BinderContentUpdateFn>((newBinderObj, langIdx) => {
        const chunksCount = newBinderObj.getBinderLog().current.length;
        const nextStates: EditorState[] = [];
        for (const chunkIdx of Array(chunksCount).keys()) {
            const prevEditorState = prevBinderObj.getTextModuleEditorStateByLanguageAndChunkIndex(langIdx, chunkIdx) as unknown as EditorState;
            const nextEditorState = newBinderObj.getTextModuleEditorStateByLanguageAndChunkIndex(langIdx, chunkIdx) as unknown as EditorState;
            if (!nextEditorState) continue
            const nextContent = nextEditorState.getCurrentContent();
            const nextState = EditorState.push(prevEditorState, nextContent, "insert-fragment");
            nextStates.push(nextState);
        }
        patch(langIdx, nextStates);
    }, [prevBinderObj, patch])
    return updateBinderContent;
}

type BinderChunkUndoFn = (langIdx: number, chunkIdx: number) => void
/**
 * Creates a callback function that undoes changes for a specific chunk in a specified language
 * in the currently loaded Binder.
 */
export function useBinderChunkUndo({ binder: binderObj, updateBinder }: {
    binder: BinderClass;
    updateBinder: (update: IBinderUpdate) => void;
}): BinderChunkUndoFn {
    const patch = useBinderChunkRichTextPatch({ binder: binderObj, updateBinder });
    const undo = useCallback<BinderChunkUndoFn>((langIdx, chunkIdx) => {
        const prevEditorState = binderObj.getTextModuleEditorStateByLanguageAndChunkIndex(langIdx, chunkIdx - 1) as unknown as EditorState;
        const nextState = EditorState.undo(prevEditorState);
        patch(langIdx, chunkIdx, nextState);
    }, [binderObj, patch]);
    return undo;
}

type BinderChunkRichTextPatchFn = (langIdx: number, chunkIdx: number, nextState: EditorState) => void
/**
 * Creates a callback function that applies an `EditorState` update for a specific chunk in a specified language
 * in the currently loaded Binder.
 */
export function useBinderChunkRichTextPatch({ updateBinder, binder: binderObj }: {
    binder: BinderClass;
    updateBinder: (update: IBinderUpdate) => void;
}): BinderChunkRichTextPatchFn {
    const patchFn = useCallback<BinderChunkRichTextPatchFn>((langIdx, chunkIdx, nextState) => {
        const nextChunks = RTEState.toHTML(nextState);
        updateBinder({
            patches: [
                binder => updateRichTextChunk(
                    binder,
                    binderObj.getFirstTextModuleKeyByLanguageIndex(langIdx),
                    chunkIdx - 1,
                    [nextChunks],
                    nextState,
                ),
            ],
            updateBinderOptions: {
                newSelectedChunkIndex: { index: chunkIdx, isPrimary: true },
                bumpContentVersion: true,
            },
        });
    }, [binderObj, updateBinder]);
    return patchFn;
}

type BinderRichTextPatchFn = (langIdx: number, nextStates: EditorState[]) => void
/**
 * Creates a callback function that applies a list of `EditorState` updates to all chunks in a specified language
 * in the currently loaded Binder.
 */
export function useBinderRichTextPatch(): BinderRichTextPatchFn {
    const { updateBinder, binder: binderObj } = useBinderUpdate();
    const patchFn = useCallback<BinderRichTextPatchFn>((langIdx, nextStates) => {
        updateBinder({
            patches: nextStates.map(
                (nextState, chunkIdx) =>
                    (binder: BinderClass) => updateRichTextChunk(
                        binder,
                        binderObj.getFirstTextModuleKeyByLanguageIndex(langIdx),
                        chunkIdx,
                        [RTEState.toHTML(nextState)],
                        nextState,
                    )
            ),
            updateBinderOptions: {
                bumpContentVersion: true,
            },
        });
    }, [binderObj, updateBinder]);
    return patchFn;
}

export function useChunkAiOptimization(
    binderObj: BinderClass,
    langIdx: number,
    updateBinder: (update: IBinderUpdate) => void,
): {
    apply: (chunkIdx: number) => void,
    undo: (chunkIdx: number) => void,
} {
    const { t } = useTranslation();
    const setChunkState = useChunkStateSetter();
    const accountId = useActiveAccountId();
    const binderId = binderObj?.id;
    const updateChunk = useBinderChunkUpdate({ binder: binderObj, updateBinder });
    const undoChunk = useBinderChunkUndo({ binder: binderObj, updateBinder });
    const eventBinderContextProps = useEventBinderContextProps({ binder: binderObj, langIdx });

    const onError = useCallback((chunkIdx: number) => {
        setChunkState(chunkIdx, {
            hasAiFormattingState: false,
            isReadOnly: false,
            loadingState: ChunkLoadingState.Loaded,
        });
        FlashMessages.error(t(TK.Edit_AiOptimizeFailedGeneral));
    }, [setChunkState, t])

    const onSuccess = useCallback(
        ({ binder }: OptimizeChunkContentResponse, { chunkIdx }: OptimizeChunkContentRequest) => {
            updateChunk(binder, langIdx, chunkIdx);
            setChunkState(chunkIdx, {
                hasAiFormattingState: true,
                isReadOnly: false,
                loadingState: ChunkLoadingState.Loaded,
            });
            const nextBinderObj = new BinderClass(binder);
            captureEventOptimizeChunkSucceeded({
                ...eventBinderContextProps,
                ...computeEventBinderDiffProps(binderObj, nextBinderObj, { langIdx, chunkIdx }),
                chunkIdx,
            });
        },
        [binderObj, eventBinderContextProps, langIdx, setChunkState, updateChunk],
    );

    const modifyChunk = useOptimizeChunk({
        binderId,
        langIdx,
        accountId,
    }, { onError, onSuccess });

    const doModifyChunk = useCallback(
        (chunkIdx: number) => {
            setChunkState(chunkIdx, {
                hasAiFormattingState: false,
                isReadOnly: true,
                loadingState: ChunkLoadingState.Loading,
            });
            modifyChunk.mutate({
                binderId,
                langIdx,
                chunkIdx,
                accountId,
                save: false,
            });
        },
        [accountId, binderId, langIdx, modifyChunk, setChunkState],
    );

    const doUndo = useCallback(
        (chunkIdx: number) => {
            undoChunk(langIdx, chunkIdx);
            setChunkState(chunkIdx, {
                hasAiFormattingState: false,
                isReadOnly: false,
                loadingState: ChunkLoadingState.Loaded,
            });
            captureEventUndoAiFormatting({
                ...eventBinderContextProps,
                ...computeEventBinderDiffProps(undefined, binderObj, { langIdx, chunkIdx }),
            });
        },
        [binderObj, eventBinderContextProps, langIdx, setChunkState, undoChunk],
    );

    return {
        apply: doModifyChunk,
        undo: doUndo,
    };
}

export function useEventBinderDiffProps(props: { langIdx: number; }): EventBinderDiffProps {
    const { langIdx } = props;
    const { binderDiffStateMap } = useBinderDiff();
    return useMemo(() => {
        const states = Object.values(binderDiffStateMap?.[langIdx] ?? {});
        return {
            acceptedChunksCount: states.filter(s => s === "NoDiff_Changed").length,
            rejectedChunksCount: states.filter(s => s === "NoDiff_Original").length,
            undecidedChunksCount: states.filter(s => s === "Diff").length,
        }
    }, [binderDiffStateMap, langIdx])
}

export function useEventBinderContextProps(props: {
    binder: BinderClass | undefined;
    langIdx: number;
}): EventBinderContextProps {
    const { binder, langIdx } = props;
    return useMemo<EventBinderContextProps>(() => ({
        binderId: binder?.id,
        binderTextLength: binder && toPseudoXml(binder, langIdx).length,
        chunksCount: binder?.getBinderLog().current.length ?? 0,
        languageCode: binder?.getLanguageIsoByIndex(langIdx),
    }), [binder, langIdx]);
}

export type UpdateVisualTrimSettingsRequest = {
    accountId: string,
    binderId: string,
    visualIdx: number,
    chunkIdx: number,
    startTimeMs: number,
    endTimeMs: number,
}

/**
 * Call updateVisualTrimSettings API endpoint
 */
export function useUpdateVisualTrimSettings(
    props: Partial<UpdateVisualTrimSettingsRequest>,
    options?: {
        onSuccess?: (res: Binder, req: UpdateVisualTrimSettingsRequest) => void;
        onError?: (err: unknown) => void;
    }
): UseMutationResult<Binder> {
    return useMutation<Binder, unknown, UpdateVisualTrimSettingsRequest>(
        [contentServiceName, "updateVisualTrimSettings", props.binderId, props.visualIdx, props.chunkIdx],
        async (overrides) => {
            const chunkIdx = overrides.chunkIdx ?? props.chunkIdx;
            const startTimeMs = overrides.startTimeMs ?? props.startTimeMs;
            const endTimeMs = overrides.endTimeMs ?? props.endTimeMs;
            const res = await client.updateVisualTrimSettings(
                overrides.accountId ?? props.accountId,
                overrides.binderId ?? props.binderId,
                overrides.visualIdx ?? props.visualIdx,
                chunkIdx,
                startTimeMs,
                endTimeMs,
            );
            return res;
        },
        {
            onError: options?.onError,
            onSuccess: (res, req) => {
                BinderMediaStoreActions.updateVisualTrim(
                    req.chunkIdx,
                    req.visualIdx,
                    { startTimeMs: req.startTimeMs, endTimeMs: req.endTimeMs },
                );
                options?.onSuccess?.(res, req)

            },
        },
    )
}

