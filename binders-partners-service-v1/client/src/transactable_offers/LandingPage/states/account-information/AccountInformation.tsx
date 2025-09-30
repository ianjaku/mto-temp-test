import * as React from "react";
import {
    FC,
    useMemo,
} from "react";
import { ResolvedMSPurchaseIdToken, ShortAccountInformation } from "@binders/client/lib/clients/accountservice/v1/contract";
import { BoxFooter } from "../../../../components/generic-box/box-footer/BoxFooter";
import { BoxHeader } from "../../../../components/generic-box/box-header/BoxHeader";
import Button from "@binders/ui-kit/lib/elements/button";
import { GenericBox } from "../../../../components/generic-box/GenericBox";
import { useAzureUserInfo } from "../../../../azure-ad-sso/useAzureUserInfo";
import "./account-information.styl";

const ListItem: FC<{
    label: string;
    value: string | number;
}> = (
    {label, value}
) => {
    return (
        <li className="account-information-list-item">
            <span className="account-information-list-label">
                {label}
            </span>
            <span className="account-information-list-value">
                {value}
            </span>
        </li>
    )
}

export const AccountInformation: FC<{
    accountInfo: ShortAccountInformation,
    purchaseInfo: ResolvedMSPurchaseIdToken
}> = (
    {accountInfo, purchaseInfo}
) => {
    const userInfo = useAzureUserInfo();
    const isExpired = useMemo(() => (
        new Date(accountInfo.expirationDate).getTime() > new Date().getTime()
    ), [accountInfo]);

    const editorUrl = useMemo(
        () => "https://" + accountInfo.domain.replace(".manual.to", ".editor.manual.to"),
        [accountInfo]
    );
    const readerUrl = useMemo(
        () => "https://" + accountInfo.domain,
        [accountInfo]
    );
    const redirectTo = (url: string) => {
        window.location.href = url;
    }

    return (
        <GenericBox>
            <BoxHeader>Hi! Welcome back {userInfo?.givenName} {userInfo?.surname},</BoxHeader>
            <div className="account-information">
                <h2 className="account-information-title">
                    Your account
                </h2>
                <ul className="account-information-list">
                    <ListItem
                        label="Organization"
                        value={accountInfo?.name}
                    />
                    <ListItem
                        label="Licenses"
                        value={purchaseInfo?.quantity}
                    />
                    <ListItem
                        label="Members"
                        value={accountInfo?.memberCount}
                    />
                    <ListItem
                        label="Status"
                        value={isExpired ? "Active" : "InActive"}
                    />
                </ul>
                <div className="account-information-buttons">
                    <Button
                        className="account-information-button"
                        text="Go to the reader"
                        onClick={() => redirectTo(readerUrl)}
                    />
                    <Button
                        className="account-information-button"
                        text="Go to the editor"
                        onClick={() => redirectTo(editorUrl)}
                    />
                </div>
                <BoxFooter />
            </div>
        </GenericBox>
    );
}
