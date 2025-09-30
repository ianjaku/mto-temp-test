import * as React from "react";
import { getFitBehaviour, getOriginalDimensions, getVisualRotation, isLandscape } from "../visualHelpers";
import { useForceLowResVideo, useMediaId } from "../hooks";
import { BinderVisual } from "@binders/client/lib/clients/repositoryservice/v3/BinderVisual";
import { FC } from "react";
import { IDims } from "@binders/client/lib/clients/imageservice/v1/contract";
import PinchImage from "./PinchImage";
import { VisualReadyState } from "../PreloadingProvider/constants";
import { isMobileSafari } from "@binders/client/lib/util/browsers";
import { useErrorBoundary } from "react-error-boundary";
import { useUpdateReadyState } from "../PreloadingProvider/hooks";


export const ImageFragment: FC<{
    media: BinderVisual,
    imageViewportDims: IDims,
    isActive: boolean,
}> = ({
    imageViewportDims,
    media,
    isActive,
}) => {
    const mediaId = useMediaId(media);
    const forceLowResVideo = useForceLowResVideo();
    const { showBoundary } = useErrorBoundary();
    const updateReadyState = useUpdateReadyState();

    const src = React.useMemo(() => {
        if (!media.url) return "";
        return media.buildRenderUrl({
            isMobileSafari: isMobileSafari(navigator.userAgent),
            bestFitOptions: {
                isLandscape: isLandscape(media),
                viewportDims: imageViewportDims,
            },
            forceLowResVideo,
        })
    }, [media, imageViewportDims, forceLowResVideo]);

    return (
        <PinchImage
            imageId={media.id}
            src={src}
            fitBehaviour={getFitBehaviour(media)}
            isCarouselImage={false}
            rotation={getVisualRotation(media)}
            fillDimension={media.getFillDimension(imageViewportDims)}
            onImageLoaded={() => updateReadyState(VisualReadyState.FULL)}
            imgOrigDimensions={getOriginalDimensions(media)}
            onError={() => {
                updateReadyState(VisualReadyState.ERROR);
                showBoundary(new Error(`Failed to load image with id ${mediaId} through source ${src}`));
            }}
            isActive={isActive}
        />
    );
}
