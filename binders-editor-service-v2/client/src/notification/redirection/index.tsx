import * as React from "react";
import { FlashMessages } from "../../logging/FlashMessages";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { translateUiErrorCode } from "@binders/client/lib/errors";
import { useLocation } from "react-router";
import { useTranslation } from "@binders/client/lib/react/i18n";

export const RedirectionNotifications: React.FC = ({ children }) => {
    const loc = useLocation();
    const { t } = useTranslation();

    React.useEffect(() => {
        if (loc.search == null) return;
        if (!loc.search.includes("redirect_reason")) return;

        const params = new URLSearchParams(loc.search);
        const reason = params.get("redirect_reason")
        if (reason == null) return;

        FlashMessages.info(translateUiErrorCode(t, reason, TK.Redirect_General), true);
    }, [loc, t]);

    return <>{children}</>;
}
