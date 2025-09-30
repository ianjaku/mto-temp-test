import { create } from "zustand";

export type DisclaimerStoreActions = {
    setAllDisclaimersVisibility: (visibility: DisclaimerVisibility) => void;
    setChunkDisclaimerVisibility: (chunkIdx: number, visibility: DisclaimerVisibility) => void;
    toggleAllDisclaimersVisibility: () => void;
    toggleChunkDisclaimerVisibility: (chunkIdx: number) => void;
};

export enum DisclaimerVisibility { Visible, Hidden }

export type DisclaimerStoreState = {
    allVisibility?: DisclaimerVisibility;
    byChunkIdx: Map<number, DisclaimerVisibility>;
};

type DisclaimerStore = DisclaimerStoreState & { actions: DisclaimerStoreActions }

export const useDisclaimerStore = create<DisclaimerStore>(set => ({
    allVisibility: DisclaimerVisibility.Visible,
    byChunkIdx: new Map(),
    actions: {
        setAllDisclaimersVisibility(visibility) {
            set((prev) => ({ ...prev, allVisibility: visibility }));
        },
        setChunkDisclaimerVisibility(chunkIdx, visibility) {
            set(prev => ({ ...prev, byChunkIdx: prev.byChunkIdx.set(chunkIdx, visibility) }));
        },
        toggleAllDisclaimersVisibility() {
            set(prev => ({ ...prev, allVisibility: toggleVisibility(prev.allVisibility) }))
        },
        toggleChunkDisclaimerVisibility(chunkIdx) {
            set(prev => {
                const visibility = prev.byChunkIdx.get(chunkIdx) ?? prev.allVisibility;
                return {
                    ...prev,
                    byChunkIdx: prev.byChunkIdx.set(
                        chunkIdx,
                        toggleVisibility(visibility),
                    ),
                }
            });
        },
    }
}));

function toggleVisibility(vis: DisclaimerVisibility): DisclaimerVisibility {
    switch (vis) {
        case DisclaimerVisibility.Visible:
            return DisclaimerVisibility.Hidden;
        case DisclaimerVisibility.Hidden:
            return DisclaimerVisibility.Visible;
    }
}

export const useDisclaimerStoreActions = (): DisclaimerStoreActions =>
    useDisclaimerStore(store => store.actions);

export const useDisclaimerStoreState = (): DisclaimerStoreState =>
    useDisclaimerStore(store => store);

export const useDisclaimerVisibility = (chunkIdx: number): DisclaimerVisibility | undefined =>
    useDisclaimerStore(store => store.allVisibility ?? store.byChunkIdx.get(chunkIdx));

