import { LAUNCH_DARKLY_OVERRIDDEN_FLAGS_WINDOW_PROP, LDFlags } from "@binders/client/lib/launchdarkly";
import { createStore, useStore } from "zustand";

export type LaunchDarklyFlagsStoreActions = {
    setLaunchDarklyFlags: (ldFlags: Record<LDFlags, unknown>) => void;
    getLaunchDarklyFlags: () => Record<LDFlags, unknown>;
};

export type LaunchDarklyFlagsStoreState = {
    launchDarklyFlags: Record<LDFlags, unknown>;
};

export type LaunchDarklyFlagsStore = LaunchDarklyFlagsStoreState & {
    actions: LaunchDarklyFlagsStoreActions;
};

const launchDarklyFlagsStore = createStore<LaunchDarklyFlagsStore>((set, get) => ({
    launchDarklyFlags: undefined,
    actions: {
        getLaunchDarklyFlags() {
            const ldFlags = get().launchDarklyFlags;
            // flags in window object are used to override regular LD flags (use case: e2e tests)
            const flagsInWindowObject = typeof window !== "undefined" && window && window[LAUNCH_DARKLY_OVERRIDDEN_FLAGS_WINDOW_PROP];
            return {
                ...ldFlags,
                ...flagsInWindowObject
            };
        },
        setLaunchDarklyFlags(ldFlags) {
            set({ launchDarklyFlags: ldFlags });
        }
    },
}));

function useLaunchDarklyFlagsStore(): LaunchDarklyFlagsStore {
    const store = useStore(launchDarklyFlagsStore);
    return store;
}

export function useLaunchDarklyFlagsStoreActions(): LaunchDarklyFlagsStoreActions {
    const { actions } = useLaunchDarklyFlagsStore();
    return actions;
}

/**
* @deprecated use hook functions instead
*/
export const LaunchDarklyFlagsStoreGetters = {
    getLaunchDarklyFlags() {
        const { actions: { getLaunchDarklyFlags } } = launchDarklyFlagsStore.getState();
        return getLaunchDarklyFlags();
    }
}
