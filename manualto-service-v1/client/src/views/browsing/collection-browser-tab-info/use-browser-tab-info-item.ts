import { useEffect, useState } from "react";
import {
    useBinderStoreState
} from "../../../stores/zustand/binder-store";
import { useCacheBrowserValue } from "./use-cache-browser-value";

export function useBrowserTabInfoItem(
    uniqueId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extractor: (activeCollectionInfo: any) => string | null
): string {
    const activeCollectionInfo = useBinderStoreState(state => state.activeCollectionInfo);

    const [currentValue, setCurrentValue] = useState(null);
    const cache = useCacheBrowserValue(uniqueId)

    useEffect(() => {
        if (activeCollectionInfo == null && cache.value != null) {
            setCurrentValue(cache.value);
        }
        if (activeCollectionInfo == null) return;
        const value = extractor(activeCollectionInfo);
        setCurrentValue(value);
        cache.cacheValue(value);
    }, [activeCollectionInfo, cache, extractor]);

    return currentValue;
}
