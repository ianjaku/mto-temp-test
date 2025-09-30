import * as React from "react";
import Tooltip, { TooltipPosition, hideTooltip, showTooltip } from "@binders/ui-kit/lib/elements/tooltip/Tooltip";
import DragIndicator from "@binders/ui-kit/lib/elements/icons/DragIndicator";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import cx from "classnames";
import { useTranslation } from "@binders/client/lib/react/i18n";

const dragIconStyle = {
    fontSize: "22px",
    cursor: "move",
    transition: undefined,
};

const DragButton = ( {dragHandleProps, isActive, isDragging, style} ) => {
    const { t } = useTranslation();
    const reorderChunksTT = React.useRef(null);

    const handleMouseEnter = React.useCallback((e) => {
        if (reorderChunksTT) {
            showTooltip(e, reorderChunksTT.current, TooltipPosition.LEFT);
        }
    }, [reorderChunksTT]);
    const handleMouseLeave = React.useCallback((e) => {
        if (reorderChunksTT) {
            hideTooltip(e, reorderChunksTT.current);
        }
    }, [reorderChunksTT]);

    const classes = cx(
        "drag-button",
        {
            "--is-dragging": !isActive && isDragging,
            "--is-inactive": !isActive && !isDragging,
        },
    );
    return (
        <>
            <div
                className={classes}
                {...dragHandleProps}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                style={style || {}}
                tabIndex={-1}
            >
                {DragIndicator(dragIconStyle)}
            </div>
            <Tooltip ref={reorderChunksTT} message={t(TK.Edit_ChunkReorderTooltip)} />
        </>
    );
};

export default DragButton;