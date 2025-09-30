import * as React from "react";
import { useActiveChunkIndex } from "../../../../stores/hooks/chunk-position-hooks";
import { useChunkPositionStoreActions } from "../../../../stores/zustand/chunk-position-store";

const { useCallback } = React;

export type UseClosestChunk = {
    closest: number;
    setClosest: (newClosest: number) => void;
}

export function useClosestChunk({ chunkImagesMap }: { chunkImagesMap: number[] }): UseClosestChunk {
    const closest = useActiveChunkIndex();
    const { setClosestChunkWithImageIndex, setActiveChunkIndex } = useChunkPositionStoreActions();
    const setClosest = useCallback((newClosest: number) => {
        setTimeout(() => {
            setActiveChunkIndex(newClosest);
            if (chunkImagesMap) {
                setClosestChunkWithImageIndex(chunkImagesMap[newClosest]);
            }
        }, 0);
    }, [chunkImagesMap, setClosestChunkWithImageIndex, setActiveChunkIndex]);

    return {
        closest,
        setClosest,
    }
}
