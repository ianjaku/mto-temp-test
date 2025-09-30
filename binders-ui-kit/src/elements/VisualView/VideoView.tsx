import * as React from "react";
import { IDims } from "@binders/client/lib/clients/imageservice/v1/contract";
import { asHexColor } from "../thumbnail";
import { scale } from "@binders/client/lib/util/screen";
import { useMemo } from "react";

export type VideoViewProps = {
    audioEnabled: boolean;
    bgColor: string;
    overlayMessage?: string;
    rotation?: number;
    src: IDims & { url: string };
    viewport: IDims;
}

export const VideoView: React.FC<VideoViewProps> = ({
    audioEnabled,
    bgColor,
    overlayMessage,
    rotation = 0,
    src,
    viewport,
}) => {
    const wrapperStyleObject = {
        backgroundColor: asHexColor(bgColor),
        width: undefined,
        height: undefined,
        ...(rotation ? { transform: `rotate(${rotation}deg)` } : {}),
    };

    const videoStyleObject = useMemo(() => {
        const { width: videoWidth, height: videoHeight } = scale({
            viewport,
            dims: src,
            preserveAspectRatio: true,
        });
        const videoStyleObject: React.CSSProperties = {
            position: "relative",
            width: videoWidth,
            height: videoHeight,
        };
        return videoStyleObject;
    }, [src, viewport]);

    return (
        <div className="video-wrapper visual-preview" style={wrapperStyleObject}>
            <video
                width={videoStyleObject.width || 500}
                src={src.url}
                autoPlay
                loop
                muted={!audioEnabled}
                style={videoStyleObject}
            />
            {overlayMessage && (
                <div className="visual-preview-overlay">
                    <p className="visual-preview-overlay-msg">
                        {overlayMessage}
                    </p>
                </div>
            )}
        </div>
    );
}

