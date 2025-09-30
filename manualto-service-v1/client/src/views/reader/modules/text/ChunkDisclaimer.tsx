import * as React from "react";
import {
    DisclaimerVisibility,
    useDisclaimerStoreActions,
    useDisclaimerVisibility,
} from "../../../../stores/zustand/disclaimer-store";
import { FC } from "react";
import Icon from "@binders/ui-kit/lib/elements/icons";
import cx from "classnames";
import { useActiveChunkIndex } from "../../../../stores/hooks/chunk-position-hooks";
import "./ChunkDisclaimer.styl";

export const ChunkDisclaimer: FC<{ chunkIdx: number }> = ({ children, chunkIdx }) => {
    const {
        setAllDisclaimersVisibility,
        toggleAllDisclaimersVisibility,
    } = useDisclaimerStoreActions();
    const activeChunkIndex = useActiveChunkIndex();
    const visibility = useDisclaimerVisibility(chunkIdx);
    const isExpanded = activeChunkIndex === chunkIdx && visibility === DisclaimerVisibility.Visible;
    return (
        <div className={cx(
            "chunk-disclaimer",
            isExpanded ? "state__expanded" : "state__collapsed",
        )}>
            <div className="disclaimer-content">
                <span className="disclaimer-message">
                    {children}
                </span>
                <button
                    className="icon-btn close-btn transition-colors"
                    onClick={(e) => {
                        e.stopPropagation();
                        setAllDisclaimersVisibility(DisclaimerVisibility.Hidden);
                    }}
                >
                    <Icon name="close" />
                </button>
            </div>
            <button
                className="icon-btn open-btn transition-colors"
                onClick={(e) => {
                    e.stopPropagation();
                    toggleAllDisclaimersVisibility();
                }}
            >
                <Icon name="info" />
            </button>
        </div>
    )
}
