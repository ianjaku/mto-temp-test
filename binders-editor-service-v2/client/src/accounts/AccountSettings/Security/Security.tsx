/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import {
    FEATURE_AUTOLOGOUT,
    FEATURE_USERTOKEN_LOGIN,
    IAccountSettings
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { PaneSection, TabPane } from "../components";
import AutoLogout from "../AutoLogout";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import UserTokenSecret from "../UserTokenSecret";
import { useActiveAccountFeatures } from "../../hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";

export type SecurityProps = {
    accountId: string;
    accountSettings: IAccountSettings;
};

export function Security({
    accountId,
    accountSettings,
}: SecurityProps) {
    const { t } = useTranslation();
    const features = useActiveAccountFeatures();

    return (
        <TabPane>
            {features.includes(FEATURE_USERTOKEN_LOGIN) && (
                <PaneSection label={t(TK.Account_UserTokenSecret)} isVerticalAlignHack={true}>
                    <UserTokenSecret
                        accountId={accountId}
                        userTokenSecret={(accountSettings.userTokenSecret) || ""}
                    />
                </PaneSection>
            )}
            {features.includes(FEATURE_AUTOLOGOUT) && (
                <PaneSection label={t(TK.Account_PrefsAutoLogout)} isVerticalAlignHack={true}>
                    <AutoLogout accountId={accountId} securitySettings={accountSettings.security} />
                </PaneSection>
            )}
        </TabPane>
    )
}
