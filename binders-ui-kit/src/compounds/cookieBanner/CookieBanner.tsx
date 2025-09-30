import * as React from "react";
import { CookieStatus } from "@binders/client/lib/util/cookie";
import { FC } from "react";
import { TK } from "@binders/client/lib/react/i18n/translations";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./cookieBanner.styl";

export const CookieBanner: FC<{
    // when cookieStatus is null or undefined, this component won't do anything
    cookieStatus?: CookieStatus;
    onSaveCookieStatus: (cookieStatus: CookieStatus) => void;
}> = ({ cookieStatus, onSaveCookieStatus }) => {

    const { t } = useTranslation();

    if (cookieStatus !== CookieStatus.Unassigned) return null;
    return (
        <div className="cookieBanner">
            <div className="cookieBanner-content">
                <div className="cookieBanner-explanation">
                    <h1 className="cookieBanner-title"></h1>
                    <p className="cookieBanner-description">
                        {t(TK.General_CookieInfo)}
                    </p>
                </div>
                <div className="cookieBanner-buttons">
                    <button
                        className="cookieBanner-button"
                        onClick={() => onSaveCookieStatus(CookieStatus.Accepted)}
                    >
                        {t(TK.General_CookieAccept)}
                    </button>
                    <button
                        className="cookieBanner-button"
                        onClick={() => onSaveCookieStatus(CookieStatus.Rejected)}
                    >
                        {t(TK.General_CookieReject)}
                    </button>
                </div>
            </div>
        </div>
    );
}
