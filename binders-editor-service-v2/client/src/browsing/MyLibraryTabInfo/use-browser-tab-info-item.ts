import { useEffect, useState } from "react";
import DocumentStore from "../../documents/store";
import { useBrowserCache } from "./use-browser-cache";
import { useFluxStoreAsAny } from "@binders/client/lib/react/helpers/hooks";

/**
 * Uses useBrowserCache to cache the given value.
 * If the given value becomes null while still on a /browse/ page
 * then the previous value will be provided until the value is no longer null
 * or the user moves to a non /browse/ page.
 */
export function useBrowserTabInfoItem(
    uniqueId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extractor: (collection: any) => string | null
): string {
    const activeCollection = useFluxStoreAsAny(DocumentStore, (_prevState, store) => store.getFullActiveCollection());

    const [currentValue, setCurrentValue] = useState<string>(null);
    const cache = useBrowserCache(uniqueId)

    useEffect(() => {
        if (activeCollection == null && cache.value != null) {
            setCurrentValue(cache.value);
        }
        if (activeCollection == null) return;
        const value = extractor(activeCollection);
        setCurrentValue(value);
        cache.cacheValue(value);
    }, [activeCollection, cache, extractor]);

    return currentValue;
}
