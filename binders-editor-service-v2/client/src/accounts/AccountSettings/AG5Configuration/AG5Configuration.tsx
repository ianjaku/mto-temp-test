import * as React from "react";
import { PaneSection, TabPane } from "../components";
import { useCallback, useEffect, useState } from "react";
import { AG5Settings, } from "@binders/client/lib/clients/accountservice/v1/contract";
import Button from "@binders/ui-kit/lib/elements/button";
import { FlashMessages } from "../../../logging/FlashMessages";
import Icon from "@binders/ui-kit/lib/elements/icons";
import Input from "@binders/ui-kit/lib/elements/input";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import cx from "classnames";
import { setAG5Settings } from "../../actions";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./AG5Configuration.styl";

export type SecurityProps = {
    accountId: string;
    ag5Settings: AG5Settings;
    isDirty: boolean;
    setIsDirty: (value: boolean) => void;
};

export function AG5Configuration({
    accountId,
    ag5Settings: ag5SettingsProp,
    isDirty,
    setIsDirty,
}: SecurityProps) {
    const { t } = useTranslation();

    const [ag5SettingsLocal, setAG5SettingsLocal] = useState(ag5SettingsProp);

    useEffect(() => {
        setIsDirty(JSON.stringify(ag5SettingsLocal) !== JSON.stringify(ag5SettingsProp));
    }, [ag5SettingsLocal, ag5SettingsProp, setIsDirty]);

    const [isSaving, setIsSaving] = useState(false);
    const cancelChanges = () => {
        setAG5SettingsLocal(ag5SettingsProp);
    }

    const saveChanges = useCallback(() => {
        setIsSaving(true);
        setAG5Settings(accountId, ag5SettingsLocal)
            .then(() => {
                FlashMessages.success(t(TK.General_SettingsSaved));
            })
            .catch((ex) => FlashMessages.error(ex, true))
            .then(() => setIsSaving(false));
    }, [accountId, ag5SettingsLocal, t]);

    useEffect(() => {
        setAG5SettingsLocal(ag5SettingsProp);
    }, [ag5SettingsProp]);

    const [inputType, setInputType] = useState("password");
    const footerVisible = isDirty || isSaving;

    return (
        <div className={cx("ag5-configuration", { "ag5-configuration--footer-visible": footerVisible })}>
            <TabPane>
                <PaneSection label={t(TK.Account_PrefsAG5_ApiKey)} isVerticalAlignHack={true}>
                    <div className={cx("media-settings-setting", "media-settings-setting-as-row")}>
                        <Input
                            type={inputType}
                            value={ag5SettingsLocal?.apiKey || ""}
                            onChange={value => setAG5SettingsLocal({
                                ...ag5SettingsLocal,
                                apiKey: value,
                            })}
                        />
                        <span
                            className="media-settings-setting-icon"
                            onClick={() => {
                                setInputType(inputType === "password" ? "text" : "password");
                            }}
                        >
                            <Icon
                                name={inputType === "password" ? "visibility" : "visibility_off"}
                            />
                        </span>
                    </div>
                </PaneSection>
            </TabPane >
            <div className={cx(
                "ag5-configuration-footer",
                { "ag5-configuration-footer--visible": footerVisible }
            )}>
                {!isSaving && <Button
                    text={t(TK.General_Cancel)}
                    secondary
                    onClick={cancelChanges}
                />}
                <Button
                    className={"save-btn"}
                    text={isSaving ? t(TK.Edit_SaveInProgress) : t(TK.General_Save)}
                    CTA
                    onClick={saveChanges}
                    inactiveWithLoader={isSaving}
                    isEnabled={!isSaving}
                />
            </div>
        </div>
    )
}
