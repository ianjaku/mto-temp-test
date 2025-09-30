import * as React from "react";
import Thumbnail from "../thumbnail";
import { scale } from "@binders/client/lib/util/screen";

export type ImageViewProps = {
    bgColor: string;
    overlayMessage?: string;
    rotation?: number;
    src: { url: string, width: number, height: number };
    viewport: { width: number, height: number };
}

export const ImageView: React.FC<ImageViewProps> = ({
    bgColor,
    overlayMessage,
    rotation = 0,
    src,
    viewport,
}) => {
    const maxWidth = `${viewport.width}px`;
    const maxHeight = `${viewport.height}px`;
    const { width: imgWidth, height: imgHeight } = scale({
        viewport,
        dims: src,
    })
    const style = {
        height: imgHeight,
        width: imgWidth,
    };
    return (
        <div
            className={"preview-wrapper visual-preview"}
            style={{ overflow: undefined }}
        >
            <Thumbnail
                src={src.url}
                width={imgWidth}
                bgColor={bgColor}
                dontExceedImgDims={true}
                outerWrapperStyle={style}
                innerWrapperStyle={style}
                imageStyle={{
                    maxHeight,
                    maxWidth,
                    objectFit: undefined,
                }}
                rotation={rotation}
                onClick={e => e.preventDefault()}
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

