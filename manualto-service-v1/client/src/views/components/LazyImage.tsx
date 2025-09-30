import * as React from "react";
import { Dimension, VisualFitBehaviour } from "@binders/client/lib/clients/imageservice/v1/contract";
import Loader from "../components/loader";
import cx from "classnames";

interface IProps {
    src: string,
    phSrc?: string, // low quality image placeholder
    fitBehaviour: VisualFitBehaviour;
    isCarouselImage: boolean;
    orientation?: string;
    alt: string,
    fillDimension: Dimension;
    onLoaded?: () => unknown;
    onError?: () => unknown;
    imgRef?: React.RefObject<HTMLImageElement>;
}

const LazyImage: React.FC<IProps> = ({
    src,
    phSrc,
    fitBehaviour,
    isCarouselImage,
    alt,
    fillDimension,
    onLoaded,
    onError,
    imgRef,
}) => {

    const [isLoading, setIsLoading] = React.useState(true);

    const classNames = cx(
        "image",
        fitBehaviour,
        isCarouselImage ? "carousel" : undefined,
        fillDimension === Dimension.Horizontal ? "fillHorizontal" : "fillVertical",
    );

    return (
        <>
            <div style={{ height: "100%", width: "100%" }} className="image-wrapper">
                <img
                    alt={alt}
                    src={src}
                    className={classNames}
                    onLoad={() => {
                        setIsLoading(false)
                        onLoaded?.()
                    }}
                    onError={() => onError?.()}
                    ref={imgRef}
                />
                {isLoading ? <Loader text="" className="imageLoader" /> : null}
            </div>
            <div
                className="image-wrapper phImg-wrapper"
                style={{
                    opacity: isLoading ? 1 : 0,
                    height: "100%",
                    width: "100%"
                }}
            >
                <img className={`${classNames} phImgBlur`} alt={src} src={phSrc} />
            </div>
        </>
    );
}

export default LazyImage