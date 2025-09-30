import * as React from "react";
import { CookieStatus } from "@binders/client/lib/util/cookie";
import { FC } from "react";
import { Posthog } from "@binders/ui-kit/lib/thirdparty/tracking/Posthog";
import { useActiveAccountId } from "../accounts/hooks";
import { useCookieConsent } from "./hooks";
import { useLocation } from "react-router";
import { useMyDetails } from "../users/hooks";

let _disableTracking = false;

export const Trackers: FC = () => {
    const cookieStatus = useCookieConsent();
    const accountId = useActiveAccountId();

    const location = useLocation();
    if (location.search.includes("hide-cookie-banner")) {
        _disableTracking = true;
    }

    const userDetails = useMyDetails();
    const user = userDetails?.user;

    if (_disableTracking) return null;
    if (user?.login === "e2e@manual.to") return null;
    const didUserSetCookieStatus = cookieStatus != null && cookieStatus !== CookieStatus.Unassigned;
    return (
        <>
            {didUserSetCookieStatus && (
                <Posthog
                    accountId={accountId}
                    cookieStatus={cookieStatus}
                    user={user}
                />
            )}
        </>
    );
}
