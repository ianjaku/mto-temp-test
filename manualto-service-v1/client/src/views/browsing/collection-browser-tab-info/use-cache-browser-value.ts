import { useEffect, useState } from "react";
import { useHistory } from "react-router";


function isBrowsePath(path: string | null) {
    return path != null && path.includes("/browse/");
}

let _prevPath: string | null = null;
const _prevValues = {};

export type CacheBrowserValue = {
    value: string,
    cacheValue: (value: string) => void
};

export function useCacheBrowserValue(uniqueId: string): CacheBrowserValue {
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