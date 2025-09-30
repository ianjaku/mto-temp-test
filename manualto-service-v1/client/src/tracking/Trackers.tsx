import * as React from "react";
import { CookieBannerWrapper } from "./CookieBannerWrapper";
import { CookieStatus } from "@binders/client/lib/util/cookie";
import { Posthog } from "@binders/ui-kit/lib/thirdparty/tracking/Posthog";
import { useActiveAccountId } from "../stores/hooks/account-hooks";
import { useCookieConsent } from "../utils/hooks/useCookieConsent";
import { useCurrentUser } from "../stores/hooks/user-hooks";

export const Trackers: React.FC = () => {

    const { cookieStatus, saveCookieStatus } = useCookieConsent();
    const user = useCurrentUser();
    const accountId = useActiveAccountId();

    if (user?.login === "e2e@manual.to") return null;
    const didUserChooseCookieStatus = cookieStatus !== CookieStatus.Unassigned;
    return (
        <>
            {!didUserChooseCookieStatus && (
                <CookieBannerWrapper
                    cookieStatus={cookieStatus}
                    saveCookieStatus={(status) => saveCookieStatus(status)}
                />
            )}
            {didUserChooseCookieStatus && (
                <Posthog
                    accountId={accountId}
                    cookieStatus={cookieStatus}
                    user={user}
                    // AutoCapture might be too expensive in the reader. Needs to be tested
                    disableAutoTracking={true}
                    // Let's disable session recording for now. Might be more expensive than it's worth
                    disableSessionRecording={true}
                />
            )}
        </>
    );
}