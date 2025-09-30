import * as React from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { IDims } from "@binders/client/lib/clients/imageservice/v1/contract";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import { PlayButtonOverlay } from "./PlayButtonOverlay";
import { VideoProgress } from "./VideoProgress";
import { VisualSettings } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { asHexColor } from "@binders/ui-kit/lib/elements/thumbnail/index";
import { useActiveAccountId } from "../../../accounts/hooks";
import { useActiveDocument } from "../../../browsing/hooks";
import { useLaunchDarklyFlagValue } from "@binders/ui-kit/lib/thirdparty/launchdarkly/hooks";
import { useUpdateVisualTrimSettings } from "../../../content/hooks";
import "./VideoEditView.styl";

export type VideoViewProps = {
    chunkIdx: number;
    endTimeMs: number;
    screenshotUrl: string | undefined;
    shouldSupportTrimming?: boolean;
    src: IDims & { url: string };
    startTimeMs: number;
    viewport: IDims;
    visualIdx: number;
    visualSettings: VisualSettings
}

export const VideoEditView: React.FC<VideoViewProps> = ({
    chunkIdx,
    endTimeMs,
    screenshotUrl,
    shouldSupportTrimming = true,
    src,
    startTimeMs,
    viewport,
    visualIdx,
    visualSettings,
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isVideoLoaded, setIsVideoLoaded] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [trimStart, setTrimStart] = useState(0);
    const [trimEnd, setTrimEnd] = useState(1);
    const trimStartSec = trimStart * duration;
    const trimEndSec = trimEnd * duration;
    const updateTrimSettings = useUpdateVisualTrimSettings({});
    const accountId = useActiveAccountId();
    const binderId = useActiveDocument();
    const durationMs = duration * 1000;
    const isVideoTrimmingFeatureEnabled = useLaunchDarklyFlagValue<boolean>(LDFlags.VIDEO_TRIMMING);

    const loopTrim = true;
    const EPS = 0.03; // 30ms guard for float drift

    const togglePlayPause = () => {
        if (!videoRef.current) {
            return;
        }
        if (isPlaying) {
            videoRef.current.pause();
            setIsPlaying(false);
        } else {
            videoRef.current.play();
            setIsPlaying(true);
        }
    };

    const onLoadedMetadata = () => {
        if (videoRef.current) {
            const duration = videoRef.current.duration || 0;
            const durationMs = duration * 1000;
            setDuration(duration);
            if (durationMs < 1) return;
            if (isVideoTrimmingFeatureEnabled) {
                setTrimStart((startTimeMs ?? 0) / durationMs);
                setTrimEnd((endTimeMs ?? durationMs) / durationMs);
            }
            if ((startTimeMs ?? 0) > 0) {
                videoRef.current.currentTime = startTimeMs / 1000;
                setCurrentTime(startTimeMs / 1000);
            }
            setIsVideoLoaded(true);
        }
    };

    const onTimeUpdate = () => {
        const v = videoRef.current!;
        if (!v) return;
        setCurrentTime(v.currentTime ?? 0);

        // keep within left edge
        if (v.currentTime < trimStartSec - EPS) {
            v.currentTime = trimStartSec;
            return;
        }

        // stop/loop at right edge
        if (v.currentTime >= trimEndSec - EPS) {
            if (loopTrim) {
                v.currentTime = trimStartSec;
                // .play() may be blocked on iOS if not user-gesture; usually OK during ongoing play
                v.play().catch(() => { });
            } else {
                v.pause();
                v.currentTime = trimEndSec; // or trimStartSec if you prefer
            }
        }
    };

    const seekTo = (percent: number) => {
        const newTime = percent * duration;
        videoRef.current.currentTime = newTime;
        setCurrentTime(newTime);
    };

    const videoPreviewStyleObject = {
        backgroundColor: asHexColor(visualSettings.bgColor),
        width: `${viewport.width}px`,
        height: `${viewport.height}px`,
    };

    const videoStyleObject = useMemo((): React.CSSProperties => {
        return {
            width: "100%",
            height: "100%",
            margin: "auto",
            objectFit: visualSettings.fitBehaviour === "fit" ? "contain" : "cover",
            ...(visualSettings.rotation != null ? { transform: `rotate(${visualSettings.rotation}deg)` } : {}),
        };
    }, [visualSettings.fitBehaviour, visualSettings.rotation]);

    const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;

    const updateTrimSettingsMutation = useCallback((startTimeMs: number, endTimeMs: number) => {
        updateTrimSettings.mutate({
            accountId,
            binderId,
            visualIdx,
            chunkIdx,
            startTimeMs,
            endTimeMs,
        });
    }, [accountId, binderId, chunkIdx, visualIdx, updateTrimSettings]);

    return (
        <div className="video-wrapper">
            <div className="video-preview" style={videoPreviewStyleObject}>
                <video
                    poster={screenshotUrl}  // On iOS, the poster image is not displayed until the video is played, so we use the screenshot as a placeholder
                    ref={videoRef}
                    width={videoStyleObject.width || 500}
                    src={src.url}
                    muted={!visualSettings.audioEnabled}
                    style={videoStyleObject}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                    onClick={togglePlayPause}
                    onLoadedMetadata={onLoadedMetadata}
                    onLoadStart={() => { setIsVideoLoaded(false) }}
                    onTimeUpdate={onTimeUpdate}
                />
                {!isPlaying && (
                    <PlayButtonOverlay onClick={togglePlayPause} />
                )}
            </div>
            <VideoProgress
                className="video-progress"
                disabled={!isVideoLoaded}
                durationSeconds={duration}
                isTrimmingDisabled={!isVideoTrimmingFeatureEnabled || !shouldSupportTrimming}
                onTrimChange={(start, end) => {
                    setTrimStart(start);
                    setTrimEnd(end);
                }}
                onTrimCommit={(start, end) => {
                    setTrimStart(start);
                    setTrimEnd(end);
                    updateTrimSettingsMutation(start * durationMs, end * durationMs);
                }}
                progress={progress}
                seekTo={seekTo}
                trimStart={trimStart}
                trimEnd={trimEnd}
                width={viewport.width}
            />
        </div>
    );
}
