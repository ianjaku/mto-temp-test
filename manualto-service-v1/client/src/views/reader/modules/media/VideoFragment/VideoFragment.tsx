import * as React from "react";
import { BinderVisual } from "@binders/client/lib/clients/repositoryservice/v3/BinderVisual";
import { FC } from "react";
import { FEATURE_VIDEOS_WITH_AUDIO } from "@binders/client/lib/clients/accountservice/v1/contract";
import { FatalVideoError } from "./FatalVideoError";
import { IDims } from "@binders/client/lib/clients/imageservice/v1/contract";
import { VideoPlayer } from "./videoplayer/VideoPlayer";
import { VisualReadyState } from "../PreloadingProvider/constants";
import { useIsAccountFeatureActive } from "../../../../../stores/hooks/account-hooks";
import { useStreamingDebugLogger } from "./videoplayer/useStreamingDebugLogger";
import { useUpdateReadyState } from "../PreloadingProvider/hooks";


export const VideoFragment: FC<{
    media: BinderVisual,
    isAudioEnabled: boolean,
    isActive: boolean,
    toggleAudio: () => unknown,
    viewportDims: IDims,
}> = ({
    media,
    isAudioEnabled,
    isActive,
    toggleAudio,
    viewportDims,
}) => {
    const updateReadyState = useUpdateReadyState();
    const audioFeatureActive = useIsAccountFeatureActive(FEATURE_VIDEOS_WITH_AUDIO);
    const enableAudio = audioFeatureActive && media.audioEnabled && isAudioEnabled;
    const debugLog = useStreamingDebugLogger();

    const handleFatalError = (err: FatalVideoError) => {
        debugLog("Fatal error in VideoFragment.tsx", media.id, "full media object:", media);
        throw err;
    }

    return (
        <VideoPlayer
            media={media}
            isActive={isActive}
            toggleAudio={() => toggleAudio()}
            enableAudio={enableAudio}
            onFatalError={(err: FatalVideoError) => handleFatalError(err)}
            onPlayable={() => updateReadyState(VisualReadyState.FULL)}
            viewportDims={viewportDims}
        />
    );
}
