import * as React from "react";
import { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { calculateMouseXInElement, formatSeconds } from "../helpers";
import { useThrottledCallback } from "@binders/client/lib/react/hooks/useThrottledCallback";
import "./custom_slider.styl";


export const CustomSlider: FC<{
    totalDuration: number,
    onChange: (newValue: number) => void,
    value: number
}> = ({ value, onChange, totalDuration }) => {
    const [dragging, setDragging] = useState(false);
    const [internalValue, setInternalValue] = useState(value);
    const [cursorValue, setCursorValue] = useState(0);
    const wrapperEl = useRef<HTMLDivElement>();
    const barEl = useRef<HTMLDivElement>();
    const indicatorEl = useRef<HTMLDivElement>();

    const updateProgress = (event: React.MouseEvent | React.TouchEvent, ignoreDragging = false) => {
        if (barEl.current == null) return;
        const newValue = calculateMouseXInElement(barEl.current, event);
        if (dragging || ignoreDragging) {
            setInternalValue(newValue)
            onChange(newValue);
            updateCursorValue(event);
        }
    }

    useEffect(() => {
        if (dragging) return;
        setInternalValue(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value])

    const isTouchEvent = (
        event: React.MouseEvent | React.TouchEvent
    ): event is React.TouchEvent => {
        return "touches" in event.nativeEvent;
    }

    const setCursorValueThrottled = useThrottledCallback(
        (event: React.MouseEvent | React.TouchEvent) => {
            setCursorValue(calculateMouseXInElement(wrapperEl.current, event));
        },
        50
    );

    const updateCursorValue = useCallback((event) => {
        let posX: number;
        if (isTouchEvent(event)) {
            const r = (event.target as HTMLDivElement).getBoundingClientRect();
            posX = event.nativeEvent.touches[0].clientX - r.left;
        } else {
            posX = event.nativeEvent.offsetX;
        }
        indicatorEl.current.style.left = `${posX}px`;
        setCursorValueThrottled(event);
    }, [setCursorValueThrottled])

    const onMouseMove = (event: React.MouseEvent | React.TouchEvent) => {
        event.stopPropagation();
        event.preventDefault();
        updateProgress(event);

        updateCursorValue(event);
    }

    const startDragging = (event: React.MouseEvent | React.TouchEvent) => {
        event.preventDefault();
        event.stopPropagation();
        updateProgress(event, true);
        setDragging(true);
    }

    const stopDragging = useCallback((event: React.MouseEvent | React.TouchEvent) => {
        event.stopPropagation();
        event.preventDefault();
        if (isTouchEvent(event)) {
            (event.target as HTMLDivElement).blur();
            document.body.focus();
            setTimeout(() => {
                document.getElementById("idle")?.focus();
            }, 100)
        }
        setDragging(false);
    }, [])

    const cursorTime = useMemo(() => {
        if (cursorValue === 0 || totalDuration === 0) return 0;
        const totalSeconds = Math.round(totalDuration * cursorValue);
        return formatSeconds(totalSeconds);
    }, [cursorValue, totalDuration])

    return (
        <>
            {dragging && <div
                onMouseMove={(e) => onMouseMove(e)}
                onTouchMove={(e) => onMouseMove(e)}
                className="slider-bg"
            ></div>}
            <div
                className={"slider-wrapper"}
                onMouseDown={(e) => startDragging(e)}
                onTouchStart={(e) => startDragging(e)}
                onTouchMove={(e) => onMouseMove(e)}
                onMouseMove={(e) => onMouseMove(e)}
                onMouseUp={(e) => stopDragging(e)}
                onTouchEnd={(e) => stopDragging(e)}
                onTouchCancel={(e) => stopDragging(e)}
                ref={wrapperEl}
            >
                <div
                    className={`slider-bar ${dragging ? "slider-bar--dragging" : ""}`}
                    ref={barEl}
                >
                    <div
                        className="slider-bar-current"
                        style={{ width: `${internalValue * 100}%`}}
                    ></div>
                </div>
                <div
                    className={`slider-indicator ${dragging && "slider-indicator--dragging"}`}
                    ref={indicatorEl}
                >
                    {cursorTime}
                </div>
            </div>
        </>
    )
}
