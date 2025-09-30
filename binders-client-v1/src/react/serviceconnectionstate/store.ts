import { create } from "zustand";

type ServiceConnectionState = {
    isReachable: boolean;
};
/** A hook for the store that keeps track of the manual.to service reachability */
export const useServiceConnectionStore = create<ServiceConnectionState>(() => ({
    isReachable: true,
}));

export const setServiceReachable = () => useServiceConnectionStore.setState({ isReachable: true });

export const setServiceNotReachable = () => useServiceConnectionStore.setState({ isReachable: false });
