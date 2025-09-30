import * as React from "react";
import {
    Dimension,
    IDims,
    VisualFitBehaviour
} from "@binders/client/lib/clients/imageservice/v1/contract";
import QuickPinchZoom, { make2dTransformValue } from "react-quick-pinch-zoom";
import {
    ReaderEvent,
    captureFrontendEvent
} from "@binders/client/lib/thirdparty/tracking/capture";
import { useCallback, useRef } from "react";
import LazyImage from "../../../../components/LazyImage";
import { isTouchDevice } from "@binders/client/lib/util/browsers";
import { useActiveViewable } from "../../../../../stores/hooks/binder-hooks";
import { useResetZoomOnActivate } from "./hooks";

interface IProps {
    imageId: string,
    src: string;
    fitBehaviour: VisualFitBehaviour;
    isCarouselImage: boolean;
    rotation?: number;
    fillDimension: Dimension;
    onImageLoaded?: () => unknown;
    onError?: () => unknown;
    imgOrigDimensions: IDims;
    isActive: boolean;
}

const PinchImage: React.FC<IProps> = ({
    imageId,
    src,
    fitBehaviour,
    isCarouselImage,
    fillDimension,
    onImageLoaded,
    onError,
    imgOrigDimensions,
    rotation,
    isActive,
}) => {

    const imgRef = useRef<HTMLImageElement>(null);
    const pinchZoomRef = useRef<QuickPinchZoom>(null);

    const activeViewable = useActiveViewable();
    const zoomUsageCaptured = useRef(false);

    const onUpdate = useCallback(({ x, y, scale }) => {
        const { current: img } = imgRef;
        if (img) {
            const value = make2dTransformValue({ x, y, scale });

            if (scale > 1 && !(zoomUsageCaptured.current)) {
                captureFrontendEvent(ReaderEvent.ReaderImageZoomed, { viewableId: activeViewable.id, imageId });
                zoomUsageCaptured.current = true;
            }

            img.style.setProperty("transform", `${value}${rotation ? ` rotate(${rotation}deg)` : ""}`);
            if (rotation) {
                /*
                    If the image is rotated, the transform-origin needs to be center, to rotate the image around its center
                    This means the default tweak to transform-origin (below) will no longer work
                    To mitigate, add padding to the QuickPinchZoom wrapper. It will be possible to pan out of bounds,
                    but that's the price to pay to avoid more tech debt, for this edge case
                */
                img.style.setProperty("transform-origin", "center center");
                return;
            }
            if (fitBehaviour === "crop") {
                /*
                    In case the image is set to crop, we only allow zooming/panning of the initial crop of the image,
                    because QuickPinchZoom doesn't play well with images that aren't entirely visible in the DOM.
                    Calculate the transform-origin for this
                */
                const imgFactor = imgOrigDimensions.width / imgOrigDimensions.height;
                const offsetPercentageX = Math.max(Math.round((100 - (100 / imgFactor)) / 2), 0);
                const offsetPercentageY = Math.max(Math.round((100 - (100 * imgFactor)) / 2), 0);
                img.style.setProperty("transform-origin", `${Math.round(offsetPercentageX)}% ${offsetPercentageY}%`);
            }

        }
    }, [activeViewable.id, fitBehaviour, imageId, imgOrigDimensions.height, imgOrigDimensions.width, rotation]);

    useResetZoomOnActivate(isActive, pinchZoomRef);

    return (
        <QuickPinchZoom
            onUpdate={onUpdate}
            doubleTapZoomOutOnMaxScale
            minZoom={1}
            maxZoom={3}
            verticalPadding={rotation && 500} // reason: see above "If the image is rotated..."
            horizontalPadding={rotation && 500}
            enabled={isTouchDevice()}
            ref={pinchZoomRef}
        >
            <div style={{ height: "100%", width: "100%" }}>
                <LazyImage
                    alt={src}
                    src={src}
                    fitBehaviour={fitBehaviour}
                    isCarouselImage={isCarouselImage}
                    fillDimension={fillDimension}
                    onLoaded={onImageLoaded}
                    onError={onError}
                    imgRef={imgRef}
                />
            </div>
        </QuickPinchZoom>
    )
}

export default PinchImage