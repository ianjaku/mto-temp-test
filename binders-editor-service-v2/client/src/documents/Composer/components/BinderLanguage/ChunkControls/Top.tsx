import * as React from "react";
import Tooltip, {
    TooltipPosition,
    hideTooltip,
    showTooltip
} from "@binders/ui-kit/lib/elements/tooltip/Tooltip";
import { ChunkOperation } from "./contract";
import DeleteChunkButton from "@binders/ui-kit/lib/elements/button/DeleteChunk";
import MergeChunkButton from "@binders/ui-kit/lib/elements/button/MergeChunk";
import { TFunction } from "@binders/client/lib/i18n";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import cx from "classnames";
import { useTranslation } from "@binders/client/lib/react/i18n";

const { useCallback, useRef } = React;

interface IChunkTopControlsProps {
    chunkIndex: number;
    onChunkOperation: (index: number, operation: number, isSecondary?: boolean) => void;
    showDeleteButton: boolean;
    showMergeButton: boolean;
    isSecondary?: boolean;
}

const ChunkTopControls: React.FC<IChunkTopControlsProps> = (props: IChunkTopControlsProps) => {
    const { chunkIndex, onChunkOperation, showDeleteButton, showMergeButton, isSecondary } = props;
    const mergeChunksTooltipRef = useRef(null);
    const deleteChunksTooltipRef = useRef(null);
    const { t }: { t: TFunction } = useTranslation();

    const handleMerge = useCallback(() => onChunkOperation(chunkIndex - 2, ChunkOperation.merge, isSecondary), [chunkIndex, onChunkOperation, isSecondary]);
    const handleDelete = useCallback(() => onChunkOperation(chunkIndex, ChunkOperation.delete, isSecondary), [chunkIndex, onChunkOperation, isSecondary]);

    const onMouseEnterMergeButton = useCallback((e) => {
        if (mergeChunksTooltipRef) {
            showTooltip(e, mergeChunksTooltipRef.current, TooltipPosition.TOP);
        }
    }, [mergeChunksTooltipRef]);
    const onMouseLeaveMergeButton = useCallback((e) => {
        if (mergeChunksTooltipRef) {
            hideTooltip(e, mergeChunksTooltipRef.current);
        }
    }, [mergeChunksTooltipRef]);

    const onMouseEnterDeleteButton = useCallback((e) => {
        if (mergeChunksTooltipRef) {
            showTooltip(e, deleteChunksTooltipRef.current, TooltipPosition.TOP);
        }
    }, [deleteChunksTooltipRef]);
    const onMouseLeaveDeleteButton = useCallback((e) => {
        if (mergeChunksTooltipRef) {
            hideTooltip(e, deleteChunksTooltipRef.current);
        }
    }, [deleteChunksTooltipRef]);

    return (
        <div className={cx("chunk-controls", "chunk-controls-top", { "chunk-controls-isSecondary": isSecondary })}>
            {showDeleteButton && (
                <DeleteChunkButton
                    className="chunk-button"
                    key="delete-button"
                    onClick={handleDelete}
                    onMouseEnter={onMouseEnterDeleteButton}
                    onMouseLeave={onMouseLeaveDeleteButton}
                />
            )}
            {!showDeleteButton && showMergeButton && (
                <MergeChunkButton
                    className="chunk-button"
                    key="merge-button"
                    onClick={handleMerge}
                    onMouseEnter={onMouseEnterMergeButton}
                    onMouseLeave={onMouseLeaveMergeButton}
                />
            )}
            <Tooltip key="merge-tt" ref={mergeChunksTooltipRef} message={t(TK.Edit_ChunkMergeWithPrev)} />
            <Tooltip key="delete-tt" ref={deleteChunksTooltipRef} message={t(TK.Edit_ChunkDelete)} />
        </div>
    );
};

export default ChunkTopControls;
