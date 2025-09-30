import * as React from "react";
import { FC, useMemo } from "react";
import History from "@binders/ui-kit/lib/elements/icons/History";
import Image from "@binders/ui-kit/lib/elements/icons/Image";
import Language from "@binders/ui-kit/lib/elements/icons/Language";
import Share from "@binders/ui-kit/lib/elements/icons/Share";
import Translate from "@binders/ui-kit/lib/elements/icons/Translate";
import colors from "@binders/ui-kit/lib/variables";
import cx from "classnames";
import { useRibbonsTopHeight } from "@binders/ui-kit/lib/compounds/ribbons/hooks";
import { useWindowDimensions } from "@binders/ui-kit/lib/hooks/useWindowDimensions";
import vars from "@binders/ui-kit/lib/variables";
import "./pendingComposer.styl";

export const PendingComposer: FC<{
    isMobile: boolean;
    mobileViewOnOpenRightPane: boolean;
}> = ({ isMobile, mobileViewOnOpenRightPane }) => {
    const ribbonsTopHeight = useRibbonsTopHeight();
    const autoWidth = "composer-auto-width";
    const windowDimensions = useWindowDimensions();
    const hasHorizontalVisuals = useMemo(() =>
        isMobile || mobileViewOnOpenRightPane || windowDimensions.width < parseInt(vars.laptop, 10)
    , [isMobile, mobileViewOnOpenRightPane, windowDimensions]);
    return (
        <>
            <div className="composer-top-bar composer-top-bar--pending">
                <div className={cx(
                    "composer-top-bar-inner",
                    autoWidth,
                )}>
                    <div className={cx(
                        "composer-top-bar--head",
                        "breadcrumbs-viewer",
                    )}>
                        <div className="breadcrumbs-wrapper">
                            <div className="breadcrumbs-pending"><div className="composer-skeleton skeleton-animation" /></div>
                        </div>
                    </div>
                    <div className="composer-top-bar--tail"><div className="composer-skeleton skeleton-animation" /></div>
                    <div className="composer-top-bar--stats"><div className="composer-skeleton skeleton-animation" /></div>
                </div>
            </div>
            <div className="composer composer-title-chunks composer-title-chunks--pending">
                <div className={cx(
                    autoWidth,
                    "composer-title-chunks--grid",
                    "grid-cols-1",
                    "composer-width-75-pct",
                    { "composer--horizontalvisuals": hasHorizontalVisuals },
                )}>
                    <div className="composer-title-chunk-actions--pending grid-col-1 grid-row-1 flex flex-row">
                    </div>
                    <div className="composer--pending grid-col-1 grid-row-2">
                        <PendingChunk />
                    </div>
                </div>
            </div>
            <div className="composer composer--pending container">
                <div className="chunks-area">
                    <div className="binder-languages">
                        <PendingChunk />
                    </div>
                </div>
                <div className="pending-publish-buttons-wrapper">
                    <div/>
                    <div/>
                </div>
                {!isMobile && (
                    <div
                        className="rightpane-pending"
                        style={{ marginTop: `${ribbonsTopHeight}px` }}
                    >
                        {Translate({ color: colors.middleGreyColor, display: "flex", fontSize: 26 })}
                        {Image({ color: colors.middleGreyColor, display: "flex", fontSize: 26 })}
                        {Language({ color: colors.middleGreyColor, display: "flex", fontSize: 26 })}
                        {Share({ color: colors.middleGreyColor, display: "flex", fontSize: 26 })}
                        {History({ color: colors.middleGreyColor, display: "flex", fontSize: 26 })}
                    </div>
                )}
            </div>
        </>
    );
}

const PendingChunk: FC = () => {
    return (
        <div className="chunk">
            <div className="chunk-pendingimg" />
            <div className="chunk-pendingtext" />
        </div>
    );
}
