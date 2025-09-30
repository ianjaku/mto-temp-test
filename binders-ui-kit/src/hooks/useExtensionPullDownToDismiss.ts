import { RefObject, useCallback, useEffect, useRef } from "react";
import type { MobileViewOptions } from "../elements/modal";
import { isMobilePortraitView } from "../helpers/rwd";

export function useExtensionPullDownToDismiss(
    extensionRef: RefObject<HTMLDivElement>,
    dragHandleRef: RefObject<HTMLDivElement>,
    onDismiss: () => void,
    showExtension?: boolean,
    _mobileViewOptions?: MobileViewOptions,
): void {

    const touchDown = useRef(false);
    const firstTouchPos = useRef(0);
    const initialTransform = useRef("");

    const handleTouchStart = useCallback((e: TouchEvent) => {
        touchDown.current = true;
        firstTouchPos.current = e.touches[0].pageY;
        if (extensionRef.current) {
            initialTransform.current = extensionRef.current.style.transform || "";
        }
    }, [extensionRef]);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        e.preventDefault();
        if (touchDown.current && extensionRef.current) {
            const diff = e.touches[0].pageY - firstTouchPos.current;
            if (diff > 0) { // Only allow dragging downward
                extensionRef.current.style.transform = `translateY(${diff}px)`;
                extensionRef.current.style.transition = "";
                const extensionHeight = extensionRef.current.clientHeight;
                const distanceToTriggerDismiss = extensionHeight / 3;
                if (diff > distanceToTriggerDismiss) {
                    onDismiss();
                    touchDown.current = false;
                }
            }
        }
    }, [extensionRef, onDismiss]);

    const handleTouchEnd = useCallback(() => {
        if (!touchDown.current) return;
        if (extensionRef.current) {
            extensionRef.current.style.transition = "transform 150ms ease-out";
            extensionRef.current.style.transform = initialTransform.current;
        }
        touchDown.current = false;
    }, [extensionRef]);

    useEffect(() => {
        if (!isMobilePortraitView() || !extensionRef.current) {
            return () => {};
        }
        if (!showExtension) {
            extensionRef.current.style.transform = "";
            return () => {};
        }
        extensionRef.current.style.transform = "";
        const targetElement = dragHandleRef.current || extensionRef.current;
        targetElement.addEventListener("touchstart", handleTouchStart, { passive: false });
        targetElement.addEventListener("touchmove", handleTouchMove, { passive: false });
        targetElement.addEventListener("touchend", handleTouchEnd);
        
        return () => {
            targetElement.removeEventListener("touchstart", handleTouchStart);
            targetElement.removeEventListener("touchmove", handleTouchMove);
            targetElement.removeEventListener("touchend", handleTouchEnd);
        };

    }, [extensionRef, dragHandleRef, handleTouchStart, handleTouchEnd, handleTouchMove, showExtension]);
}
