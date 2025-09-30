import * as React from "react";
import { ReaderEvent, captureFrontendEvent } from "@binders/client/lib/thirdparty/tracking/capture";
import { CookieStatus } from "@binders/client/lib/util/cookie";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import Toggle from "@binders/ui-kit/lib/elements/toggle/Toggle";
import { useCookieConsent } from  "../../utils/hooks/useCookieConsent";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./privacy.styl";

export const PrivacySettings: React.FC = () => {
    const { t } = useTranslation();
    const { cookieStatus, saveCookieStatus } = useCookieConsent();
    const [isToggled, setIsToggled] = React.useState(cookieStatus === CookieStatus.Accepted);

    React.useEffect(() => {
        setIsToggled(cookieStatus === CookieStatus.Accepted);
    }, [setIsToggled, cookieStatus]);

    const toggleCookiesUsage = React.useCallback(() => {
        saveCookieStatus(isToggled ? CookieStatus.Rejected : CookieStatus.Accepted);
        captureFrontendEvent(ReaderEvent.UserCookiesConsentChange, { enable: !isToggled });
        setIsToggled(!isToggled);
    }, [isToggled, saveCookieStatus]);

    return (
        <div className="userDetails-layout">
            <div className="userDetails-title">
                {t(TK.General_Privacy)}
            </div>
            <div className="userDetails-row privacy-settings-row">
                <div className="userDetails-label">
                    {t(TK.User_PrivacyUseCookies)}
                </div>
                <Toggle isToggled={isToggled} onToggle={toggleCookiesUsage} />
            </div>
            <div className="privacy-settings-info">
                {t(TK.User_PrivacyCookiesInfo)}
            </div>
        </div>
    );
}

export default PrivacySettings;
