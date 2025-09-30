import * as React from "react";
import Tooltip, {
    TooltipPosition,
    hideTooltip,
    showTooltip
} from "@binders/ui-kit/lib/elements/tooltip/Tooltip";
import AddChunkButton from "@binders/ui-kit/lib/elements/button/AddChunk";
import { ChunkOperation } from "./contract";
import { NavigationDrawerPaneItem } from "../../NavigationDrawer";
import { TFunction } from "@binders/client/lib/i18n";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import ToggleNewCommentButton from "@binders/ui-kit/lib/elements/button/ToggleNewComment";
import cx from "classnames";
import { isMobileView } from "@binders/ui-kit/lib/helpers/rwd";
import { useBinderLanguageOperations } from "../../../contexts/binderLanguagePropsContext";
import { useChunkProps } from "../../../contexts/chunkPropsContext";
import { useComposerContext } from "../../../contexts/composerContext";
import { useTranslation } from "@binders/client/lib/react/i18n";

const { useCallback, useRef } = React;

interface IChunkBottomControlsProps {
    showAddButton: boolean;
    showToggleNewCommentButton: boolean;
}

const ChunkBottomControls: React.FC<IChunkBottomControlsProps> = (props: IChunkBottomControlsProps) => {
    const { showAddButton, showToggleNewCommentButton } = props;
    const { onChunkOperation } = useBinderLanguageOperations();
    const { chunkIndex, isPrimary } = useChunkProps();
    const isSecondary = !isPrimary;

    const addChunkTooltipRef = useRef(null);
    const toggleNewCommentTooltipRef = useRef(null);

    const { t }: { t: TFunction } = useTranslation();

    const handleAddChunk = useCallback(() => onChunkOperation(chunkIndex, ChunkOperation.add, isSecondary), [chunkIndex, onChunkOperation, isSecondary]);
    // const handleToggleNewComment = useCallback(() => onToggleNewComment(chunkId, !isSecondary), [chunkId, onToggleNewComment, isSecondary]);
    const composerContext = useComposerContext();
    const handleToggleNewComment = () => {
        composerContext.setNavigationDrawerItem(NavigationDrawerPaneItem.CommentsPane);
    }

    const onMouseEnterCommentButton = useCallback((e) => {
        if (addChunkTooltipRef) {
            showTooltip(e, toggleNewCommentTooltipRef.current, TooltipPosition.BOTTOM);
        }
    }, [toggleNewCommentTooltipRef]);

    const onMouseLeaveCommentButton = useCallback((e) => {
        if (addChunkTooltipRef) {
            hideTooltip(e, toggleNewCommentTooltipRef.current);
        }
    }, [toggleNewCommentTooltipRef]);

    const onMouseEnterAddChunkButton = useCallback((e) => {
        if (addChunkTooltipRef) {
            showTooltip(e, addChunkTooltipRef.current, TooltipPosition.BOTTOM);
        }
    }, [addChunkTooltipRef]);
    const onMouseLeaveAddChunkButton = useCallback((e) => {
        if (addChunkTooltipRef) {
            hideTooltip(e, addChunkTooltipRef.current);
        }
    }, [addChunkTooltipRef]);

    return (
        <div className={cx("chunk-controls", "chunk-controls-bottom", { "chunk-controls-isSecondary": isSecondary })}>
            {showAddButton && (
                <AddChunkButton
                    key="add-chunk"
                    className={cx("chunk-button", { "first": chunkIndex === 1 }, [chunkIndex])}
                    onClick={handleAddChunk}
                    onMouseEnter={onMouseEnterAddChunkButton}
                    onMouseLeave={onMouseLeaveAddChunkButton}
                />
            )}
            {!isMobileView() && showToggleNewCommentButton && (
                <ToggleNewCommentButton
                    key="comment"
                    className="chunk-button"
                    onClick={handleToggleNewComment}
                    onMouseEnter={onMouseEnterCommentButton}
                    onMouseLeave={onMouseLeaveCommentButton}
                />
            )}
            <Tooltip key="add-tt" ref={addChunkTooltipRef} message={t(TK.Edit_ChunkAdd)} />
            <Tooltip key="comm-tt" ref={toggleNewCommentTooltipRef} message={t(TK.Edit_CommentToggleNew)} />
        </div>
    )
}

export default ChunkBottomControls;
