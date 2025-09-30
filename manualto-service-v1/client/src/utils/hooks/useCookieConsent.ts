import * as React from "react";
import {
    useCurrentUserId,
    useCurrentUserPreferences,
    useSetAllowAnalyticsCookies
} from "../../stores/hooks/user-hooks";
import { CookieStatus } from "@binders/client/lib/util/cookie";
import { maybeInitGtag } from "@binders/client/lib/util/gtag";
import { usePublicUserCookieConsentStore } from "./useAnonymousCookieConsentStore";

export type UseCookieConsent = {
    cookieStatus: CookieStatus;
    saveCookieStatus: (status: CookieStatus) => void;
}

export const useCookieConsent = (): UseCookieConsent => {
    const userId = useCurrentUserId();
    const userPreferences = useCurrentUserPreferences();

    const { mutate: setAllowAnalyticsCookies } = useSetAllowAnalyticsCookies();
    const {
        cookieStatus: localCookieStatus,
        saveCookieStatus: setLocalCookieStatus
    } = usePublicUserCookieConsentStore();

    const userPreferencesCookieStatus = React.useMemo(() => {
        if (userPreferences.acknowledgementCookies == null) {
            return undefined;
        }
        return userPreferences.acknowledgementCookies ? CookieStatus.Accepted : CookieStatus.Rejected;
    }, [userPreferences.acknowledgementCookies]);

    React.useEffect(() => {
        if (
            userPreferencesCookieStatus == null &&
            localCookieStatus !== CookieStatus.Unassigned &&
            userId != null && userId !== "public"
        ) {
            // Update remote user preferences to use the local value when option was expressed before logging in
            setAllowAnalyticsCookies({
                acknowledgementCookies: localCookieStatus === CookieStatus.Accepted,
                userId,
            });
        } else if (userPreferencesCookieStatus != null && userPreferencesCookieStatus != localCookieStatus) {
            // Keep local storage in sync with the remote user preferences value
            setLocalCookieStatus(userPreferencesCookieStatus);
        }
    }, [localCookieStatus, setAllowAnalyticsCookies, setLocalCookieStatus, userId, userPreferencesCookieStatus]);

    const cookieStatus = React.useMemo(() =>
        userPreferencesCookieStatus ?? localCookieStatus
    , [localCookieStatus, userPreferencesCookieStatus]);

    const saveCookieStatus = React.useCallback((newCookieStatus: CookieStatus) => {
        if (cookieStatus === newCookieStatus) {
            return;
        }
        maybeInitGtag(newCookieStatus);
        if (userId != null && userId !== "public") {
            setAllowAnalyticsCookies({
                acknowledgementCookies: newCookieStatus === CookieStatus.Accepted,
                userId,
            });
        } else {
            setLocalCookieStatus(newCookieStatus);
        }
    }, [cookieStatus, setAllowAnalyticsCookies, setLocalCookieStatus, userId]);

    return { cookieStatus, saveCookieStatus };
}