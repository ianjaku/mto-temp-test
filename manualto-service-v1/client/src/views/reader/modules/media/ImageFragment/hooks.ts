import QuickPinchZoom from "react-quick-pinch-zoom";
import { useEffect } from "react";
import { usePrevious } from "@binders/client/lib/react/helpers/hooks";

export function useResetZoomOnActivate(
    isActive: boolean,
    pinchZoomRef: React.MutableRefObject<QuickPinchZoom | null>,
): void {
    const prevIsActive = usePrevious(isActive);
    useEffect(() => {
        if (!prevIsActive && isActive) {
            pinchZoomRef.current?.scaleTo({ x: 0, y: 0, scale: 1, animated: false });
        }
    });
}