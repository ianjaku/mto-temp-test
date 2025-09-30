import { create } from "zustand";

type ChunkPositionStoreActions = {
    setActiveChunkIndex: (position: number) => void;
    setClosestChunkWithImageIndex: (position: number) => void;
}

type ChunkPositionStore = {
    activeChunkIndex: number;
    closestChunkImageIndex: number;
    actions: ChunkPositionStoreActions;
}

export const useChunkPositionStore = create<ChunkPositionStore>(set => ({
    activeChunkIndex: 0,
    closestChunkImageIndex: 0,

    actions: {
        setActiveChunkIndex: index => set(() => ({
            activeChunkIndex: index
        })),
        setClosestChunkWithImageIndex: index => set(() => ({
            closestChunkImageIndex: index
        })),
    }
}));

export const resetIndicesToDefault = () => {
    useChunkPositionStore.setState(() => ({
        activeChunkIndex: 0,
        closestChunkImageIndex: 0,
    }));
}

export const useChunkPositionStoreActions = () => useChunkPositionStore(store => store.actions);
