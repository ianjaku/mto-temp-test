import {
    APIGetDeviceTargetIds,
    APIGetUsers,
    getUserPreferences,
    setAllowAnalyticsCookies
} from "../../api/userservice";
import type {
    UseMutationResult,
    UseQueryResult,
} from "@tanstack/react-query";
import type { User, UserPreferences } from "@binders/client/lib/clients/userservice/v1/contract";
import {
    useMutation,
    useQuery,
} from "@tanstack/react-query";
import { isDeviceTargetUserImpersonation } from "@binders/client/lib/util/impersonation";
import { isManualToLogin } from "@binders/client/lib/util/user";
import { queryClient } from "../../react-query";
import tokenStore from "@binders/client/lib/clients/tokenstore";
import { updateUserPreferences } from "../actions/user";
import { useActiveAccountId } from "./account-hooks";
import { useUserStoreState } from "../zustand/user-store";

const serviceName = "@binders/users-v1";

export const useCurrentUserId = (): string => {
    const userId = useUserStoreState(state => state.userId);
    return userId;
}

export const useIsLoggedIn = (): boolean => {
    const currentUserId = useCurrentUserId();
    return currentUserId != null && currentUserId !== "public";
}

export const useIsLoggedOut = (): boolean => {
    const loggedOut = useUserStoreState(state => state.loggedOut);
    return loggedOut;
}

/**
* Returns null when the user is not logged in or when the user is still loading
*/
export const useCurrentUser = (): User | null => {
    const user = useUserStoreState(state => state.user);
    return user;
}

export const useIsPublic = (): boolean => {
    const isPublic = useUserStoreState(state => state.isPublic);
    return isPublic;
}

export const useSetAllowAnalyticsCookies = (): UseMutationResult<UserPreferences, Error, { userId: string, acknowledgementCookies: boolean }> => {
    return useMutation({
        async mutationFn(params: { userId: string; acknowledgementCookies: boolean }) {
            return setAllowAnalyticsCookies(params.userId, params.acknowledgementCookies);
        },
        onSuccess: async (data, params) => {
            await queryClient.invalidateQueries({
                queryKey: [serviceName, "preferences", params.userId]
            });
            updateUserPreferences(data);
        }
    });
}

export const useCurrentUserPreferences = (): UserPreferences => {
    const preferences = useUserStoreState(state => state.preferences);
    return preferences as UserPreferences;
}

export const useUserPreferences = (
    userId: string
): UseQueryResult<UserPreferences> => {
    return useQuery({
        queryKey: [serviceName, "preferences", userId],
        queryFn: () => getUserPreferences(userId),
        enabled: !!userId && userId !== "public",
        refetchOnMount: false,
    });
}

export const useDeviceTargetIds = (): UseQueryResult<string[]> => {
    const userId = useCurrentUserId();
    const accountId = useActiveAccountId();

    return useQuery({
        queryKey: [serviceName, "hasDeviceTargetUserLinks", userId, accountId],
        async queryFn() {
            const hasInternalToken = tokenStore.hasInternalToken();
            if (!hasInternalToken) return false;
            return APIGetDeviceTargetIds(accountId, userId);
        },
        enabled: !!userId,
        refetchOnMount: false
    });
}

export const useHasDeviceTargetUserLinks = (): UseQueryResult<boolean> => {
    const { data: ids } = useDeviceTargetIds();
    return useQuery({
        queryKey: [serviceName, "hasDeviceTargetUserLinks", ids],
        queryFn: async () => ids != null && ids.length > 0,
        enabled: ids != null,
        refetchOnMount: false,
        refetchOnReconnect: false
    })
}

export const useDeviceTargetUsers = (): UseQueryResult<User[]> => {
    const { data: userIds } = useDeviceTargetIds();

    return useQuery({
        queryKey: [serviceName, "deviceTargetUsers", userIds],
        async queryFn() {
            if (isDeviceTargetUserImpersonation()) return [];
            const users = await APIGetUsers(userIds);
            return users.filter(u => !isManualToLogin(u.login));
        },
        enabled: !!userIds,
        refetchOnMount: false
    });
}
