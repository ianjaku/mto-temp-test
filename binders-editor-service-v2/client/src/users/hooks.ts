import {
    DeviceTargetUserLink,
    User,
    UserDetails,
    UserImportAction,
    UserPreferences,
    WhitelistedEmail
} from "@binders/client/lib/clients/userservice/v1/contract";
import { WebData, WebDataState } from "@binders/client/lib/webdata";
import UserStore from "./store";
import { useActiveAccountId } from "../accounts/hooks";
import { useFluxStoreAsAny } from "@binders/client/lib/react/helpers/hooks";
import { useGetAccountDeviceTargetUserLinks } from "./query";
import { useMyDetailsStoreState } from "../stores/my-details-store";

const useAccountUserImportActionsWD = (): WebData<UserImportAction[]> => useFluxStoreAsAny(UserStore, (_prevState, store) => store.accountUserImportActions());
export const useAccountUsersWD = (): WebData<User[]> => useFluxStoreAsAny(UserStore, (_prevState, store) => store.accountUsers());
const useAccountWhitelistedEmailsWD = (): WebData<WhitelistedEmail[]> => useFluxStoreAsAny(UserStore, (_prevState, store) => store.accountWhitelistedEmails() ?? []);

export const useAccountUserImportActionsOrEmpty = (): UserImportAction[] => { const wd = useAccountUserImportActionsWD(); return wd.state === WebDataState.SUCCESS ? wd.data : [] }
export const useAccountUsersOrEmpty = (): User[] => { const wd = useAccountUsersWD(); return wd.state === WebDataState.SUCCESS ? wd.data : [] };
export const useAccountWhitelistedEmailsOrEmpty = (): WhitelistedEmail[] => { const wd = useAccountWhitelistedEmailsWD(); return wd.state === WebDataState.SUCCESS ? wd.data : [] }

export const useDeviceTargetUserLinksOrEmpty = (): DeviceTargetUserLink[] => {
    const accountId = useActiveAccountId();
    const query = useGetAccountDeviceTargetUserLinks(accountId);
    return query.data ?? [];
}

export function useMyDetails(): UserDetails | undefined {
    const user = useMyDetailsStoreState(state => state.user);
    const sessionId = useMyDetailsStoreState(state => state.sessionId);
    const preferences = useMyDetailsStoreState(state => state.preferences);
    const canAccessBackend = useMyDetailsStoreState(state => state.canAccessBackend);
    const termsToAccept = useMyDetailsStoreState(state => state.termsToAccept);
    const isAllowedToChangePassword = useMyDetailsStoreState(state => state.isAllowedToChangePassword);
    if (!user) return undefined;
    return {
        user,
        sessionId,
        preferences,
        canAccessBackend,
        termsToAccept,
        isAllowedToChangePassword
    }
}

export function useUserPreferences(): UserPreferences | undefined {
    const preferences = useMyDetailsStoreState(state => state.preferences);
    return preferences;
}

export const useCurrentUserId = (): string | undefined => {
    const user = useMyDetailsStoreState(state => state.user);
    return user?.id;
};

export const useHasUserLoggedOff = (): boolean => {
    const sessionId = useMyDetailsStoreState(state => state.sessionId);
    return sessionId == null;
};

