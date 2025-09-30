import * as React from "react";
import {
    FEATURE_AD_SSO,
    FEATURE_AG5,
    FEATURE_AUTOLOGOUT,
    FEATURE_INTERFACE_I18N,
    FEATURE_TERMS_AND_CONDITIONS,
    FEATURE_USERTOKEN_LOGIN,
    FEATURE_VIDEOS_WITH_AUDIO,
    ISAMLSSOSettings,
    ISSOAccountSettings
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { Pane, Tabs } from "@binders/ui-kit/lib/elements/tabs";
import {
    useActiveAccount,
    useActiveAccountFeatures,
    useActiveAccountId,
    useActiveAccountSettings
} from "../hooks";
import {
    useGetAccountUsergroupsExcludingAutoManaged,
    useGetMappedUserGroups
} from "../../users/query";
import { AG5Configuration } from "./AG5Configuration";
import { Content } from "./Content";
import { FlashMessages } from "../../logging/FlashMessages";
import { Language } from "./Language";
import SSOConfiguration from "./SSOConfiguration";
import { Security } from "./Security";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import TermsAndConditionsView from "./TermsAndConditionsView";
import { useTranslation } from "@binders/client/lib/react/i18n";

const defaultSSOSettings = {
    tenantId: undefined,
    enabled: false,
    issuer: undefined,
    entryPoint: undefined,
    certificateName: undefined,
    autoRedirect: false,  // Default DB value
    ssoButtonText: null,  // Default DB value
};

function getDefaultSAMLSettings(ssoSettings: ISSOAccountSettings | undefined): ISAMLSSOSettings {
    if (!ssoSettings) {
        return defaultSSOSettings;
    }
    return { ...defaultSSOSettings, ...ssoSettings.saml };
}

export const AccountSettings: React.FC = () => {
    const { t } = useTranslation();
    const accountFeatures = useActiveAccountFeatures();
    const accountId = useActiveAccountId();
    const accountSettings = useActiveAccountSettings();
    const activeAccount = useActiveAccount();
    const usergroups = useGetAccountUsergroupsExcludingAutoManaged();
    const mappedGroups = useGetMappedUserGroups(accountId);

    const showInterfaceLanguagePreference = accountFeatures?.includes(FEATURE_INTERFACE_I18N);
    const enableAudioFeature = accountFeatures?.includes(FEATURE_VIDEOS_WITH_AUDIO);
    const isAdmin = activeAccount && activeAccount.amIAdmin;
    const enabledUserTokenLogin = accountFeatures?.includes(FEATURE_USERTOKEN_LOGIN);
    const enabledAutoLogout = accountFeatures?.includes(FEATURE_AUTOLOGOUT);
    const showTermsAndConditions = accountFeatures?.includes(FEATURE_TERMS_AND_CONDITIONS);
    const showSecurity = isAdmin && (enabledUserTokenLogin || enabledAutoLogout);

    const [currentTabDirty, setCurrentTabDirty] = React.useState<boolean>(false);
    const checkTabDirty = React.useCallback(() => {
        if (currentTabDirty) {
            FlashMessages.error(t(TK.General_UnsavedChangesNavigationError));
        }
        return currentTabDirty;
    }, [currentTabDirty, t]);

    const ssoConfiguration = React.useMemo(() => getDefaultSAMLSettings(accountSettings?.sso), [accountSettings?.sso]);
    return (
        <div className="account-settings">
            <Tabs>
                <Pane label={t(TK.Account_PrefsTabContent)} onClick={checkTabDirty}>
                    <Content
                        accountId={accountId}
                        accountFeatures={accountFeatures}
                        visuals={accountSettings.visuals}
                        enableAudioFeature={enableAudioFeature}
                        sorting={accountSettings.sorting}
                        pdfExport={accountSettings.pdfExport}
                    />
                </Pane>

                <Pane label={t(TK.Account_PrefsTabLanguage)} onClick={checkTabDirty}>
                    <Language
                        accountId={accountId}
                        languages={accountSettings.languages}
                        showInterfaceLanguagePreference={showInterfaceLanguagePreference}
                        mtSettings={accountSettings.mt || {}}
                        accountFeatures={accountFeatures}
                    />
                </Pane>

                {showSecurity && (
                    <Pane label={t(TK.Account_PrefsTabSecurity)} onClick={checkTabDirty}>
                        <Security
                            accountId={accountId}
                            accountSettings={accountSettings}
                        />
                    </Pane>
                )}

                {accountFeatures.includes(FEATURE_AD_SSO) && (
                    <Pane label={"SSO"} onClick={checkTabDirty}>
                        <SSOConfiguration
                            accountId={accountId}
                            settings={ssoConfiguration}
                            usergroups={usergroups.data ?? []}
                            mappedGroups={mappedGroups.data ?? []}
                            isDirty={currentTabDirty}
                            setIsDirty={setCurrentTabDirty}
                        />
                    </Pane>
                )}

                {accountFeatures.includes(FEATURE_AG5) && (
                    <Pane label="AG5" onClick={checkTabDirty}>
                        <AG5Configuration
                            accountId={accountId}
                            ag5Settings={accountSettings.ag5}
                            isDirty={currentTabDirty}
                            setIsDirty={setCurrentTabDirty}
                        />
                    </Pane>
                )}

                {showTermsAndConditions && (
                    <Pane label={t(TK.General_TermsTitle)} onClick={checkTabDirty}>
                        <TermsAndConditionsView
                            accountId={accountId}
                        />
                    </Pane>
                )}
            </Tabs>
        </div >
    );
}
