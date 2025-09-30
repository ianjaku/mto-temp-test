import * as React from "react";
import { ReaderEvent, captureFrontendEvent } from "@binders/client/lib/thirdparty/tracking/capture";
import { CookieBanner, } from "@binders/ui-kit/lib/compounds/cookieBanner/CookieBanner";
import { CookieStatus } from "@binders/client/lib/util/cookie";
import { isAdminImpersonation } from "@binders/client/lib/util/impersonation";
import { useHasDeviceTargetUserLinks } from "../stores/hooks/user-hooks";
import { useSearchParams } from "../stores/hooks/router-hooks";

let _hideCookieBanner = false;

export const CookieBannerWrapper: React.FC<{
    cookieStatus: CookieStatus;
    saveCookieStatus: (status: CookieStatus) => void,
}> = ({ cookieStatus, saveCookieStatus }) => {
    const isImpersonation = isAdminImpersonation();
    const hasDeviceTargetUserLinks = useHasDeviceTargetUserLinks();
    const searchParams = useSearchParams();
    React.useEffect(() => {
        if (searchParams?.has("hide-cookie-banner")) {
            _hideCookieBanner = true;
        }
    }, [searchParams]);

    if (isImpersonation) return null;
    if (hasDeviceTargetUserLinks.data) return null;
    if (_hideCookieBanner) return null;
    return (
        <CookieBanner
            onSaveCookieStatus={(status: CookieStatus) => {
                saveCookieStatus(status);
                captureFrontendEvent(ReaderEvent.UserCookiesInitialConsent, { enable: status === CookieStatus.Accepted });
            }}
            cookieStatus={cookieStatus}
        />
    );
}
