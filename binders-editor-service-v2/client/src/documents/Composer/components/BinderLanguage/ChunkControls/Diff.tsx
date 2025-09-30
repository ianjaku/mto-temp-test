import * as React from "react";
import { FC, useCallback, useRef } from "react";
import Tooltip, {
    TooltipPosition,
    hideTooltip,
    showTooltip
} from "@binders/ui-kit/lib/elements/tooltip/Tooltip";
import { useBinderDiff, useBinderLanguageDiff } from "../../../../../content/BinderDiffProvider";
import Check from "@binders/ui-kit/lib/elements/icons/Check";
import Close from "@binders/ui-kit/lib/elements/icons/Close";
import Refresh from "@binders/ui-kit/lib/elements/icons/Refresh";
import { useBinderLanguageComputedProps } from "../../../contexts/binderLanguagePropsContext";
import { useChunkProps } from "../../../contexts/chunkPropsContext";
import "./Diff.styl";

export const ChunkDiffViewControls: FC = () => {
    const acceptTooltipRef = useRef(null);
    const rejectTooltipRef = useRef(null);
    const retryTooltipRef = useRef(null);

    const { chunkIndex } = useChunkProps();
    const { binderDiffStateMap, resetChunkDiffState } = useBinderDiff();
    const { acceptChunkChanges, rejectChunkChanges, retryChunk } = useBinderLanguageDiff();
    const { langIdx } = useBinderLanguageComputedProps();

    const isDiffHidden = binderDiffStateMap[langIdx]?.[chunkIndex] === "NoDiff_Original" ||
        binderDiffStateMap[langIdx]?.[chunkIndex] === "NoDiff_Changed";

    const handleAccept = () => { acceptChunkChanges(chunkIndex); }
    const handleReject = () => { rejectChunkChanges(chunkIndex); }
    const handleRetry = () => {
        retryChunk(chunkIndex);
        resetChunkDiffState(langIdx, chunkIndex);
    }

    const onMouseEnterAcceptButton = useCallback((e) => {
        if (acceptTooltipRef) showTooltip(e, acceptTooltipRef.current, TooltipPosition.BOTTOM);
    }, [acceptTooltipRef]);
    const onMouseLeaveAcceptButton = useCallback((e) => {
        if (acceptTooltipRef) hideTooltip(e, acceptTooltipRef.current);
    }, [acceptTooltipRef]);

    const onMouseEnterRejectButton = useCallback((e) => {
        if (acceptTooltipRef) showTooltip(e, rejectTooltipRef.current, TooltipPosition.BOTTOM);
    }, [rejectTooltipRef]);
    const onMouseLeaveRejectButton = useCallback((e) => {
        if (acceptTooltipRef) hideTooltip(e, rejectTooltipRef.current);
    }, [rejectTooltipRef]);

    const onMouseEnterRetryButton = useCallback((e) => {
        if (retryTooltipRef) showTooltip(e, retryTooltipRef.current, TooltipPosition.BOTTOM);
    }, [retryTooltipRef]);
    const onMouseLeaveRetryButton = useCallback((e) => {
        if (retryTooltipRef) hideTooltip(e, retryTooltipRef.current);
    }, [retryTooltipRef]);

    return (
        <div className={`chunk-controls-diff chunk-controls-diff-${chunkIndex}`}>
            {!isDiffHidden && <div
                className="icon-button diff-control-accept transition-color"
                onClick={handleAccept}
                onMouseEnter={onMouseEnterAcceptButton}
                onMouseLeave={onMouseLeaveAcceptButton}
            ><Check /></div>}
            {!isDiffHidden && <div
                className="icon-button diff-control-reject transition-color"
                onClick={handleReject}
                onMouseEnter={onMouseEnterRejectButton}
                onMouseLeave={onMouseLeaveRejectButton}
            ><Close /></div>}
            <div
                className="icon-button diff-control-retry transition-color"
                onClick={handleRetry}
                onMouseEnter={onMouseEnterRetryButton}
                onMouseLeave={onMouseLeaveRetryButton}
            ><Refresh /></div>
            <Tooltip key="accept-tt" ref={acceptTooltipRef} message={"Accept changes"} />
            <Tooltip key="reject-tt" ref={rejectTooltipRef} message={"Reject changes"} />
            <Tooltip key="retry-tt" ref={retryTooltipRef} message={"Retry"} />
        </div>
    )
}
