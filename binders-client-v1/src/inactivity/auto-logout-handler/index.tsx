import * as React from "react";
import { CountdownModalProps } from "../../react/countdown/contract";
import { SecuritySettings } from "../../clients/accountservice/v1/contract";
import { TranslationKeys as TK } from "../../i18n/translations";
import { useInactivityContext } from "../inactivityContext";
import useTimeoutAction from "./useTimeoutAction";
import { useTranslation } from "../../react/i18n";

const { useEffect, useRef } = React;


interface Props {
    children: (countdownSeconds: number, countDownModalProps: CountdownModalProps) => React.ReactElement;
    domain?: string;
    securitySettings?: SecuritySettings;
    onActivity?: () => Promise<boolean>;
    sessionExpiredCheck?: () => Promise<boolean>;
}

const AutoLogoutHandler: React.FC<Props> = ({ children, domain, securitySettings, onActivity, sessionExpiredCheck }) => {

    const { registerInactivityListener, countdownSeconds, reset } = useInactivityContext();
    const registered = useRef(false);
    const { t } = useTranslation();

    const { timeoutMinutes, countdownDurationSeconds, onTimeout } = useTimeoutAction(
        securitySettings,
        domain,
        onActivity,
        sessionExpiredCheck
    );

    useEffect(() => {
        if (registered.current) {
            return;
        }
        if (timeoutMinutes && onTimeout) {
            registerInactivityListener({
                timeoutMinutes,
                onTimeout,
                countdownDurationSeconds,
            });
        }
    }, [domain, onTimeout, registerInactivityListener, timeoutMinutes, countdownDurationSeconds]);

    return children(
        countdownSeconds,
        {
            onCancel: reset,
            onCountZero: onTimeout,
            startSeconds: countdownDurationSeconds,
            modalTitle: t(TK.General_SessionAutoLogoutTitle),
            modalMsgTranslationKey: TK.General_SessionAutoLogoutInfo,
            cancelLabel: t(TK.General_SessionAutoLogoutCancel),
            countZeroLabel: t(TK.General_Logout),
        }
    );
}

export default AutoLogoutHandler