import * as React from "react";
import Ribbon, {
    RibbonType
} from  "@binders/ui-kit/lib/elements/ribbon";
import { FC } from "react";
import IE11WarningBanner from "@binders/ui-kit/lib/compounds/banners/ie11warning";
import { ImpersonationInfo } from "@binders/client/lib/clients/credentialservice/v1/contract";
import { RibbonsView } from "@binders/ui-kit/lib/compounds/ribbons/RibbonsView";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import { useConnectionState } from "@binders/ui-kit/lib/providers/ConnectionStateProvider";
import { useLocation } from "react-router-dom";
import { useTranslation } from "@binders/client/lib/react/i18n";


export const Ribbons: FC<{
    impersonationInfo: ImpersonationInfo;
    user: User | undefined;
}> = ({ impersonationInfo, user, children }) => {
    const { t } = useTranslation();
    const location = useLocation();
    const { isOnline } = useConnectionState();

    return (
        <RibbonsView
            location={location}
            extraBottomRibbons={() => (
                <>
                    <IE11WarningBanner />
                </>
            )}
            extraTopRibbons={() => (
                <>
                    {!isOnline && (
                        <Ribbon type={RibbonType.WARNING}>
                            <span>{t(TK.General_NoConnection)}</span>
                        </Ribbon>
                    )}
                    {impersonationInfo?.isImpersonatedSession && !impersonationInfo.isDeviceUserTarget && (
                        <Ribbon type={RibbonType.OVERKILL_WARNING}>
                            <label>{t(TK.User_ImpersonatedSessionFor, { login: user?.login })}</label>
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