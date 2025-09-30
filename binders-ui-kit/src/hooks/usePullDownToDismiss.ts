import { useCallback, useEffect, useMemo, useRef } from "react";
import { MobileViewOptions } from "../elements/modal";
import { isMobileView } from "../helpers/rwd";

export function usePullDownToDismiss(
    modal: HTMLDivElement,
    dragHandle: HTMLDivElement,
    onDismiss: () => Promise<void>,
    mobileViewOptions?: MobileViewOptions,
): void {

    const touchDown = useRef(false);
    const firstTouchPos = useRef(0);

    const distanceToTriggerDismiss = useMemo(() => {
        const modalHeight = modal?.clientHeight;
        return modalHeight && modalHeight / 3;
    }, [modal]);

    const handleTouchStart = useCallback((e: TouchEvent) => {
        touchDown.current = true;
        firstTouchPos.current = e.touches[0].pageY;
    }, []);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        e.preventDefault();
        if (touchDown.current && distanceToTriggerDismiss && modal) {
            const diff = e.touches[0].pageY - firstTouchPos.current;
            modal.style.bottom = `-${diff}px`;
            if (diff > distanceToTriggerDismiss) {
                onDismiss();
                touchDown.current = false;
            }
        }
    }, [distanceToTriggerDismiss, modal, onDismiss]);

    const handleTouchEnd = useCallback(() => {
        if (!touchDown.current) return;
        if (modal) modal.style.bottom = "0";
        touchDown.current = false;
    }, [modal]);

    useEffect(() => {
        if (
            !isMobileView() ||
            (mobileViewOptions && !mobileViewOptions.pulldownToDismiss) ||
            !dragHandle ||
            !modal
        ) {
            return () => {};
        }
        dragHandle.addEventListener("touchstart", handleTouchStart);
        dragHandle.addEventListener("touchmove", handleTouchMove);
        dragHandle.addEventListener("touchend", handleTouchEnd);
        return () => {
            dragHandle.removeEventListener("touchstart", handleTouchStart);
            dragHandle.removeEventListener("touchmove", handleTouchMove);
            dragHandle.removeEventListener("touchend", handleTouchEnd);
        };

    }, [dragHandle, handleTouchStart, handleTouchEnd, handleTouchMove, modal, mobileViewOptions]);



}