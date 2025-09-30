import * as React from "react";
import { APIExtendSession, APIHasSessionExpired } from "../credential/api";
import {
    FEATURE_AUTOLOGOUT,
    IAccountSettings
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { IWebData, WebDataState } from "@binders/client/lib/webdata";
import { useActiveAccountFeatures, useActiveAccountId } from "../accounts/hooks";
import AccountStore from "../accounts/store";
import AutoLogoutHandler from "@binders/client/lib/inactivity/auto-logout-handler";
import CountdownModal from "@binders/ui-kit/lib/compounds/countdownModal/CountdownModal";
import { CountdownModalProps } from "@binders/client/lib/react/countdown/contract";
import {
    SESSION_EXTENSION_DEBOUNCE_INTERVAL
} from "@binders/client/lib/clients/credentialservice/v1/contract";
import debounce from "lodash.debounce";
import { useFluxStoreAsAny } from "@binders/client/lib/react/helpers/hooks";
import { useMemo } from "react";

interface Props {
    children: React.ReactElement;
}

const debouncedSessionExtension = debounce(
    (accountId: string) => APIExtendSession(accountId),
    SESSION_EXTENSION_DEBOUNCE_INTERVAL,
    { leading: true, trailing: true, maxWait: SESSION_EXTENSION_DEBOUNCE_INTERVAL * 2 }
);

const WiredAutoLogoutHandler: React.FC<Props> = ({ children }) => {
    const accountSettingsWD: IWebData<IAccountSettings> = useFluxStoreAsAny(AccountStore, (_prevState, store) => store.getAccountSettings());
    const accountSettings = useMemo(() => accountSettingsWD.state === WebDataState.SUCCESS && accountSettingsWD.data, [accountSettingsWD]);
    const domains: IWebData<string[]> = useFluxStoreAsAny(AccountStore, (_prevState, store) => store.getDomains());
    const domain: string | undefined = React.useMemo(() => (domains.state === WebDataState.SUCCESS && domains.data.length && domains.data[0]) || undefined, [domains]);
    const features = useActiveAccountFeatures();
    const accountId = useActiveAccountId();
    const onActivity = React.useCallback(
        async () => {
            return debouncedSessionExtension(accountId);
        },
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
    return (
        <AutoLogoutHandler securitySettings={accountSettings?.security} domain={domain} onActivity={onActivity} sessionExpiredCheck={sessionExpiredCheck}>
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