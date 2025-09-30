import { getImpersonationInfo, stopImpersonation } from "../../util/impersonation";
import { useCallback, useEffect, useState } from "react";
import { SESSION_EXTENSION_DEBOUNCE_INTERVAL } from "../../clients/credentialservice/v1/contract";
import { SecuritySettings } from "../../clients/accountservice/v1/contract";
import { UiErrorCode } from "../../errors/codes";
import { useTranslation } from "../../react/i18n";

const DEVICE_USER_TIMEOUT_MINUTES = 5;

export interface TimeoutAction {
    timeoutMinutes?: number;
    countdownDurationSeconds?: number;
    onTimeout?: () => void;
}

const useTimeoutAction = (
    securitySettings?: SecuritySettings,
    domain?: string,
    onActivity?: () => Promise<boolean>,
    sessionExpiredCheck?: () => Promise<boolean>
): TimeoutAction => {

    const [timeoutAction, _setTimeoutAction] = useState<TimeoutAction>();
    const { t } = useTranslation();

    const setTimeoutAction = useCallback((timeoutMinutes: number, onTimeout: () => void, countdownDurationSeconds?: number) => {
        if (!timeoutAction || timeoutMinutes < timeoutAction.timeoutMinutes) {
            // if multiple timeouts apply use the shortest one
            _setTimeoutAction({
                timeoutMinutes,
                onTimeout,
                countdownDurationSeconds,
            })
        }
    }, [timeoutAction]);

    useEffect(() => {
        if (getImpersonationInfo()?.isDeviceUserTarget) {
            setTimeoutAction(
                DEVICE_USER_TIMEOUT_MINUTES,
                () => {
                    stopImpersonation(domain);
                },
            );
        }
    }, [domain, securitySettings, setTimeoutAction, t]);

    useEffect(() => {
        if(!sessionExpiredCheck) {
            return () => { /* do nothing */ };
        }
        const intervalId = setInterval(
            async () => {
                const hasExpired = await sessionExpiredCheck();
                if(hasExpired) {
                    window.location.href = `/logout?reason=${UiErrorCode.sessionInactivity}`;
                }
            },
            SESSION_EXTENSION_DEBOUNCE_INTERVAL * 5
        );
        return () => clearInterval(intervalId);
    }, [sessionExpiredCheck])

    useEffect( () => {
        let events = []
        if (onActivity) {
            events = ["keydown", "mousemove", "touchstart"];
        }
        for (const event of events) {
            window.document.addEventListener(event, async () => {
                const sessionExtended = await onActivity();
                if (!sessionExtended) {
                    window.location.href = `/logout?reason=${UiErrorCode.sessionInactivity}`;
                }
            });
        }
        return () => {
            for (const event of events) {
                window.document.removeEventListener(event, onActivity);
            }
        }
    }, [onActivity]);
    return timeoutAction || {};


}

export default useTimeoutAction;
