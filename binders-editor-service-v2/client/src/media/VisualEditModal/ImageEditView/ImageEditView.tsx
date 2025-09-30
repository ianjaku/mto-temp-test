import * as React from "react";
import Thumbnail from "@binders/ui-kit/lib/elements/thumbnail";
import { VisualSettings } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import "./ImageEditView.styl";

export type ImageViewProps = {
    overlayMessage?: string;
    src: { url: string, width: number, height: number };
    viewport: { width: number, height: number };
    visualSettings: VisualSettings,
}

export const ImageEditView: React.FC<ImageViewProps> = ({
    overlayMessage,
    src,
    viewport,
    visualSettings,
}) => {
    return (
        <div
            className="image-preview"
            style={{ overflow: undefined, height: viewport.height, width: viewport.width }}
        >
            <Thumbnail
                src={src.url}
                width={viewport.height}
                bgColor={visualSettings.bgColor}
                dontExceedImgDims={true}
                innerWrapperStyle={{ height: viewport.height, width: viewport.width }}
                outerWrapperStyle={{ height: viewport.height, width: viewport.width }}
                imageStyle={{
                    height: "100%",
                    width: "100%",
                    objectFit: visualSettings.fitBehaviour === "fit" ? "contain" : "cover",
                }}
                rotation={visualSettings.rotation}
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
