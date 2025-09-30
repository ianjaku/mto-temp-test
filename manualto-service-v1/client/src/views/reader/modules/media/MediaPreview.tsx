import * as React from "react";
import { getFitBehaviour, isLandscape } from "./visualHelpers";
import { Application } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { BinderVisual } from "@binders/client/lib/clients/repositoryservice/v3/BinderVisual";
import { FC } from "react";
import { IDims } from "@binders/client/lib/clients/imageservice/v1/contract";
import { VisualReadyState } from "./PreloadingProvider/constants";
import { logClientError } from "@binders/client/lib/util/clientErrors";
import { useUpdateReadyState } from "./PreloadingProvider/hooks";
import { useVideoPreviewUrl } from "./hooks";


export const MediaPreview: FC<{
    hide: boolean;
    media: BinderVisual;
    viewportDims: IDims;
}> = (props) => {
    const updateReadyState = useUpdateReadyState();
    const videoPreviewUrl = useVideoPreviewUrl(props.media, props.viewportDims);
    const imagePreviewUrl = React.useMemo(() => {
        if (props.media.url == null) return "";
        return props.media.buildRenderUrl({
            bestFitOptions: {
                isLandscape: isLandscape(props.media),
                viewportDims: props.viewportDims
            },
            requestedFormatNames: ["tiny", "thumbnail"]
        });
    }, [props.media, props.viewportDims]);
    const previewUrl = props.media.isVideo() ? videoPreviewUrl : imagePreviewUrl;


    // Don't show a preview if the media is hardcoded
    if (previewUrl?.startsWith("data:")) return null;
    return (
        <img
            style={{
                opacity: props.hide ? 0 : 1,
                transition: "opacity 0.1s linear",
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                objectFit: getFitBehaviour(props.media) === "fit" ? "contain" : "cover",
                filter: "blur(15px)",
                transform: "scale(1.1)",
                pointerEvents: "none",
            }}
            src={previewUrl}
            onLoad={() => updateReadyState(VisualReadyState.PREVIEW)}
            onError={() => {
                logClientError(
                    Application.READER,
                    `Failed to load media preview. Src: ${previewUrl}. For media id: ${props.media.id}`,
                );
                updateReadyState(VisualReadyState.PREVIEW)
            }}
        />
    );
}
