import { IRedirectionPolicy, ItemLock } from "@binders/client/lib/clients/notificationservice/v1/contract";
import { create } from "zustand";

export type StoreItemLock = Omit<ItemLock, "redirectionPolicy"> & { lockedInThisWindow: boolean };
type StoreItemLockOverride = Omit<ItemLock, "redirectionPolicy"> & { overriddenByThisWindow: boolean };

type ItemLockStore = {
    itemLocks: ReadonlyMap<string, StoreItemLock>;
    forceRedirectionRequest: IRedirectionPolicy | undefined;
}

const useItemLockStore = create<ItemLockStore>(() => ({
    itemLocks: new Map<string, StoreItemLock>(),
    forceRedirectionRequest: undefined,
}));

export const useItemLocks = (): ItemLockStore["itemLocks"] => {
    return useItemLockStore(store => store.itemLocks);
}

export const useForceRedirectionRequest = (): ItemLockStore["forceRedirectionRequest"] => {
    return useItemLockStore(store => store.forceRedirectionRequest);
}

export const setLockedItems = (lockedItems: StoreItemLock[]): void => {
    useItemLockStore.setState((state) => {
        const itemLocks = new Map(state.itemLocks);
        lockedItems.forEach((lock) => itemLocks.set(lock.itemId, lock));
        return { itemLocks };
    })
}

export const setItemLockAndRedirectionPolicy = (itemLock: StoreItemLock, redirectionPolicy: IRedirectionPolicy | undefined): void => {
    useItemLockStore.setState((state) => {
        const itemLocks = new Map(state.itemLocks);
        itemLocks.set(itemLock.itemId, itemLock);
        return redirectionPolicy ? { itemLocks, forceRedirectionRequest: redirectionPolicy } : { itemLocks };
    });
}

export const overrideItemLock = ({ itemId, user, overriddenByThisWindow, lockVisibleByInitiator }: StoreItemLockOverride, activeItemId: string | undefined) => {
    if (!activeItemId) return;
    useItemLockStore.setState((state) => {
        const itemLocks = new Map(state.itemLocks);
        itemLocks.set(itemId, { itemId, user, lockedInThisWindow: overriddenByThisWindow, lockVisibleByInitiator });
        return { itemLocks };
    });
}

export const releaseItemLockAndSetRedirectionPolicy = (itemId: string, redirectionPolicy: IRedirectionPolicy | undefined) => {
    useItemLockStore.setState((state) => {
        const itemLocks = new Map(state.itemLocks);
        itemLocks.delete(itemId);
        return redirectionPolicy ? { itemLocks, forceRedirectionRequest: redirectionPolicy } : { itemLocks };
    });
}

export const clearForceRedirectionRequest = () => {
    useItemLockStore.setState(() => ({ forceRedirectionRequest: undefined }));
}

/**
 * Helper function that compares two store states, used in components that need to know whether the actual locks changed
 */
export const areLockedItemsEqual = (lockedItems1: ReadonlyMap<string, StoreItemLock>, lockedItems2: ReadonlyMap<string, StoreItemLock>): boolean => {
    if (lockedItems1.size !== lockedItems2.size) {
        return false;
    }
    for (const [key, value] of lockedItems1.entries()) {
        if (!lockedItems2.has(key)) {
            return false;
        }
        if (JSON.stringify(value) !== JSON.stringify(lockedItems2.get(key))) {
            return false;
        }
    }
    return true;
}
