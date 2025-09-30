import {
    ApprovedStatus,
    IChunkApproval
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { DragStart, DropResult } from "react-beautiful-dnd";
import {
    attachVisualFromGallery,
    attachVisualFromThumbnail,
    detachVisual,
    doRepositionChunks,
    injectChunk,
    moveVisual,
    resetThumbnail,
    setThumbnailFromChunkVisual,
    setThumbnailFromGallery
} from "./binderUpdates";
import { findApproval, getBinderLogEntry } from "./approvalHelper";
import Binder from "@binders/client/lib/binders/custom/class";
import { BinderMediaStoreActions } from "../../../media/binder-media-store";
import BinderStore from "../../store";
import { IBinderUpdate } from "./binderUpdates";
import { VIDEO_THUMBNAIL_ERROR } from "@binders/client/lib/clients/imageservice/v1/errorHandlers";
import { WebDataState } from "@binders/client/lib/webdata";
import { isVideoId } from "@binders/client/lib/clients/imageservice/v1/visuals";
import { updateChunkApproval } from "../../actions";

export interface IDragInfo {
    from: string;
    to: string;
    chunkIndexOfDraggingVisual: string;
    chunkIndexOfDraggingChunk: string;
    dragOperation: number;
}

export interface IDraggingInfo {
    isDragging: boolean;
    draggingFrom?: string;
    chunkIndexOfDraggingVisual?: number;
    chunkIndexOfDraggingChunk?: number;
    direction?: "horizontal" | "vertical";
}

export const DragOperation = {
    galleryToThumbnail: 0,
    chunkToThumbnail: 1,
    galleryToChunk: 2,
    chunkToChunk: 3,
    thumbnailToChunk: 4,
    chunkReorder: 5,
    toEmptyChunk: 6,
}

export function handleDrag(dragStart: DragStart): void {
    const { draggableId, source } = dragStart;
    const { droppableId } = source;
    const { from, chunkIndexOfDraggingVisual, chunkIndexOfDraggingChunk } = getDragInfo(draggableId, "", droppableId);
    BinderMediaStoreActions.setDraggingInfo({
        isDragging: true,
        draggingFrom: from,
        chunkIndexOfDraggingVisual: chunkIndexOfDraggingVisual && parseInt(chunkIndexOfDraggingVisual, 10),
        chunkIndexOfDraggingChunk: chunkIndexOfDraggingChunk && parseInt(chunkIndexOfDraggingChunk, 10),
    });
}

export function handleDrop(
    binder: Binder,
    dropResult: DropResult,
): IBinderUpdate {
    const { draggableId, source, destination } = dropResult;
    if (!destination) {
        BinderMediaStoreActions.setDraggingInfo({ isDragging: false });
        return;
    }
    const { droppableId: destinationDroppableId, index: toVisualIndex } = destination;
    const { droppableId: sourceDroppableId } = source;
    const chunkCount = binder.getModules().text.chunked[0].chunks.length;
    const { dragOperation } = getDragInfo(
        draggableId,
        destinationDroppableId,
        sourceDroppableId,
    );

    const imageModuleKey = binder.getImagesModuleKey();

    function chooseDragDropOperation(dragOperation: number, updatedBinder?: Binder, chunkIndex?: number) {
        switch (dragOperation) {
            case DragOperation.galleryToThumbnail:
                return handleGalleryToThumbDrop();
            case DragOperation.chunkToThumbnail:
                return handleChunkToThumbDrop();
            case DragOperation.galleryToChunk:
                return handleGalleryToChunkDrop(chunkIndex);
            case DragOperation.chunkToChunk:
                return handleChunkToChunkDrop(chunkIndex);
            case DragOperation.thumbnailToChunk:
                return handleThumbnailToChunkDrop(chunkIndex);
            case DragOperation.chunkReorder:
                return handleChunkReorderDrop();
            case DragOperation.toEmptyChunk:
                return handleToEmptyChunkDrop(sourceDroppableId);
            default:
                return;
        }
    }

    function handleGalleryToThumbDrop(): IBinderUpdate {
        const visualId = draggableId.replace("in-gallery-", "");
        if (isVideoId(visualId)) {
            throw new Error(VIDEO_THUMBNAIL_ERROR);
        }
        const visual = BinderMediaStoreActions.getVisual(visualId);
        return setThumbnailFromGallery(visual);
    }

    function handleChunkToThumbDrop(): IBinderUpdate {
        const visualId = draggableId.split(",")[0].replace("in-document-", "");
        if (isVideoId(visualId)) {
            throw new Error(VIDEO_THUMBNAIL_ERROR);
        }
        const [, chunkIndexStr, visualIndexStr] = draggableId.split(",");
        const chunkIndex = parseInt(chunkIndexStr, 10);
        const visualIndex = parseInt(visualIndexStr, 10);
        const { patches: setThumbnailPatches } = setThumbnailFromChunkVisual(imageModuleKey, chunkIndex, visualIndex);
        const { patches: detachVisualPatches } = detachVisual(chunkIndex, visualIndex);
        return {
            patches: [...setThumbnailPatches, ...detachVisualPatches],
            updateBinderOptions: {
                affectsVisuals: true,
                bumpContentVersion: true,
                proposedApprovalResetChunks: [-1, chunkIndex - 1],
            }
        };
    }

    function handleGalleryToChunkDrop(index: number): IBinderUpdate {
        const visualId = draggableId.replace("in-gallery-", "");
        const visual = BinderMediaStoreActions.getVisual(visualId);
        const toChunkIndex = index || parseInt(destinationDroppableId.replace("chunk-images-droppable-", ""), 10);
        return attachVisualFromGallery(visual, imageModuleKey, toChunkIndex, toVisualIndex);
    }


    function handleToEmptyChunkDrop(sourceDroppableId): IBinderUpdate {
        const toChunkIndex = chunkCount;
        const injectedChunkBinderUpdate = injectChunk(toChunkIndex - 1, toChunkIndex, true);
        const { from, chunkIndexOfDraggingVisual } = getDragInfo(draggableId, "", sourceDroppableId)
        const fromOptions = ToChunkFromOptions[from];
        const attachVisualUpdate = chooseDragDropOperation(fromOptions, undefined, toChunkIndex + 1);

        return {
            patches: [
                ...injectedChunkBinderUpdate.patches,
                ...attachVisualUpdate.patches,
            ],
            updateBinderOptions: {
                affectsVisuals: true,
                bumpContentVersion: true,
                proposedApprovalResetChunks: [
                    ...(chunkIndexOfDraggingVisual !== undefined ? [parseInt(chunkIndexOfDraggingVisual, 10) - 1] : []),
                    toChunkIndex
                ],
            }
        };
    }

    function handleChunkToChunkDrop(index: number): IBinderUpdate {
        const [_, fromChunkIndexStr, fromVisualIndexStr] = draggableId.split(",");
        const fromChunkIndex = parseInt(fromChunkIndexStr, 10);
        const fromVisualIndex = parseInt(fromVisualIndexStr, 10);
        const toChunkIndex = index || parseInt(destinationDroppableId.replace("chunk-images-droppable-", ""), 10);
        if (fromChunkIndex === toChunkIndex && fromVisualIndex === toVisualIndex) {
            return;
        }
        BinderMediaStoreActions.moveVisualTrim(fromChunkIndex, fromVisualIndex, toChunkIndex, toVisualIndex);
        return moveVisual(imageModuleKey, fromChunkIndex, fromVisualIndex, toChunkIndex, toVisualIndex);
    }

    function handleThumbnailToChunkDrop(index: number): IBinderUpdate {
        const toChunkIndex = index || parseInt(destinationDroppableId.replace("chunk-images-droppable-", ""), 10);
        const { patches: attachVisualPatches } = attachVisualFromThumbnail(imageModuleKey, toChunkIndex, toVisualIndex);
        const { patches: resetThumbnailPatches } = resetThumbnail();
        return {
            patches: [...attachVisualPatches, ...resetThumbnailPatches],
            updateBinderOptions: {
                affectsVisuals: true,
                bumpContentVersion: true,
                proposedApprovalResetChunks: [-1, toChunkIndex - 1],
            }
        };
    }

    function handleChunkReorderDrop(): IBinderUpdate {
        const fromIndex = source.index;
        const toIndex = destination.index;
        if (fromIndex !== toIndex) {
            const chunkApprovalsWD = BinderStore.getChunkApprovals();
            if (chunkApprovalsWD.state === WebDataState.SUCCESS) {
                const chunkApprovals = chunkApprovalsWD.data;
                resetApprovalsOnReorder(fromIndex, chunkApprovals);
                resetApprovalsOnReorder(toIndex, chunkApprovals);
            }
        }
        return doRepositionChunks(fromIndex, toIndex);
    }

    function resetApprovalsOnReorder(chunkIndex: number, chunkApprovals: IChunkApproval[]) {
        const binderObj = binder.toJSON();
        const languages = binder.getVisibleLanguages();
        const log = chunkIndex >= 0 && getBinderLogEntry(binder, chunkIndex);
        for (const language of languages) {
            const languageCode = language.iso639_1;
            const approval = findApproval(chunkApprovals, log, languageCode, chunkIndex === -1 && binderObj.id);
            if (approval && approval.approved !== ApprovedStatus.UNKNOWN) {
                updateChunkApproval(
                    binderObj.id,
                    log ? log.uuid : binderObj.id,
                    languageCode,
                    log ? log.updatedAt : Date.now(),
                    ApprovedStatus.UNKNOWN,
                );
            }
        }
    }
    BinderMediaStoreActions.setDraggingInfo({ isDragging: false });
    return chooseDragDropOperation(dragOperation);
}

const ToChunkFromOptions = {
    "gallery": DragOperation.galleryToChunk,
    "chunk": DragOperation.chunkToChunk,
    "thumbnail": DragOperation.thumbnailToChunk,
};

const toThumbnailFromOption = {
    "gallery": DragOperation.galleryToThumbnail,
    "chunk": DragOperation.chunkToThumbnail,
}


function getDragOperation(draggableId: string, from: string, to: string): number {
    if (draggableId.startsWith("chunk-")) {
        return DragOperation.chunkReorder;
    }
    if (to === "empty") {
        return DragOperation.toEmptyChunk;
    }
    return to === "thumbnail" ?
        toThumbnailFromOption[from] :
        ToChunkFromOptions[from];
}

function getDragInfo(draggableId: string, destinationDroppableId: string, sourceDroppableId: string): IDragInfo {
    let to: string;
    if (destinationDroppableId === "chunk-images-droppable-empty") {
        to = "empty";
    } else {
        to = destinationDroppableId === "document-thumbnail-droppable" ?
            "thumbnail" :
            "chunk";
    }

    let from;
    if (sourceDroppableId.startsWith("chunk-images-droppable-")) {
        from = "chunk";
    } else if (sourceDroppableId === "binder-visuals-gallery-droppable") {
        from = "gallery";
    } else if (sourceDroppableId === "document-thumbnail-droppable") {
        from = "thumbnail";
    } else {
        from = undefined;
    }

    const dragOperation = getDragOperation(draggableId, from, to);
    const chunkIndexOfDraggingVisual = (from === "chunk" || from === "thumbnail") ?
        draggableId.split(",")[1] :
        undefined;
    const chunkIndexOfDraggingChunk = dragOperation === DragOperation.chunkReorder ?
        draggableId.split("-")[1] :
        undefined;
    return { from, to, chunkIndexOfDraggingVisual, chunkIndexOfDraggingChunk, dragOperation };
}
