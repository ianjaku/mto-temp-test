import * as React from "react";
import { BrowseShareButtonProps, useBrowseShareButton } from "../hooks/useBrowseShareButton";
import Tooltip, {
    TooltipPosition,
    hideTooltip,
    showTooltip
} from "@binders/ui-kit/lib/elements/tooltip/Tooltip";
import Icon from "@binders/ui-kit/lib/elements/icons";
import { isMobileView } from "@binders/ui-kit/lib/helpers/rwd";
import { useRef } from "react";
import "./BrowseShareButton.styl";

export const BrowseShareButton: React.FC<BrowseShareButtonProps> = ({ item }) => {
    const shareTooltip = useRef(null);
    const {
        onClick: onBrowseShareButtonClick,
        tooltipMessage: shareTooltipMessage,
    } = useBrowseShareButton({ item });

    return !isMobileView() ?
        <>
            <div
                className="browse-share-button"
                onClick={(event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    onBrowseShareButtonClick();
                }}
                onMouseEnter={e => {
                    showTooltip(e, shareTooltip.current, TooltipPosition.BOTTOM, { top: 10, left: -35 });
                }}
                onMouseLeave={e => {
                    hideTooltip(e, shareTooltip.current);
                }}
                data-testid="browse-share-button"
            >
                <Icon name="qr_code" />
            </div>
            <Tooltip message={shareTooltipMessage} ref={shareTooltip} />
        </> :
        null;
}
