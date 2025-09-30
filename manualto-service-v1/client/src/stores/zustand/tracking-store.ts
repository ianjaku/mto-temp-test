import { createStore, useStore } from "zustand";
import UUID from "@binders/client/lib/util/uuid";

export type TrackingStoreActions = {
    createTrackingDocumentSessionId: () => void;
};

export type TrackingStoreState = {
    sessionId?: string;
};

type TrackingStore = TrackingStoreState & { actions: TrackingStoreActions; };

/**
* @deprecated use hook functions instead
*/
export const TrackingStoreGetters = {
    getTrackingDocumentSessionId() {
        return getTrackingStoreState().sessionId;
    },
}

const trackingStore = createStore<TrackingStore>(set => ({
    accessibleAccountIds: [],
    actions: {
        createTrackingDocumentSessionId() {
            set(prev => ({ ...prev, sessionId: UUID.randomWithPrefix("ses-") }))
        },
    },
}));

export function getTrackingStoreActions(): TrackingStoreActions {
    return trackingStore.getState().actions;
}

function getTrackingStoreState(): TrackingStoreState {
    return trackingStore.getState();
}

/** @deprecated Use useTrackingStoreState with a selector to **prevent unnecessary rerenders** and **don't select multiple props** */
export function useTrackingStoreState(): TrackingStoreState;
export function useTrackingStoreState<T>(selector: (state: TrackingStore) => T): T;
export function useTrackingStoreState<T>(selector?: (state: TrackingStore) => T) {
    return useStore(trackingStore, selector);
}
