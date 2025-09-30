import * as React from "react";
import { CookieBanner } from "@binders/ui-kit/lib/compounds/cookieBanner/CookieBanner";
import { CookieStatus } from "@binders/client/lib/util/cookie";
import { FC } from "react";
import { maybeInitGtag } from "@binders/client/lib/util/gtag";
import { useCookieConsent } from "./hooks";
import { useCurrentUserId } from "../users/hooks";
import { useGoogleAnalytics } from "@binders/ui-kit/lib/thirdparty/useGoogleAnalytics";
import { useSetAllowAnalyticsCookies } from "../users/query";

export const CookieBannerWrapper: FC = () => {
    const setAllowAnalyticsCookies = useSetAllowAnalyticsCookies();
    const userId = useCurrentUserId();
    const cookieStatus = useCookieConsent();

    useGoogleAnalytics(cookieStatus === CookieStatus.Accepted);

    if (cookieStatus == null) return null;
    return (
        <CookieBanner
            onSaveCookieStatus={(status) => {
                setAllowAnalyticsCookies.mutate({
                    userId,
                    acknowledgementCookies: status === CookieStatus.Accepted
                });
                maybeInitGtag(status);
            }}
            cookieStatus={cookieStatus}
        />
    );
}
