import * as React from "react";
import { APIExtendSession, APIHasSessionExpired } from "../api/credentials";
import { useActiveAccountFeatures, useActiveAccountSettings } from "../stores/hooks/account-hooks";
import AutoLogoutHandler from "@binders/client/lib/inactivity/auto-logout-handler";
import CountdownModal from "@binders/ui-kit/lib/compounds/countdownModal/CountdownModal";
import { CountdownModalProps } from "@binders/client/lib/react/countdown/contract";
import {
    FEATURE_AUTOLOGOUT,
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    SESSION_EXTENSION_DEBOUNCE_INTERVAL
} from "@binders/client/lib/clients/credentialservice/v1/contract";
import debounce from "lodash.debounce";
import { getReaderDomain } from "../util";
import tokenstore from "@binders/client/lib/clients/tokenstore";
import { useActiveAccountId } from "../stores/hooks/account-hooks";

interface Props {
    children: React.ReactElement;
}

const debouncedSessionExtension = debounce(
    (accountId) => APIExtendSession(accountId),
    SESSION_EXTENSION_DEBOUNCE_INTERVAL,
    { leading: true, trailing: true, maxWait: SESSION_EXTENSION_DEBOUNCE_INTERVAL * 2 }
)

const WiredAutoLogoutHandler: React.FC<Props> = ({ children }) => {
    const accountSettings = useActiveAccountSettings();
    const features = useActiveAccountFeatures();
    const domain = getReaderDomain();
    const accountId = useActiveAccountId();
    const isPublic = tokenstore.isPublic();
    const onActivity = React.useCallback(
        () => debouncedSessionExtension(accountId),
        [accountId]
    );

    const sessionExpiredCheck = React.useCallback(
        () => APIHasSessionExpired(accountId),
        [accountId]
    )

    if (
        !(features && features.includes(FEATURE_AUTOLOGOUT)) ||
        !(accountSettings?.security?.autoLogout)
    ) {
        return children;
    }

    if (!isPublic) {
        window.addEventListener("beforeunload", sessionExpiredCheck);
    }
    return (
        <AutoLogoutHandler securitySettings={accountSettings?.security}
            domain={domain} onActivity={!isPublic && onActivity} sessionExpiredCheck={!isPublic && sessionExpiredCheck}>
            {(countdownSeconds: number, countDownModalProps: CountdownModalProps) => (
                <>
                    {children}
                    {countdownSeconds && countdownSeconds > 0 && (
                        <CountdownModal {...countDownModalProps} />
                    )}
                </>
            )}
        </AutoLogoutHandler>

    )
}

export default WiredAutoLogoutHandler