import * as React from "react";
import {
    AccountFeatures,
    FEATURE_AUTOMATED_ITEM_SORTING,
    FEATURE_DOWNLOAD_PDF_FROM_READER,
    FEATURE_PDF_EXPORT,
    IAccountSortSettings,
    IPDFExportAccountSettings,
    IVisualsAccountSettings
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { PaneSection, TabPane } from "../components";
import { AccountSortingSettings } from "../AccountSortSettings";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import MediaSettings from "../MediaSettings";
import PDFExportSettings from "../PDFExportSettings";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import UsageReports from "../UsageReports/UsageReports";
import { useLaunchDarklyFlagValue } from "@binders/ui-kit/lib/thirdparty/launchdarkly/hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";

export type ContentProps = {
    accountId: string;
    accountFeatures: AccountFeatures;
    enableAudioFeature: boolean;
    pdfExport: IPDFExportAccountSettings | undefined;
    sorting: IAccountSortSettings | undefined;
    visuals: IVisualsAccountSettings | undefined;
};

export function Content({
    accountId,
    accountFeatures,
    enableAudioFeature,
    pdfExport,
    sorting,
    visuals,
}: ContentProps) {
    const showPDFExportSettings = accountFeatures ?
        (
            accountFeatures.includes(FEATURE_PDF_EXPORT) ||
            accountFeatures.includes(FEATURE_DOWNLOAD_PDF_FROM_READER)
        ) :
        undefined;
    const { t } = useTranslation();
    const hasAdminGenerateReportsFlag = useLaunchDarklyFlagValue<boolean>(LDFlags.ACCOUNT_ADMINS_CAN_GENERATE_ACCOUNT_REPORTS);
    return (
        <TabPane>
            <PaneSection label={t(TK.Account_PrefsSectionMediaPreferences)}>
                <MediaSettings
                    accountId={accountId}
                    settings={visuals}
                    enableAudioFeature={enableAudioFeature}
                />
            </PaneSection>
            <PaneSection label={t(TK.Account_PrefsSectionItemSorting)} isVerticalAlignHack={true} visible={accountFeatures.includes(FEATURE_AUTOMATED_ITEM_SORTING)}>
                <AccountSortingSettings
                    accountId={accountId}
                    settings={sorting}
                />
            </PaneSection>
            <PaneSection label={t(TK.Account_PrefsSectionPdfExport)} visible={showPDFExportSettings}>
                <PDFExportSettings
                    accountId={accountId}
                    settings={pdfExport || {}}
                />
            </PaneSection>
            <PaneSection
                label={t(TK.Account_PrefsSectionUsageReports)}
                visible={hasAdminGenerateReportsFlag}
            >
                <UsageReports
                    accountId={accountId}
                />
            </PaneSection>
        </TabPane>
    );
}
