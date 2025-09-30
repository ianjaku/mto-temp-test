import { MediaPosition, useMediaPosition } from "../MediaPositionProvider";
import { PreloadingContext, preloadingContext } from "./PreloadingProvider";
import { getReadyState, isEqualPosition } from "./helpers";
import {
    FEATURE_DISABLE_PRELOADING
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { VisualReadyState } from "./constants";
import { useContext } from "react";
import { useIsAccountFeatureActive } from "../../../../../stores/hooks/account-hooks";
import { useSearchParams } from "../../../../../stores/hooks/router-hooks";


export const usePreloadingContext = (): PreloadingContext => {
    return useContext(preloadingContext);
}

export const useIsPreloadingDisabled = (): boolean => {
    const preloadingDisabled = useIsAccountFeatureActive(FEATURE_DISABLE_PRELOADING);
    const searchParams = useSearchParams();

    if (preloadingDisabled) return true;
    if (searchParams?.has("nopreload")) {
        return true;
    }
    return false;
}

export const useAllowedReadyState = (): VisualReadyState => {
    const context = usePreloadingContext();
    const position = useMediaPosition();
    const preloadingDisabled = useIsPreloadingDisabled();

    const activePosition: MediaPosition = {
        chunkPosition: context.activeChunkPosition,
        carouselPosition: context.carouselPositions[context.activeChunkPosition] ?? 0
    }
    if (isEqualPosition(position, activePosition)) return VisualReadyState.FULL;

    const currentReadyState = getReadyState(context.readyStates, position, null);
    const allowedReadyState = getReadyState(context.allowedReadyStates, position, null);

    // If preloading is disabled, we only keep the previews and unload anything else
    if (preloadingDisabled) {
        if (allowedReadyState ?? currentReadyState >= VisualReadyState.PREVIEW) return VisualReadyState.PREVIEW;
        return VisualReadyState.NONE;
    }

    if (allowedReadyState != null) return allowedReadyState;
    if (currentReadyState === VisualReadyState.ERROR) return VisualReadyState.PREVIEW;

    return currentReadyState ?? VisualReadyState.NONE;
}

export const useReadyState = (): VisualReadyState => {
    const context = usePreloadingContext();
    const position = useMediaPosition();
    return getReadyState(context.readyStates, position);
}

export const useUpdateReadyState = (): (readyState: VisualReadyState) => unknown => {
    const context = usePreloadingContext();
    const position = useMediaPosition();
    return (readyState: VisualReadyState) => {
        context.updateReadyState(
            readyState,
            position.chunkPosition,
            position.carouselPosition,
        );
    }
}