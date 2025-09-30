import { useEffect, useState } from "react";

/**
 * Throttles a function (making it only callable once every {delayMs} milliseconds.
 * 
 * func can be changed as much as you want
 * delayMs should not be changed. If it is changed, the cooldown will immediately reset.
 */
export const useThrottledCallback = <T>(
    func: (...args: T[]) => unknown,
    delayMs: number
): ((...args: T[]) => void) => {
    const [isOnCooldown, setIsOnCooldown] = useState(false);

    useEffect(() => {
        let timeoutId;
        if (isOnCooldown) {
            timeoutId = setTimeout(() => {
                setIsOnCooldown(false);
            }, delayMs)
        }
        return () => {
            clearTimeout(timeoutId);
            setIsOnCooldown(false);
        }
    }, [isOnCooldown, delayMs])

    return (...args: T[]) => {
        if (isOnCooldown) return;
        setIsOnCooldown(true);
        func(...args);
    }
}
