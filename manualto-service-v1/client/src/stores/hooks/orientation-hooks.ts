import { useOrientationStore } from "../zustand/orientation-store";

export const useWaitingForResize = () =>
    useOrientationStore(state => state.waitingForResize);

export const useIsLandscape = (): boolean =>
    useOrientationStore(store => store.isLandscape)