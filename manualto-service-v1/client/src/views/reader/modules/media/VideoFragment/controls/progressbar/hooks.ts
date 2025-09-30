import { useEffect, useState } from "react"

export const useEventListeners = (
    el: HTMLElement,
    events: string[],
    callback: () => void
): void => {
    useEffect(() => {
        if (el == null) return;
        events.forEach(event => el.addEventListener(event, callback));
        return () => events.forEach(event => el.removeEventListener(event, callback));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [el])
}

const isPlaying = (videoEl: HTMLVideoElement): boolean => {
    return videoEl.currentTime > 0 && !videoEl.paused && !videoEl.ended && videoEl.readyState > 2
}

export const useIsPlaying = (videoEl: HTMLVideoElement): boolean => {
    const [playing, setPlaying] = useState(videoEl ? isPlaying(videoEl) : false);

    useEffect(() => {
        if (videoEl == null) return;
        const update = () => setPlaying(isPlaying(videoEl));
        const events = ["change", "play", "ended", "reset", "playing", "abort", "progress", "timeupdate"];
        events.forEach(event => videoEl.addEventListener(event, update));
        update();
        return () => events.forEach(event => videoEl.removeEventListener(event, update));
    }, [videoEl])

    return playing;
}

export const useVideoDurationSec = (videoEl: HTMLVideoElement): number => {
    const [durationSec, setDurationSec] = useState(() => {
        if (videoEl == null) return 0;
        if (isNaN(videoEl.duration)) return 0;
        return videoEl.duration;
    });

    useEventListeners(videoEl, ["canplay", "canplaythrough"], () => {
        if (!isNaN(videoEl.duration)) {
            setDurationSec(videoEl.duration);
        }
    });

    return durationSec;
}