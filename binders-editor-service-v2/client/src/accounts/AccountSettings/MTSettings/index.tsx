import * as React from "react";
import { IMTAccountSettings } from "@binders/client/lib/clients/accountservice/v1/contract";
import MTSettingsGeneralOrder from "./MTSettingsGeneralOrder";
import MTSettingsPairs from "./MTSettingsPairs";
import MTSettingsSection from "./shared/MTSettingsSection";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./mtSettings.styl";

interface IProps {
    accountId: string;
    mtSettings: IMTAccountSettings;
    accountFeatures: string[];
}

const MTSettings: React.FC<IProps> = ({ accountId, mtSettings, accountFeatures }) => {
    const { t } = useTranslation();
    return (
        <div className="media-settings mt-settings">
            <MTSettingsSection title={t(TK.Account_PrefsMTGeneralOrder)}>
                <MTSettingsGeneralOrder
                    accountId={accountId}
                    generalOrder={mtSettings.generalOrder}
                />
            </MTSettingsSection>
            <MTSettingsSection title={t(TK.Account_PrefsMTPairs)}>
                <MTSettingsPairs
                    accountId={accountId}
                    pairs={mtSettings.pairs || {}}
                    accountFeatures={accountFeatures}
                />
            </MTSettingsSection>
        </div>
    )
}

export default MTSettings
