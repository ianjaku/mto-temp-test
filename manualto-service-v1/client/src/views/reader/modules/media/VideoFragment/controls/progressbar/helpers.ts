import * as React from "react";

const isTouchEvent = (
    event: React.MouseEvent | React.TouchEvent
): event is React.TouchEvent => {
    return (event as React.TouchEvent)?.touches != null;
}

export const calculateMouseXInElement = (
    el: HTMLElement,
    event: React.MouseEvent | React.TouchEvent
): number => {
    if (el == null) return 0;
    const width = el.offsetWidth;
    const offsetLeft = el.getBoundingClientRect().left;
    let left: number;
    if (isTouchEvent(event)) {
        left = event.touches[0].clientX;
    } else {
        left = event.clientX;
    }
    return Math.max((left - offsetLeft) / width, 0);
}

export const formatSeconds = (totalSeconds: number): string => {
    const seconds = totalSeconds % 60;
    const secondsFormatted = seconds > 9 ? seconds.toString() : `0${seconds}`;
    const minutes = Math.floor(totalSeconds / 60);
    const minutesFormatted = minutes > 9 ? minutes.toString() : `0${minutes}`;
    return `${minutesFormatted}:${secondsFormatted}`
}