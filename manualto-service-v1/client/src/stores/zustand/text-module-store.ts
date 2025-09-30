import { create } from "zustand";

export type TextModuleStoreActions = {
    setShouldIgnoreScroll: (isExpanded: boolean) => void;
    setActiveChunkPaddingRight: (activeChunkPaddingRight: number) => void;
    setActiveChunkElement: (activeChunkElement: HTMLElement) => void;
    setSidebarWidth: (sidebarWidth: number) => void;
};

export type TextModuleStoreState = {
    // tells TextModule to ignore scrolling events
    // this is useful when a view needs to open a keyboard, as that will trigger scroll events and cause MT-4526
    shouldIgnoreScroll: boolean;
    // right padding for the active chunk. The reason to put this on the chunk instead of the text module is because in case of the latter, the scroll position in the document would unintentionally change, due to all chunks growing in height (due to becoming narrow)
    activeChunkPaddingRight: number;
    activeChunkElement?: HTMLElement;
    sidebarWidth?: number;
    actions: TextModuleStoreActions;
};

export const useTextModuleStore = create<TextModuleStoreState>(set => ({
    /**
     * When true, will stop the user from srolling through the document.
     * Used for example when the reader comments are open on mobile, otherwise the user can still scroll on IOS through the dark overlay.
     */
    shouldIgnoreScroll: false,
    activeChunkPaddingRight: 0,
    actions: {
        setShouldIgnoreScroll: (shouldIgnoreScroll: boolean) => set((prev) => ({ ...prev, shouldIgnoreScroll })),
        setActiveChunkPaddingRight: (activeChunkPaddingRight: number) => set((prev) => ({ ...prev, activeChunkPaddingRight })),
        setActiveChunkElement: (activeChunkElement: HTMLElement) => set((prev) => ({ ...prev, activeChunkElement })),
        setSidebarWidth: (sidebarWidth: number) => set((prev) => ({ ...prev, sidebarWidth }))
    }
}));

export const useTextModuleStoreActions = (): TextModuleStoreActions =>
    useTextModuleStore(store => store.actions);

export const useShouldIgnoreScroll = (): boolean => useTextModuleStore(store => store.shouldIgnoreScroll);
export const useActiveChunkPaddingRight = (): number => useTextModuleStore(store => store.activeChunkPaddingRight);
export const useActiveChunkElement = (): HTMLElement | undefined => useTextModuleStore(store => store.activeChunkElement);
export const useSidebarWidth = (): number | undefined => useTextModuleStore(store => store.sidebarWidth);
