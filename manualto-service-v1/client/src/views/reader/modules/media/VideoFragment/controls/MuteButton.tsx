import * as React from "react";
import { IDims } from "@binders/client/lib/clients/imageservice/v1/contract";
import Mute from "@binders/ui-kit/lib/elements/icons/Mute";
import Unmute from "@binders/ui-kit/lib/elements/icons/Unmute";
import { useRibbonsBottomHeight } from "@binders/ui-kit/lib/compounds/ribbons/hooks";

interface IProps {
    isMuted: boolean;
    dimsComputed: {
        videoDimsComputed: IDims,
        wrapperDimsComputed: IDims,
    };
    toggleAudio: () => void;
}

const MuteButton: React.FC<IProps> = ({ isMuted, dimsComputed, toggleAudio }: IProps) => {
    const { videoDimsComputed, wrapperDimsComputed } = dimsComputed || {};
    const ribbonsBottomHeight = useRibbonsBottomHeight();
    let width, height;
    // this is needed for cropped videos, when video dimensions are bigger than the viewport we show it in

    if (videoDimsComputed && wrapperDimsComputed) {
        width = videoDimsComputed.width > wrapperDimsComputed.width ? wrapperDimsComputed.width : videoDimsComputed.width;
        height = videoDimsComputed.height > wrapperDimsComputed.height ? wrapperDimsComputed.height : videoDimsComputed.height;
    } else {
        width = "auto";
        height = "auto";
    }
    const styles: React.CSSProperties = { position: "relative", width, height, pointerEvents: "none" };
    return (
        <div style={styles} onClick={e => e.stopPropagation()}>
            <button
                className="vjs-toggleMute-button"
                type="button"
                aria-disabled="false"
                onClick={toggleAudio}
                style={{
                    pointerEvents: "auto",
                    marginBottom: ribbonsBottomHeight,
                }}
            >
                {isMuted ? <Mute /> : <Unmute />}
            </button>
        </div>
    );
}
export default MuteButton