import { FEATURE_STREAMING_DEBUG } from "@binders/client/lib/clients/accountservice/v1/contract";
import { useCallback } from "react";
import { useIsAccountFeatureActive } from "../../../../../../stores/hooks/account-hooks";
import { useMediaPosition } from "../../MediaPositionProvider";
import videojs from "video.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DebugFunction = (...messages: any[]) => void;

export const useStreamingDebugLogger = (): DebugFunction => {
    const debugging = useIsAccountFeatureActive(FEATURE_STREAMING_DEBUG);
    const position = useMediaPosition();
    const debugLog = useCallback((...messages) => {
        // eslint-disable-next-line no-console
        console.log("[STREAMING DEBUG]", `[${position.chunkPosition}.${position.carouselPosition}]`, ...messages);
    }, [position.chunkPosition, position.carouselPosition]);

    if (!debugging) return () => undefined;
    videojs.log.level("debug");
    return debugLog;
}
