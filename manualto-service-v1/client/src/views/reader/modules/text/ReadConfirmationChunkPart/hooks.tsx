import {
    EventProperties,
    ReaderEvent,
    captureFrontendEvent
} from "@binders/client/lib/thirdparty/tracking/capture";
import { useEffect, useRef } from "react";

export function useCaptureDisplayEvent(
    isActive: boolean,
    eventProps: EventProperties,
) {
    const displayEventCaptured = useRef(false);
    useEffect(() => {
        if (!isActive || displayEventCaptured.current) {
            return;
        }
        displayEventCaptured.current = true;
        captureFrontendEvent(ReaderEvent.DocumentReadConfirmationDisplayed, eventProps);
    }, [eventProps, isActive]);
}