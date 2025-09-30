import * as React from "react";
import { MIN_TOP_PADING_CHUNK_SQUARE } from "./constants";
import { findClosest } from "../../../../utils/boundaries";
import { getChunkElements } from "./utils";
import { isSquared } from "../../../../utils/viewport";

const { useCallback, useState } = React;

export type UseChunkBoundariesProps = {
    setClosest: (newClosest: number) => void;
    textModuleRef: React.RefObject<HTMLElement>;
};

export type UseChunkBoundaries = {
    boundariesMap: [number, number][];
    recalculateBoundariesMap: (isLandscape: boolean) => void;
}

export function useChunkBoundaries({ setClosest, textModuleRef }: UseChunkBoundariesProps): UseChunkBoundaries {
    const [boundariesMap, setBoundariesMap] = useState<UseChunkBoundaries["boundariesMap"]>();

    const recalculateBoundariesMap = useCallback((isLandscape: boolean) => {
        if (!textModuleRef.current) return [];
        const chunkEls = getChunkElements(textModuleRef.current);
        const newBoundariesMap: [number, number][] = [];
        for (const i in chunkEls) {
            const el = chunkEls[i] as HTMLElement;
            const top = isSquared() ? el.offsetTop - MIN_TOP_PADING_CHUNK_SQUARE : el.offsetTop;
            const bottom = el.offsetTop + el.clientHeight;
            newBoundariesMap.push([top, bottom]);
        }
        setBoundariesMap(newBoundariesMap);
        const isSame = boundariesMap?.length === newBoundariesMap.length && boundariesMap[0][1] === newBoundariesMap[0][1] && boundariesMap[boundariesMap.length - 1][1] === newBoundariesMap[newBoundariesMap.length - 1][1]
        if (!isSame) {
            setClosest(findClosest(isLandscape, newBoundariesMap));
        }
    }, [boundariesMap, setClosest, textModuleRef]);

    return {
        boundariesMap,
        recalculateBoundariesMap,
    }
}
