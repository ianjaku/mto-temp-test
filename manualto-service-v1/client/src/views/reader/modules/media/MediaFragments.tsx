import * as React from "react";
import { BinderVisual } from "@binders/client/lib/clients/repositoryservice/v3/BinderVisual";
import Carousel from "./Carousel";
import { FC } from "react";
import { IDims } from "@binders/client/lib/clients/imageservice/v1/contract";
import { MediaFragment } from "./MediaFragment";
import { MediaPositionProvider } from "./MediaPositionProvider";
import { getVisualBackground } from "./visualHelpers";


export const MediaFragments: FC<{
    visuals: BinderVisual[];
    imageViewportDims: IDims;
    isAudioEnabled: boolean;
    isActive: boolean;
    toggleAudio: () => unknown;
    handleCarouselPositionChange: (newCarouselPosition: number, chunkPosition: number) => unknown;
    chunkPosition: number;
}> = (props) => {

    if (props.visuals.length === 0) return null;
    if (props.visuals.length === 1) {
        return (
            <MediaPositionProvider
                chunkPosition={props.chunkPosition}
                carouselPosition={0}
            >
                <MediaFragment
                    media={props.visuals[0]}
                    imageViewportDims={props.imageViewportDims}
                    isAudioEnabled={props.isAudioEnabled}
                    isActive={props.isActive}
                    toggleAudio={() => props.toggleAudio()}
                />
            </MediaPositionProvider>
        )
    }
    return (
        <Carousel
            onPositionChange={
                (newCarouselPosition) => props.handleCarouselPositionChange(
                    newCarouselPosition, props.chunkPosition
                )
            }
            children={activeSlideIndex => {
                return props.visuals.map((visual, visualPositionInCarousel) => {
                    return (
                        <MediaPositionProvider
                            chunkPosition={props.chunkPosition}
                            carouselPosition={visualPositionInCarousel}
                            key={`visual-wrapper-${props.chunkPosition}-${visualPositionInCarousel}`}
                        >
                            <div
                                className="image-wrapper"
                                style={{ backgroundColor: getVisualBackground(visual) }}
                            >
                                <MediaFragment
                                    media={visual}
                                    imageViewportDims={props.imageViewportDims}
                                    isAudioEnabled={props.isAudioEnabled}
                                    isActive={props.isActive && visualPositionInCarousel === activeSlideIndex}
                                    toggleAudio={() => props.toggleAudio()}
                                />
                            </div>
                        </MediaPositionProvider>
                    )
                })
            }}
        ></Carousel>
    );
}
