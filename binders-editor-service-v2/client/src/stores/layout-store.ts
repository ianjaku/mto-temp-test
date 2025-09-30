import { createStore, useStore } from "zustand";

export type LayoutStoreActions = {
    setHeaderTailElement: (element: React.ReactNode) => void;
};

export type LayoutStoreState = {
    headerTailElement?: React.ReactNode;
};

export type LayoutStore = LayoutStoreState & {
    actions: LayoutStoreActions;
};

const layoutStore = createStore<LayoutStore>(set => ({
    headerTailElement: null,
    actions: {
        setHeaderTailElement(headerTailElement) {
            set(prev => ({ ...prev, headerTailElement }))
        },
    },
}));

/** @deprecated Use useLayoutStoreState with a selector to **prevent unnecessary rerenders** and **don't select multiple props** */
export function useLayoutStoreState(): LayoutStoreState;
export function useLayoutStoreState<T>(selector: (state: LayoutStore) => T): T;
export function useLayoutStoreState<T>(selector?: (state: LayoutStore) => T) {
    return useStore(layoutStore, selector);
}

export function useLayoutStoreActions(): LayoutStoreActions {
    const actions = useLayoutStoreState(state => state.actions);
    return actions;
}

