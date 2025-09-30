import { RefObject, useEffect } from "react";
import Player from "video.js/dist/types/player";

/**
 * Custom hook that constrains video playback to a specific time window.
 * The video will start at the startTime and loop back to startTime when reaching endTime.
 * Also resets to startTime when the video becomes inactive.
 */
export const useVideoTrimming = (
    playerRef: RefObject<Player>,
    params: {
        startTimeMs?: number,
        endTimeMs?: number,
        isVideoActive?: boolean,
        isVideoLoading?: boolean
    }
) => {
    useEffect(() => {
        if (playerRef.current == null) return;
        if (params.startTimeMs == null && params.endTimeMs == null) return;
        const player = playerRef.current;
        
        let hasSetInitialTime = false;
        
        const canPlayHandler = () => {
            if (params.startTimeMs == null) return;
            // Set video to start at startTime only once when it can first play
            if (!hasSetInitialTime) {
                player.currentTime(params.startTimeMs / 1000);
                hasSetInitialTime = true;
            }
        };
        
        const timeUpdateHandler = () => {
            // Reset to startTime when reaching endTime to maintain time window
            if (params.endTimeMs != null && player.currentTime() > params.endTimeMs / 1000) {
                player.currentTime((params.startTimeMs ?? 0) / 1000);
            }

            if (params.startTimeMs != null && player.currentTime() < params.startTimeMs / 1000) {
                player.currentTime(params.startTimeMs / 1000);
            }
        };
        
        player.on("canplay", canPlayHandler);
        player.on("timeupdate", timeUpdateHandler);
        
        return () => {
            if (player && !player.isDisposed()) {
                player.off("canplay", canPlayHandler);
                player.off("timeupdate", timeUpdateHandler);
            }
        };
    }, [playerRef, params.startTimeMs, params.endTimeMs]);
};