import {
    APISubscribeToRoutingKeys,
    APIUnsubscribeFromRoutingKeys,
} from "../notification/api";
import { createStore, useStore } from "zustand";
import { RoutingKeyType } from "@binders/client/lib/clients/notificationservice/v1/contract";
import { UserDetails } from "@binders/client/lib/clients/userservice/v1/contract";

export type MyDetailsStoreActions = {
    logoutUser: (sessionId: string) => void;
    setCurrentUserDetails: (details: UserDetails) => void;
};

export type MyDetailsStoreState = UserDetails;

export type MyDetailsStore = MyDetailsStoreState & {
    actions: MyDetailsStoreActions;
};

const INITIAL_STATE: MyDetailsStoreState = {
    user: undefined,
    sessionId: undefined,
    preferences: undefined,
    canAccessBackend: undefined,
    termsToAccept: undefined,
    isAllowedToChangePassword: false,
}

const userPrefsStore = createStore<MyDetailsStore>(set => ({
    ...INITIAL_STATE,
    actions: {
        logoutUser(sessionId) {
            const userId = getCurrentUserId();
            if (userId) {
                APIUnsubscribeFromRoutingKeys([{
                    type: RoutingKeyType.USER,
                    value: userId,
                }])
            }
            set(prev => {
                if (prev.sessionId === sessionId) {
                    return {
                        ...prev,
                        ...INITIAL_STATE,
                    };
                }
                return prev;
            });
        },
        setCurrentUserDetails(details) {
            set(prev => ({ ...prev, ...details }));
            const userId = details.user.id;
            APISubscribeToRoutingKeys([{
                type: RoutingKeyType.USER,
                value: userId,
            }]);
        }
    },
}));

/** @deprecated Use useMyDetailsStoreState with a selector to **prevent unnecessary rerenders** and **don't select multiple props** */
export function useMyDetailsStoreState(): MyDetailsStoreState;
export function useMyDetailsStoreState<T>(selector: (state: MyDetailsStore) => T): T;
export function useMyDetailsStoreState<T>(selector?: (state: MyDetailsStore) => T) {
    return useStore(userPrefsStore, selector);
}

export function getCurrentUserId(): string | undefined {
    return userPrefsStore.getState().user?.id;
}

export function setCurrentUserDetails(details: UserDetails): void {
    userPrefsStore.getState().actions.setCurrentUserDetails(details);
}

export function logoutCurrentUser(sessionId: string): void {
    userPrefsStore.getState().actions.logoutUser(sessionId);
}
