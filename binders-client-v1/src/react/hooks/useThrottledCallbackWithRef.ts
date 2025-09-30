import { useRef } from "react";

export const useThrottledCallbackWithRef = <T>(
    func: (...args: T[]) => unknown,
    delayMs: number
): ((...args: T[]) => void) => {
    const isOnCooldown = useRef(false);
    return (...args: T[]) => {
        if (isOnCooldown.current) {
            return;
        }
        isOnCooldown.current = true;
        setTimeout(() => isOnCooldown.current = false, delayMs);
        func(...args);
    }
}
