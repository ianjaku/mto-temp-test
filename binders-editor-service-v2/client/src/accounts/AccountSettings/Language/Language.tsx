/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import { PaneSection, TabPane } from "../components";
import LanguageSettings from "../LanguageSettings";
import MTSettings from "../MTSettings";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { useTranslation } from "@binders/client/lib/react/i18n";

export type LanguageProps = {
    accountId: string;
    mtSettings: any;
    accountFeatures: any;
    showInterfaceLanguagePreference: boolean;
    languages: any;
};

export function Language({
    accountId,
    accountFeatures,
    mtSettings,
    showInterfaceLanguagePreference,
    languages,
}: LanguageProps) {
    const { t } = useTranslation();
    return (
        <TabPane>
            <PaneSection label={t(TK.Account_PrefsSectionMachineTranslation)}>
                <MTSettings
                    accountId={accountId}
                    mtSettings={mtSettings || {}}
                    accountFeatures={accountFeatures}
                />
            </PaneSection>
            <LanguageSettings
                accountId={accountId}
                settings={languages}
                showInterfaceLanguagePreference={showInterfaceLanguagePreference}
            />

        </TabPane>
    )
}
