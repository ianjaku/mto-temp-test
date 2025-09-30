import * as React from "react";
import { Dimension, IDims } from "@binders/client/lib/clients/imageservice/v1/contract";
import { EventHandlers, SimplifiedVideoJSOptions, useVideoJsPlayer } from "./useVideoJsPlayer";
import { FC, useEffect, useMemo, useRef, useState } from "react";
import { getShouldAutoPlay, getVisualBackground, getVisualRotation } from "../../visualHelpers";
import { useCanMediaPlayAudio, useMediaId, useVideoPreviewUrl } from "../../hooks";
import { BinderVisual } from "@binders/client/lib/clients/repositoryservice/v3/BinderVisual";
import { FatalVideoError } from "../FatalVideoError";
import Loader from "../../../../../components/loader";
import MuteButton from "../controls/MuteButton";
import { ProgressBar } from "../controls/progressbar/progressbar";
import { VideoMethodDebugger } from "../VideoMethodDebug";
import cx from "classnames";
import { isMediaErrorIgnorable } from "../helpers";
import { originalToDeviceDimension } from "../../../../../../utils/viewport";
import { usePlayButtonVisible } from "./useShowPlayButton";
import { usePrevious } from "@binders/client/lib/react/helpers/hooks";
import { useSources } from "./useSources";
import { useStreamingDebugLogger } from "./useStreamingDebugLogger";
import { useThrottledCallback } from "@binders/client/lib/react/hooks/useThrottledCallback";
import { useVideoTrimming } from "./useVideoTrimming";
import { useWindowSize } from "../../../../../../utils/hooks/useWindowSize";
import videojs from "video.js";
import "../videofragment.styl";
import "video.js/dist/video-js.css";

const unpatchesLogWarn = videojs.log.warn;
videojs.log.warn = function (...args) {
    if (args[0] === "We received no playlist to switch to. Please check your stream.") {
        return;
    }
    unpatchesLogWarn(...args);
}

export interface IVideoFragmentProps {
    media: BinderVisual;
    isActive: boolean;
    enableAudio?: boolean;
    toggleAudio: () => void;
    inErrorState?: boolean;
    onFatalError: (err: FatalVideoError) => void;
    onPlayable: () => void;
    viewportDims: IDims;
}


export const VideoPlayer: FC<IVideoFragmentProps> = (props) => {
    const {
        isActive,
        enableAudio,
        toggleAudio,
        media,
        onFatalError,
        viewportDims,
    } = props;

    const debugLog = useStreamingDebugLogger();
    const videoId = useMediaId(media);
    const autoPlay = getShouldAutoPlay(media);
    const canMediaPlayAudio = useCanMediaPlayAudio(media);

    const videoNode = useRef<HTMLVideoElement>(null);
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);
    const [preloaded, setPreloaded] = useState(false);
    const [paused, setPaused] = useState(!getShouldAutoPlay(media));

    const playEventTriggered = useRef(false);

    const windowSize = useWindowSize();
    const wasActive = usePrevious(isActive);
    const playButtonVisible = usePlayButtonVisible(paused, loading, isActive, autoPlay);

    const videoDimsComputed = useMemo((): IDims => {
        if (!(videoNode?.current)) {
            return;
        }
        const computed = getComputedStyle(videoNode.current);
        return {
            width: parseInt(computed.width, 10),
            height: parseInt(computed.height, 10),
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [windowSize, viewportDims, loading, videoNode]);

    const wrapperDimsComputed = useMemo(() => {
        return {
            width: originalToDeviceDimension(viewportDims.width),
            height: originalToDeviceDimension(viewportDims.height),
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewportDims, windowSize]);

    const sources = useSources(media, viewportDims);

    const playerOptions: SimplifiedVideoJSOptions = useMemo(() => ({
        loop: true,
        muted: !enableAudio || !isActive,
        sources,
    }), [enableAudio, sources, isActive]);

    const eventHandlers: EventHandlers = {
        // nice overview of event lifecycle for videos:
        // https://medium.com/@nathan5x/event-lifecycle-of-html-video-element-part-1-f63373c981d3
        "loadstart": () => {
            debugLog("[EVENT] loadstart");
            setLoading(true);
        },
        "pause": () => {
            debugLog("[EVENT] pause");
            setPaused(true);
        },
        "play": () => {
            debugLog("[EVENT] play");
            playEventTriggered.current = true;
            if (!isActive) {
                // most likely the play event triggered by the autoplay option (MT-4323)
                player.current.pause();
            }
        },
        "playing": () => {
            debugLog("[EVENT] playing");
            setPaused(false);
            setLoading(false);
        },
        "canplay": () => {
            debugLog("[EVENT] canplay");
            props.onPlayable();
            setLoading(false);
        },
        "canplaythrough": () => {
            debugLog("[EVENT] canplaythrough");
            setPreloaded(true);
        },
        "loadeddata": () => {
            debugLog("[EVENT] Loaded data");
        },
        "error": (err: Error) => {
            debugLog("[EVENT] error ", err);
            const error = player.current.error();
            if (!isMediaErrorIgnorable(error || err)) {
                onFatalError(new FatalVideoError(
                    err.message,
                    null,
                    "code" in error ? error.code : null,
                    err.stack
                ));
                setError(true); // TODO: do we still need this?
                // eslint-disable-next-line no-console
                console.error(`error in video with id ${videoId}`, err);
            }
        }
    }

    const player = useVideoJsPlayer(
        videoNode,
        playerOptions,
        eventHandlers,
        videoId,
    );


    const onPlayable = props.onPlayable;
    const handleStartVideoPromise = React.useCallback(async (promise) => {
        try {
            // If for any reason the play() call can't start the video
            // (such as low power mode on ios, or pause() being called while the browser is still trying to get the video to play)
            // an error will be thrown.
            await promise;
        } catch (e) {
            debugLog("[ERROR] Failed to start video with video.play()", e);
        }
        // if the call to play() doesn't trigger a "play" event in videojs,
        // we can assume that autoplay is disabled (eg in iOS low power mode)
        setTimeout(() => {
            if (!playEventTriggered.current) {
                setPaused(true); // Pause the video so the play button appears
                setLoading(false);
                onPlayable(); // mark the video "playable", resulting in the readyState to become Full
            }
        }, 100);
    }, [onPlayable, debugLog]);

    // To play video, we need a user gesture (like click).
    // This user gesture does not propagate through promises in some browsers.
    // Hence this function should not be async.
    const startVideo = React.useCallback(() => {
        const playPromise = player.current.play();
        handleStartVideoPromise(playPromise);
    }, [handleStartVideoPromise, player]);

    useVideoTrimming(player, {
        isVideoActive: isActive,
        isVideoLoading: loading,
        startTimeMs: media.startTimeMs,
        endTimeMs: media.endTimeMs,
    });

    useEffect(() => {
        if (!isActive && wasActive) {
            player.current.pause();
            const mediaStartTimeSec = (media.startTimeMs ?? 0) / 1000;
            player.current.currentTime(mediaStartTimeSec);
        }
    }, [isActive, wasActive, player, videoId, media.startTimeMs]);

    useEffect(() => {
        if (isActive === true && player.current != null && wasActive !== true) {
            if (autoPlay) {
                startVideo();
            }
        }
    }, [autoPlay, isActive, player, startVideo, wasActive]);


    const videoStyleObject = useMemo((): React.CSSProperties => {
        if (error) {
            return {};
        }
        // Only pick half of the desired rotation, videojs applies the style object to both <video> and parent <div>
        const rotation = getVisualRotation(media);
        const transformSuffix = rotation ? ` rotate(${rotation / 2}deg)` : "";
        const playBtnRotation = rotation ? `rotate(-${rotation / 2}deg)` : "rotate(0)";
        const styleObj: React.CSSProperties & { "--_play-btn-rotation": string } = {
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%,-50%) ${transformSuffix}`,
            "--_play-btn-rotation": playBtnRotation,
        };
        const fillDimension = media.getFillDimension({ width: viewportDims.width, height: viewportDims.height });
        if (fillDimension === Dimension.Horizontal) {
            styleObj.width = "100%";
            styleObj.height = "auto";
        } else {
            styleObj.width = "auto";
            styleObj.height = "100%";
        }
        return styleObj;
    }, [error, media, viewportDims]);

    const wrapperStyleObject = useMemo((): React.CSSProperties => {
        if (error) {
            return {};
        }
        return {
            backgroundColor: getVisualBackground(media),
            outline: 0,
        };
    }, [error, media]);

    const shouldRenderMuteButton = useMemo(() => {
        return canMediaPlayAudio && !loading;
    }, [canMediaPlayAudio, loading])

    const toggleVideo = useThrottledCallback(() => {
        if (loading) return;
        if (paused) {
            startVideo();
        } else {
            player.current.pause();
        }
    }, 500);

    const videoPreviewUrl = useVideoPreviewUrl(media, viewportDims);

    return (
        <>
            <div
                className={cx("video-wrapper",
                    { "video-wrapper--error": error },
                    { "playButtonVisible": playButtonVisible },
                    "allow-pointer-events"
                )}
            >
                <div
                    style={{ ...videoStyleObject, ...wrapperStyleObject }}
                    data-vjs-player
                >
                    <video
                        ref={videoNode}
                        className="video-js vjs-default-skin"
                        style={videoStyleObject}
                        playsInline
                        poster={videoPreviewUrl}
                    ></video>
                </div>
                <div className="event-catcher" onClick={() => toggleVideo()}>
                    {shouldRenderMuteButton && (
                        <MuteButton
                            isMuted={!enableAudio}
                            dimsComputed={{ videoDimsComputed, wrapperDimsComputed }}
                            toggleAudio={toggleAudio}
                        />
                    )}
                    {loading && isActive && <Loader text="" doFade={true} appearDelayMs={1000} partialScreen={true} />}
                    <ProgressBar
                        videoEl={videoNode.current}
                        startTimeMs={media.startTimeMs}
                        endTimeMs={media.endTimeMs}
                    />
                </div>
                <input type="hidden" name={`${videoId}-preloaded`} value={preloaded ? "1" : "0"} />
            </div>
            <VideoMethodDebugger message="Streaming" />
        </>
    );
}
