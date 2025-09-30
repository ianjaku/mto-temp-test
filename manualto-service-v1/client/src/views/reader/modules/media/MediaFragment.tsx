import * as React from "react";
import { useAllowedReadyState, useReadyState } from "./PreloadingProvider/hooks";
import { BinderVisual } from "@binders/client/lib/clients/repositoryservice/v3/BinderVisual";
import { ErrorBoundary } from "react-error-boundary";
import { FC } from "react";
import { IDims } from "@binders/client/lib/clients/imageservice/v1/contract";
import { ImageFragment } from "./ImageFragment/ImageFragment";
import { MediaFragmentErrorFallback } from "./MediaFragmentErrorFallback";
import { MediaPreview } from "./MediaPreview";
import { VideoFragment } from "./VideoFragment/VideoFragment";
import { VisualReadyState } from "./PreloadingProvider/constants";
import { useIsVideoAuthReady } from "./VideoFragment/videoplayer/auth/VideoAuthProvider";


export const MediaFragment: FC<{
    media: BinderVisual,
    imageViewportDims: IDims,
    isAudioEnabled: boolean,
    isActive: boolean,
    toggleAudio: () => unknown,
}> = (props) => {

    const allowedReadyState = useAllowedReadyState();
    const readyState = useReadyState();

    const videoAuthReady = useIsVideoAuthReady();
    const authReady = props.media.isVideo() ? videoAuthReady : true;

    const showFull = allowedReadyState >= VisualReadyState.FULL && authReady;
    const showPreview = readyState <= VisualReadyState.PREVIEW || !authReady;

    if (allowedReadyState === VisualReadyState.NONE) {
        return null;
    }
    return (
        <>
            <ErrorBoundary
                FallbackComponent={({ error, resetErrorBoundary }) => (
                    <MediaFragmentErrorFallback
                        media={props.media}
                        error={error}
                        retry={() => resetErrorBoundary()}
                        viewportDims={props.imageViewportDims}
                    />
                )}
            >
                {showFull && props.media.isVideo() && (
                    <VideoFragment
                        media={props.media}
                        isAudioEnabled={props.isAudioEnabled}
                        isActive={props.isActive}
                        toggleAudio={() => props.toggleAudio()}
                        viewportDims={props.imageViewportDims}
                    />
                )}
                {showFull && !props.media.isVideo() && (
                    <ImageFragment
                        media={props.media}
                        imageViewportDims={props.imageViewportDims}
                        isActive={props.isActive}
                    />
                )}
                <MediaPreview
                    hide={!showPreview}
                    media={props.media}
                    viewportDims={props.imageViewportDims}
                />
            </ErrorBoundary>
        </>
    );
}
