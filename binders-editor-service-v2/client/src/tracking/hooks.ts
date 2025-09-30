import { CookieStatus } from "@binders/client/lib/util/cookie";
import { FEATURE_LIVECHAT } from "@binders/client/lib/clients/accountservice/v1/contract";
import { LDFlags, } from "@binders/client/lib/launchdarkly";
import { useActiveAccountFeatures, } from "../accounts/hooks";
import { useLaunchDarklyFlagValue } from "@binders/ui-kit/lib/thirdparty/launchdarkly/hooks";
import { useMemo } from "react";
import { useUserPreferences } from "../users/hooks";

export const useCookieConsent = (): CookieStatus | null => {
    const userPreferences = useUserPreferences();
    return useMemo(() => {
        if (!userPreferences) return null;
        if (userPreferences?.acknowledgementCookies == null) return CookieStatus.Unassigned;
        if (userPreferences?.acknowledgementCookies) return CookieStatus.Accepted;
        return CookieStatus.Rejected;
    }, [userPreferences]);
}

export const useEnableHubspotChatWidget = () => {
    const cookieStatus = useCookieConsent();
    const cookiesAllowed = cookieStatus === CookieStatus.Accepted;
    const accountFeatures = useActiveAccountFeatures();
    const featuresLivechat = accountFeatures.includes(FEATURE_LIVECHAT);
    const hasFlag = useLaunchDarklyFlagValue(LDFlags.USE_HUBSPOT_CHATWIDGET);
    return hasFlag && featuresLivechat && cookiesAllowed;
}
