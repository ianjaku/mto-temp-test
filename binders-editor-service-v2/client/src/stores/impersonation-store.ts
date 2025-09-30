import { createStore, useStore } from "zustand";
import { ImpersonationInfo } from "@binders/client/lib/clients/credentialservice/v1/contract";
import { getImpersonationInfo } from "@binders/client/lib/util/impersonation";

export type ImpersonationStoreActions = {
    setImpersonationInfo: (info: ImpersonationInfo) => void;
};

export type ImpersonationStoreState = {
    info?: ImpersonationInfo;
};

export type ImpersonationStore = ImpersonationStoreState & {
    actions: ImpersonationStoreActions;
};

const INITIAL_STATE: ImpersonationStoreState = {
    info: undefined,
}

const impersonationStore = createStore<ImpersonationStore>(set => ({
    ...INITIAL_STATE,
    actions: {
        setImpersonationInfo(info: ImpersonationInfo) {
            set(prev => ({ ...prev, info }));
        }
    },
}));

/** @deprecated Use {@link useImpersonationStoreState} with a selector to **prevent unnecessary rerenders** and **don't select multiple props** */
function useImpersonationStoreState(): ImpersonationStoreState;
function useImpersonationStoreState<T>(selector: (state: ImpersonationStore) => T): T;
function useImpersonationStoreState<T>(selector?: (state: ImpersonationStore) => T) {
    return useStore(impersonationStore, selector);
}

export const checkImpersonatedSession = (): void => {
    const info = getImpersonationInfo();
    impersonationStore.getState().actions.setImpersonationInfo(info);
}

export const useIsAdminImpersonatedSession = (): boolean => {
    const info = useImpersonationStoreState(state => state.info);
    return checkIsAdminImpersonatedSession(info);
}

export function isAdminImpersonatedSession(): boolean {
    const info = impersonationStore.getState().info;
    return checkIsAdminImpersonatedSession(info);
}

function checkIsAdminImpersonatedSession(info?: ImpersonationInfo): boolean {
    if (!info) return false;
    return info.isImpersonatedSession && !(info.isDeviceUserTarget);
}
export const useIsImpersonatedSession = (): boolean => {
    const info = useImpersonationStoreState(state => state.info);
    return info?.isImpersonatedSession ?? false;
};

