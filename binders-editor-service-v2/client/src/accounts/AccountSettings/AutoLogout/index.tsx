import * as React from "react";
import { TFunction, useTranslation } from "@binders/client/lib/react/i18n";
import CheckBox from "@binders/ui-kit/lib/elements/checkbox";
import Dropdown from "@binders/ui-kit/lib/elements/dropdown";
import { SecuritySettings } from "@binders/client/lib/clients/accountservice/v1/contract";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { normalizeMinutesLabel } from "@binders/client/lib/util/time";
import { setSecuritySettings } from "../../actions";
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface Props {
    accountId: string;
    securitySettings: SecuritySettings;
}

const TIMEOUT_OPTIONS = [5, 15, 30, 60, 120];
const DEFAULT_TIMEOUT = 30;

const AutoLogout: React.FunctionComponent<Props> = ({ accountId, securitySettings }) => {
    const { t }: { t: TFunction } = useTranslation();

    const onUpdateAutoLogout = (autoLogout: boolean) => {
        setSecuritySettings(accountId, {
            ...securitySettings,
            autoLogout,
            ...(autoLogout && { autoLogoutPeriodMinutes: DEFAULT_TIMEOUT })
        });
    }

    const onSelectTimeout = (id: string) => {
        setSecuritySettings(accountId, {
            ...securitySettings,
            autoLogoutPeriodMinutes: id,
        });
    }

    return (
        <>
            <div className="media-settings-setting gap-sm">
                <CheckBox
                    label={t(TK.Account_PrefsAutoLogoutInfo)}
                    checked={securitySettings?.autoLogout || false}
                    onCheck={onUpdateAutoLogout}
                    iconStyle={{ marginTop: 0, paddingTop: 0 }}
                    labelStyle={{ marginTop: 0, paddingTop: 0 }}
                    style={{ marginTop: 0, paddingTop: 0 }}
                />
                {securitySettings?.autoLogout && (
                    <Dropdown
                        type="inactivityMinutes"
                        elements={TIMEOUT_OPTIONS.map(id => ({ id, label: normalizeMinutesLabel(id, t) }))}
                        className="media-settings-setting-select"
                        style={{ marginLeft: 25 }}
                        width={294}
                        selectedElementId={securitySettings?.autoLogoutPeriodMinutes || DEFAULT_TIMEOUT}
                        onSelectElement={onSelectTimeout}
                    />
                )}
            </div>
        </>
    );
};

export default AutoLogout;
