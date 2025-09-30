import * as React from "react";
import { FC, useCallback, useEffect, useMemo, useState } from "react";
import { useEventListeners, useIsPlaying, useVideoDurationSec } from "./hooks";
import { CustomSlider } from "./custom_slider/custom_slider";
import { MIN_DURATION_ALWAYS_SHOW_CONTROLS_SEC } from "../../constants";
import debounce from "lodash.debounce";
import { useRibbonsBottomHeight } from "@binders/ui-kit/lib/compounds/ribbons/hooks";
import "./progressbar.styl";

export const ProgressBar: FC<{
    videoEl: HTMLVideoElement,
    withAudio?: boolean,
    startTimeMs?: number,
    endTimeMs?: number,
}> = ({ videoEl, startTimeMs, endTimeMs }) => {
    const [sliderValue, setSliderValue] = useState(0);
    const [changingProgress, setChangingProgress] = useState(false);
    const isPlaying = useIsPlaying(videoEl);
    const totalDurationSec = useVideoDurationSec(videoEl);
    const ribbonsBottomHeight = useRibbonsBottomHeight();
    const startTimeSec = (startTimeMs ?? 0) / 1000;

    // Calculate the duration taking into account the startTimeMs and endTimeMs
    const trimmedDurationSec = useMemo(() => {
        if (endTimeMs == null) return totalDurationSec - startTimeSec;
        const endTimeSec = endTimeMs / 1000;
        const actualEndTimeSec = Math.min(totalDurationSec, endTimeSec);
        return Math.max(0, actualEndTimeSec - startTimeSec);
    }, [totalDurationSec, startTimeSec, endTimeMs]);

    useEventListeners(videoEl, ["playing"], () => setChangingProgress(false));

    useEffect(() => {
        if (videoEl == null || !isPlaying || changingProgress) return;
        const handler = () => {
            const newSliderValue = (videoEl.currentTime - startTimeSec) / trimmedDurationSec
            if (!isNaN(newSliderValue)) {
                setSliderValue(newSliderValue);
            }
        }
        const handle = setInterval(handler, 20)
        return () => clearInterval(handle);
    }, [videoEl, trimmedDurationSec, isPlaying, changingProgress, startTimeSec])

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const setVideoTime = useCallback(debounce((newTimeSec: number) => {
        if (videoEl == null) return;
        const scaledTimeSec = newTimeSec + startTimeSec;
        videoEl.currentTime = scaledTimeSec
    }, 200), [videoEl])

    const onSliderChange = (value: number) => {
        if (videoEl == null) return;
        setSliderValue(value);
        setChangingProgress(true);
        setVideoTime(trimmedDurationSec * value)
    }
    
    if (videoEl == null) return null;
    if (trimmedDurationSec < MIN_DURATION_ALWAYS_SHOW_CONTROLS_SEC) return null;
    return (
        <div
            className={"progressbar"}
            onClick={e => e.stopPropagation()}
            style={{
                marginBottom: ribbonsBottomHeight
            }}
        >
            <CustomSlider 
                totalDuration={trimmedDurationSec}
                value={sliderValue}
                onChange={v => onSliderChange(v)}
            />
        </div>
    )
}
