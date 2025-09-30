import * as React from "react";
import PlayArrowIcon from "@binders/ui-kit/lib/elements/icons/play_arrow/index";

export const PlayButtonOverlay: React.FC<{
    onClick: () => void;
}> = ({ onClick }) => {
    return (
        <div className="video-play-button-overlay" onClick={onClick}>
            <PlayArrowIcon height="36px"/>
        </div>
    );
};
