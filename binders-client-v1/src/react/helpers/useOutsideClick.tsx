import { RefObject, useCallback, useEffect, useRef } from "react";

export function useOutsideClick<T extends Element>(callback: (event?: MouseEvent) => void): RefObject<T> {
    const ref = useRef<T>(null);

    const handleClickOutside = useCallback((event: MouseEvent) => {
        if (ref.current && !ref.current.contains(event.target as Node)) {
            callback(event);
        }
    }, [callback]);

    useEffect(() => {
        setTimeout(() => {
            // reason for setTimeout: in the playwright tests a timing issue occurred where an
            // unrelated preceding click triggering a modal was considered an "outside click" of it
            window.addEventListener("mousedown", handleClickOutside);
            window.addEventListener("touchstart", handleClickOutside);
        }, 200);
        return () => {
            setTimeout(() => {
                window.removeEventListener("mousedown", handleClickOutside);
                window.removeEventListener("touchstart", handleClickOutside);
            }, 250);
        };
    }, [handleClickOutside]);

    return ref;
}