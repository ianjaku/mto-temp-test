import * as React from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import "./VideoProgress.styl";

export type VideoProgressProps = {
    /** Optional aria label */
    ariaLabel?: string;
    className?: string;
    /** Disable interactions */
    disabled?: boolean;
    /** Total media duration in seconds (used to format time labels) */
    durationSeconds: number;
    /** Disable trimming (hides handles & labels, disables drag/keyboard trim) */
    isTrimmingDisabled?: boolean;
    /** Min distance between handles in percent (0..1). default 0.02 (2%) */
    minTrimGapMs?: number;
    /** Called while user drags either trim handle */
    onTrimChange?: (start: number, end: number) => void;
    /** Called when user releases the trim handle */
    onTrimCommit?: (start: number, end: number) => void;
    /** Current playhead progress [0..1] */
    progress: number;
    /** Click or scrub to seek */
    seekTo?: (percent: number, evt: PointerEvent | MouseEvent) => void;
    /** Optional custom time formatter (ratio 0..1 -> label) */
    timeFormatter?: (ratio: number) => string;
    /** Controlled trim end [0..1] */
    trimEnd?: number;
    /** Controlled trim start [0..1] */
    trimStart?: number;
    /** Width of the bar in px */
    width: number;
};

export const VideoProgress: React.FC<VideoProgressProps> = ({
    ariaLabel = "Video progress",
    className,
    disabled = false,
    durationSeconds,
    isTrimmingDisabled = false,
    minTrimGapMs = 2000,
    onTrimChange,
    onTrimCommit,
    progress,
    seekTo,
    timeFormatter,
    trimEnd: trimEndProp,
    trimStart: trimStartProp,
    width,
}) => {
    const [activeTarget, setActiveTarget] = useState<DragTarget>(null);
    const leftHandleRef = useRef<HTMLDivElement | null>(null);
    const rightHandleRef = useRef<HTMLDivElement | null>(null);
    const playheadRef = useRef<HTMLDivElement | null>(null);
    const [leftHandlePosition, setLeftHandlePosition] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
    const [rightHandlePosition, setRightHandlePosition] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
    const [progressPosition, setProgressPosition] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
    const barRef = useRef<HTMLDivElement | null>(null);
    const isControlled = typeof trimStartProp === "number" && typeof trimEndProp === "number";
    const [internalTrim, setInternalTrim] = useState({ start: 0, end: 1 });

    const trimStart = isControlled ? (trimStartProp as number) : internalTrim.start;
    const trimEnd = isControlled ? (trimEndProp as number) : internalTrim.end;
    const isTrimmingNow = activeTarget === "left" || activeTarget === "right";

    // Stay safely inside the end to avoid loop triggers when previewing the right handle
    const previewEpsRatio = useMemo(() => {
        if (!durationSeconds || durationSeconds <= 0) return 0.01;
        const epsByTime = 0.1 / durationSeconds;
        const epsByPercent = 0.005;
        return Math.max(epsByTime, epsByPercent);
    }, [durationSeconds]);

    const setTrim = (start: number, end: number, commit = false) => {
        if (isTrimmingDisabled) return;
        if (!isControlled) setInternalTrim({ start, end });
        onTrimChange?.(start, end);
        if (commit) onTrimCommit?.(start, end);
    };

    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    const clampToTrim = (p: number) => clamp(Math.max(trimStart, Math.min(trimEnd, p)));

    const percentFromClientX = (clientX: number) => {
        const rect = barRef.current?.getBoundingClientRect();
        if (!rect) return 0;
        return clamp((clientX - rect.left) / rect.width);
    };

    type DragTarget = "left" | "right" | "seek" | null;
    const dragTarget = useRef<DragTarget>(null);
    const startVals = useRef({ start: trimStart, end: trimEnd });

    const defaultTimeFormatter = useCallback((ratio: number) => {
        const dur = durationSeconds ?? 0;
        const totalMs = Math.max(0, Math.round(ratio * dur * 1000));
        const totalSec = Math.floor(totalMs / 1000);
        const s = totalSec % 60;
        const totalMin = Math.floor(totalSec / 60);
        const m = totalMin % 60;
        const h = Math.floor(totalMin / 60);
        const pad = (n: number, w = 2) => String(n).padStart(w, "0");
        return `${pad(h)}:${pad(m)}:${pad(s)}`;
    }, [durationSeconds]);

    const timeFmt = timeFormatter ?? defaultTimeFormatter;
    const minTrimGapRatio = durationSeconds > 0 ? minTrimGapMs / (durationSeconds * 1000) : 0;

    const onPointerDown = (
        e: React.PointerEvent<HTMLDivElement>,
        target: DragTarget
    ) => {
        if (disabled) return;
        if (isTrimmingDisabled && (target === "left" || target === "right")) return;

        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
        dragTarget.current = target;
        startVals.current = { start: trimStart, end: trimEnd };
        setActiveTarget(target);

        document.body.style.userSelect = "none";
        document.body.style.cursor = target === "left" || target === "right" ? "ew-resize" : "grabbing";

        if (target === "seek") {
            const p = percentFromClientX(e.clientX);
            const snapped = Math.min(Math.max(p, trimStart), trimEnd);
            seekTo?.(snapped, e.nativeEvent);
        } else if (target === "left") {
            seekTo?.(trimStart, e.nativeEvent);
        } else if (target === "right") {
            const preview = clamp(Math.max(trimStart, trimEnd - previewEpsRatio));
            seekTo?.(preview, e.nativeEvent);
        }
    };

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const target = dragTarget.current;
        if (!target) return;
        if (isTrimmingDisabled && (target === "left" || target === "right")) return;

        const p = percentFromClientX(e.clientX);
        const gap = Math.max(0, minTrimGapRatio);

        const leftBbox = leftHandleRef.current.getBoundingClientRect();
        setLeftHandlePosition({ x: leftBbox.x + leftBbox.width / 2, y: leftBbox.y });
        const rightBbox = rightHandleRef.current.getBoundingClientRect();
        setRightHandlePosition({ x: rightBbox.x + rightBbox.width / 2, y: rightBbox.y });

        if (target === "left") {
            const nextStart = clamp(Math.min(p, trimEnd - gap));
            setTrim(nextStart, trimEnd);
            seekTo?.(nextStart, e.nativeEvent);
        } else if (target === "right") {
            const nextEnd = Math.max(p, trimStart + gap);
            const clampedEnd = clamp(nextEnd);
            setTrim(trimStart, clampedEnd);
            const preview = clamp(Math.max(trimStart, clampedEnd - previewEpsRatio));
            seekTo?.(preview, e.nativeEvent);
        } else if (target === "seek") {
            const bbox = playheadRef.current.getBoundingClientRect();
            setProgressPosition({ x: bbox.x + bbox.width / 2, y: bbox.y });
            const pClamped = clampToTrim(p);
            seekTo?.(pClamped, e.nativeEvent);
        }
    };

    const endDrag = () => {
        if (!dragTarget.current) return;
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        if (dragTarget.current === "left" || dragTarget.current === "right") {
            seekTo?.(trimStart, new PointerEvent("pointerup"));
        }
        onTrimCommit?.(trimStart, trimEnd);
        dragTarget.current = null;
        setActiveTarget(null);
    };

    const onKeyDownHandle = (
        e: React.KeyboardEvent<HTMLDivElement>,
        handle: "left" | "right"
    ) => {
        if (disabled || isTrimmingDisabled) return;
        const stepPct = 1 / 100;
        let delta = 0;
        if (e.key === "ArrowLeft") delta = -stepPct;
        else if (e.key === "ArrowRight") delta = stepPct;
        else return;

        e.preventDefault();
        if (handle === "left") {
            const next = clamp(Math.min(trimEnd - minTrimGapRatio, trimStart + delta));
            setTrim(next, trimEnd);
        } else {
            const next = clamp(Math.max(trimStart + minTrimGapRatio, trimEnd + delta));
            setTrim(trimStart, next);
        }
    };

    const selectedWidth = Math.max(0, trimEnd - trimStart) * 100;
    const selectedLeft = trimStart * 100;
    const playheadLeft = clamp(progress) * 100;
    const progressWithin = trimEnd > trimStart ? clamp((progress - trimStart) / (trimEnd - trimStart)) : 0;
    const showLabels = !isTrimmingDisabled && (activeTarget === "left" || activeTarget === "right");

    return (
        <div
            ref={barRef}
            style={{ width: `${width}px` }}
            className={`${className} video-progress ${disabled ? "is-disabled" : ""}`}
            role="progressbar"
            aria-label={ariaLabel}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            onPointerDown={(e) => onPointerDown(e, "seek")}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
        >
            <div className="video-progress-bar" />

            {
                showLabels ?
                    (
                        <div
                            className={`video-progress-label ${activeTarget === "left" ? "is-active" : ""}`}
                            style={{ left: leftHandlePosition.x, top: leftHandlePosition.y }}
                        >
                            {timeFmt(trimStart)}
                        </div>
                    ) :
                    null
            }
            <div
                className="video-progress-unselected left"
                style={{ left: 0, width: `${selectedLeft}%` }}
                aria-hidden
            />

            <div
                className="video-progress-selected"
                style={{ left: `${selectedLeft}%`, width: `${selectedWidth}%` }}
            >
                <div
                    className="video-progress-fill"
                    style={{
                        left: 0,
                        right: `${100 - Math.max(0, Math.min(100, progressWithin * 100))}%`
                    }}
                    aria-hidden
                />
            </div>

            {
                showLabels ?
                    (
                        <div
                            className={`video-progress-label ${activeTarget === "right" ? "is-active" : ""}`}
                            style={{ left: rightHandlePosition.x, top: rightHandlePosition.y }}
                        >
                            {timeFmt(trimEnd)}
                        </div>
                    ) :
                    null
            }
            <div
                className="video-progress-unselected right"
                style={{
                    left: `${trimEnd * 100}%`,
                    width: `${100 - trimEnd * 100}%`,
                }}
                aria-hidden
            />

            {activeTarget === "seek" && (
                <div className="video-progress-label" style={{ left: progressPosition.x, top: progressPosition.y }}>
                    {timeFmt(progress)}
                </div>
            )}

            {!isTrimmingNow && (
                <div
                    ref={playheadRef}
                    className="video-progress-bar-playhead"
                    style={{ left: `${playheadLeft}%` }}
                    role="slider"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(playheadLeft)}
                    aria-orientation="horizontal"
                />
            )}

            {!isTrimmingDisabled &&
                <div
                    className="video-progress-bar-trim-handle video-progress-bar-trim-handle-left"
                    ref={leftHandleRef}
                    style={{ left: `${selectedLeft}%` }}
                    role="slider"
                    tabIndex={0}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(selectedLeft)}
                    aria-orientation="horizontal"
                    onPointerDown={(e) => {
                        e.stopPropagation();
                        onPointerDown(e, "left");
                    }}
                    onKeyDown={(e) => onKeyDownHandle(e, "left")}
                />
            }

            {!isTrimmingDisabled &&
                <div
                    className="video-progress-bar-trim-handle video-progress-bar-trim-handle-right"
                    ref={rightHandleRef}
                    style={{ left: `${trimEnd * 100}%` }}
                    role="slider"
                    tabIndex={0}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(trimEnd * 100)}
                    aria-orientation="horizontal"
                    onPointerDown={(e) => {
                        e.stopPropagation();
                        onPointerDown(e, "right");
                    }}
                    onKeyDown={(e) => onKeyDownHandle(e, "right")}
                />
            }
        </div>
    );
}
