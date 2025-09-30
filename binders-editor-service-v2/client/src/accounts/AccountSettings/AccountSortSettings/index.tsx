import * as React from "react";
import {
    AccountSortMethod,
    IAccountSortSettings
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { FC, useEffect, useState } from "react";
import { ACTION_UPDATE_SORT_METHOD } from "../../store";
import { APISetAccountSortMethod } from "../../api";
import Dropdown from "@binders/ui-kit/lib/elements/dropdown";
import MTSettingsSection from "../MTSettings/shared/MTSettingsSection";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { dispatch } from "@binders/client/lib/react/flux/dispatcher";
import { useTranslation } from "@binders/client/lib/react/i18n";

export const AccountSortingSettings: FC<{
    accountId: string;
    settings: IAccountSortSettings | undefined;
}> = ({ accountId, settings }) => {
    const { t } = useTranslation();
    const [sortMethod, setSortMethod] = useState<AccountSortMethod>();

    useEffect(() => {
        setSortMethod(settings?.sortMethod);
    }, [settings?.sortMethod]);

    const updateSortMethod = async (sortMethod: AccountSortMethod) => {
        await APISetAccountSortMethod(accountId, sortMethod);
        setSortMethod(sortMethod);
        dispatch({
            type: ACTION_UPDATE_SORT_METHOD,
            body: sortMethod,
        });
    }

    return (
        <div className="media-settings-setting">
            <MTSettingsSection title={t(TK.Account_ItemSortingOption)} isRow={true}>
                <Dropdown
                    className="media-settings-setting-select"
                    onSelectElement={updateSortMethod}
                    elements={[
                        {
                            id: AccountSortMethod.Alphabetical,
                            label: t(TK.Account_Alphabetically)
                        },
                        {
                            id: AccountSortMethod.Numerical,
                            label: t(TK.Account_Numerically)
                        },
                        {
                            id: AccountSortMethod.CollectionsFirst,
                            label: t(TK.Account_Collections_First)
                        },
                        {
                            id: AccountSortMethod.None,
                            label: t(TK.Account_Default)
                        }
                    ]}
                    selectedElementId={sortMethod}
                    type="single"
                />
            </MTSettingsSection>
            <ul className="settings-info">
                <li className="settings-info-item">
                    <strong className="settings-info-item-title">
                        { t(TK.Account_Alphabetically) }
                    </strong>
                    { t(TK.Account_Alphabetically_SortInfo) }
                </li>
                <li className="settings-info-item">
                    <strong className="settings-info-item-title">
                        { t(TK.Account_Numerically) }
                    </strong>
                    { t(TK.Account_Numerically_SortInfo) }
                </li>
                <li className="settings-info-item">
                    <strong className="settings-info-item-title">
                        { t(TK.Account_Collections_First) }
                    </strong>
                    { t(TK.Account_Collections_First_SortInfo) }
                </li>
                <li className="settings-info-item">
                    <strong className="settings-info-item-title">
                        { t(TK.Account_Default) }
                    </strong>
                    { t(TK.Account_Default_SortInfo) }
                </li>
            </ul>
        </div>
    )
}
