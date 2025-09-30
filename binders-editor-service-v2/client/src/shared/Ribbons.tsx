import * as React from "react";
import { FC, useMemo } from "react";
import Ribbon, { RibbonType } from "@binders/ui-kit/lib/elements/ribbon";
import { RibbonsView } from "@binders/ui-kit/lib/compounds/ribbons/RibbonsView";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { useConnectionState } from "@binders/ui-kit/lib/providers/ConnectionStateProvider";
import { useIsAdminImpersonatedSession } from "../stores/impersonation-store";
import { useLocation } from "react-router-dom";
import { useMyDetails } from "../users/hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";

export const Ribbons: FC = ({ children }) => {
    const { t } = useTranslation();
    const location = useLocation();
    const myUserDetails = useMyDetails();
    const userLogin = useMemo(() => {
        if (!myUserDetails) return "Loading..";
        return myUserDetails.user.login;
    }, [myUserDetails]);

    const isAdminImpersonatedSession = useIsAdminImpersonatedSession();
    const { isOnline } = useConnectionState();

    return (
        <RibbonsView
            location={location}
            extraTopRibbons={() => (
                <>
                    {!isOnline && (
                        <Ribbon type={RibbonType.WARNING}>
                            <span>{t(TK.General_NoConnection)}</span>
                        </Ribbon>
                    )}
                    {isAdminImpersonatedSession && (
                        <Ribbon type={RibbonType.OVERKILL_WARNING}>
                            <label>{t(TK.User_ImpersonatedSessionFor, { login: userLogin })}</label>
                            <a href="/stopimpersonation">{t(TK.User_ImpersonationStop)}</a>
                        </Ribbon>
                    )}
                </>
            )}
        >
            {children}
        </RibbonsView>
    )
}
