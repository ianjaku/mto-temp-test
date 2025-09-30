import React from "react";
import { useActiveViewable } from "./binder-hooks";
import { useChunkPositionStore } from "../zustand/chunk-position-store";

export const useActiveChunkIndex = (): number =>
    useChunkPositionStore(store => store.activeChunkIndex);

export const useClosestChunkWithImageIndex = (): number =>
    useChunkPositionStore(store => store.closestChunkImageIndex);

export const useActiveChunkId = (): string | null => {
    const viewable = useActiveViewable();
    const chunkIndex = useActiveChunkIndex();
    return React.useMemo(() => {
        if (viewable == null || chunkIndex == null) {
            return null;
        }
        const currentChunk = viewable.binderLog.current.find(chunk => chunk.position === chunkIndex);
        return currentChunk?.uuid ?? null;
    }, [chunkIndex, viewable]);
}