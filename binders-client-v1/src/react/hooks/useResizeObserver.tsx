import { MutableRefObject, useEffect, useRef } from "react";

/**
 * Listen to changes of the size of an html element.
 * 
 * @param targetElementRef 
 * @param onChange gets called whenever the size of "targetElementRef" changes.
 */
export const useResizeObserver = (
    targetElementRef: MutableRefObject<HTMLElement>,
    onChange: (newDimensions: { widthPx: number, heightPx: number }) => void
): void => {

    const onChangeRef = useRef(onChange);
    useEffect(() => {
        onChangeRef.current = onChange
    }, [onChange]);
    
    useEffect(() => {
        if (targetElementRef.current == null) return () => null;

        const resizeObserver = new ResizeObserver((entries) => {
            if (entries.length === 0) return;
            const entry: ResizeObserverEntry = entries[0];

            onChangeRef.current({
                widthPx: entry.contentRect.width,
                heightPx: entry.contentRect.height
            });
        });

        resizeObserver.observe(targetElementRef.current);

        return () => resizeObserver.disconnect();
    }, [targetElementRef]);
}
