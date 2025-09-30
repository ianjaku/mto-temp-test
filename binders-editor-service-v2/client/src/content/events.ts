import { EditorEvent, captureFrontendEvent } from "@binders/client/lib/thirdparty/tracking/capture";
import BinderClass from "@binders/client/lib/binders/custom/class";
import RTEState from "@binders/client/lib/draftjs/state";
import { safeEditorStateOrNull } from "@binders/client/lib/binders/exporting";

export type EventBinderContextProps = {
    binderId: string;
    binderTextLength: number;
    chunksCount: number;
    languageCode: string;
}

export type EventBinderOptimizationProps = {
    chunkIdx?: number;
    optimizedContent?: string;
    originalContent?: string;
}

export type EventBinderDiffProps = {
    acceptedChunksCount: number;
    rejectedChunksCount: number;
    undecidedChunksCount: number;
}

export function captureEventApplyAiFormattingContextMenuClicked(props: EventBinderContextProps & EventBinderOptimizationProps): void {
    captureFrontendEvent(EditorEvent.AiChunkOptimizationContextMenuClicked, props);
}

export function captureEventOptimizeChunkSucceeded(props: EventBinderContextProps & EventBinderOptimizationProps): void {
    captureFrontendEvent(EditorEvent.AiChunkOptimizationApplied, props);
}

export function captureEventDiffAccept(props: EventBinderContextProps & EventBinderDiffProps): void {
    captureFrontendEvent(EditorEvent.BinderDiffAcceptChunkClicked, props);
}

export function captureEventDiffAcceptAll(props: EventBinderContextProps & EventBinderDiffProps): void {
    captureFrontendEvent(EditorEvent.BinderDiffAcceptAllClicked, props);
}

export function captureEventDiffCancel(props: EventBinderContextProps): void {
    captureFrontendEvent(EditorEvent.BinderDiffCancelClicked, props);
}

export function captureEventDiffConfirm(props: EventBinderContextProps & EventBinderDiffProps): void {
    captureFrontendEvent(EditorEvent.BinderDiffConfirmClicked, props);
}

export function captureEventDiffReject(props: EventBinderContextProps & EventBinderDiffProps): void {
    captureFrontendEvent(EditorEvent.BinderDiffRejectChunkClicked, props);
}

export function captureEventDiffRetry(props: EventBinderContextProps & EventBinderDiffProps): void {
    captureFrontendEvent(EditorEvent.BinderDiffRetryChunkClicked, props);
}

export function captureEventOptimizeBinderButtonClicked(props: EventBinderContextProps & EventBinderOptimizationProps): void {
    captureFrontendEvent(EditorEvent.AiBinderOptimizationButtonClicked, props);
}

export function captureEventOptimizeBinderButtonClickedAgain(props: EventBinderContextProps & EventBinderOptimizationProps & EventBinderDiffProps): void {
    captureFrontendEvent(EditorEvent.AiBinderOptimizationButtonClickedAgain, props);
}

export function captureEventOptimizeBinderCancelled(props: EventBinderContextProps & EventBinderOptimizationProps): void {
    captureFrontendEvent(EditorEvent.AiBinderOptimizationCancelled, props);
}

export function captureEventOptimizeBinderFailed(props: EventBinderContextProps & EventBinderOptimizationProps): void {
    captureFrontendEvent(EditorEvent.AiBinderOptimizationFailed, props);
}

export function captureEventOptimizeBinderStarted(props: EventBinderContextProps & EventBinderOptimizationProps): void {
    captureFrontendEvent(EditorEvent.AiBinderOptimizationStarted, props);
}

export function captureEventUndoAiFormatting(props: EventBinderContextProps & EventBinderOptimizationProps): void {
    captureFrontendEvent(EditorEvent.AiChunkOptimizationUndone, props);
}

export function computeEventBinderDiffProps(
    binderObj: BinderClass,
    nextBinderObj: BinderClass | undefined,
    options: { langIdx: number, chunkIdx: number },
): EventBinderOptimizationProps {
    const originalContent = binderObj ?
        RTEState.toMarkdown(safeEditorStateOrNull(binderObj.getTextModuleEditorStateByLanguageAndChunkIndex(options.langIdx, options.chunkIdx - 1))) :
        undefined;
    const optimizedContent = nextBinderObj ?
        RTEState.toMarkdown(safeEditorStateOrNull(nextBinderObj.getTextModuleEditorStateByLanguageAndChunkIndex(options.langIdx, options.chunkIdx - 1))) :
        undefined;
    return {
        chunkIdx: options.chunkIdx,
        originalContent,
        optimizedContent,
    }
}

