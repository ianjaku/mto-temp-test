import { useEffect, useState } from "react";
import { useHistory } from "react-router";


function isBrowsePath(path: string | null) {
    return path != null && path.includes("/browse/");
}

let _prevPath: string | null = null;
const _prevValues = {};

interface UseBrowserCacheReturnType {
    value: string;
    cacheValue: (value: string) => void;
}

/**
 * Create a cache that will clear when the user moves to a page which is not a /browse/ page
 */
export function useBrowserCache(
    uniqueId: string
): UseBrowserCacheReturnType {
    const history = useHistory();
    const [cachedValue, setCachedValue] = useState(null);
 
    useEffect(() => {
        if (isBrowsePath(_prevPath)) {
            setCachedValue(_prevValues[uniqueId] || null)
        } else {
            setCachedValue(null)
        }
        
        return () => {
            _prevPath = history.location.pathname;
        }
    }, [history, uniqueId]);

    return {
        value: cachedValue,
        cacheValue(value: string) {
            _prevValues[uniqueId] = value;
        }
    };
}