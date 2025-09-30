import { User, UserPreferences } from "@binders/client/lib/clients/userservice/v1/contract";
import { createStore, useStore } from "zustand";

export type UserStoreActions = {
    loadUser: (user: UserStoreState["user"]) => void;
    logout: (sessionId: UserStoreState["sessionId"]) => void;
    overrideLanguages: (langs: string[]) => void;
    setSessionId: (sessionId: UserStoreState["sessionId"]) => void;
    updatePreferences: (prefs: Partial<UserStoreState["preferences"]>) => void;
    setIsPublic: (isPublic: boolean) => void;
    setIsAllowedToChangePassword: (isAllowedToChangePassword: boolean) => void;
};

export type UserStoreState = {
    preferences: Partial<UserPreferences>;
    loggedOut: boolean;
    sessionId?: string;
    user?: User;
    userId?: string;
    isPublic?: boolean;
    isAllowedToChangePassword: boolean;
};

/**
* @deprecated use hook functions instead
*/
export const UserStoreGetters = {
    getUser() { return getUserStoreState().user },
    getUserId() { return getUserStoreState().userId },
    getPreferences() { return getUserStoreState().preferences }
}

export type UserStore = UserStoreState & {
    actions: UserStoreActions;
};

const userStore = createStore<UserStore>(set => ({
    loggedOut: false,
    preferences: {
        userId: undefined,
        defaultAnalyticsRange: undefined,
    },
    user: undefined,
    userId: undefined,
    sessionId: undefined,
    isPublic: false,
    isAllowedToChangePassword: false,
    actions: {
        loadUser(user) {
            set(prev => ({ ...prev, user, userId: user.id, isPublic: false }))
        },
        logout(sessionId) {
            set(prev => ({ ...prev, loggedOut: prev.loggedOut || sessionId === prev.sessionId }))
        },
        overrideLanguages(readerLanguages) {
            set(prev => ({ ...prev, preferences: { ...prev.preferences, readerLanguages } }))
        },
        setSessionId(sessionId) {
            set(prev => ({ ...prev, sessionId }))
        },
        updatePreferences(preferences) {
            set(prev => ({
                ...prev,
                preferences: { ...prev.preferences, ...preferences },
                userId: preferences.userId ?? prev.userId,
            }))
        },
        setIsPublic(isPublic) {
            set(prev => ({ ...prev, isPublic }))
        },
        setIsAllowedToChangePassword(isAllowedToChangePassword) {
            set(prev => ({ ...prev, isAllowedToChangePassword }))
        }
    },
}));

/**
 * @deprecated use hook functions instead
 */
export function getUserStoreActions(): UserStoreActions {
    return userStore.getState().actions;
}

function getUserStoreState(): UserStoreState {
    return userStore.getState();
}

/** @deprecated Use useUserStoreState with a selector to **prevent unnecessary rerenders** and **don't select multiple props** */
export function useUserStoreState(): UserStoreState;
export function useUserStoreState<T>(selector: (state: UserStore) => T): T;
export function useUserStoreState<T>(selector?: (state: UserStore) => T) {
    return useStore(userStore, selector);
}

export function useUserStoreActions(): UserStoreActions {
    const actions = useUserStoreState(state => state.actions);
    return actions;
}

