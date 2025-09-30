import * as React from "react";
import ColorPicker from "@binders/ui-kit/lib/elements/colorpicker";
import { IVisualsAccountSettings } from "@binders/client/lib/clients/accountservice/v1/contract";
import MTSettingsSection from "../MTSettings/shared/MTSettingsSection";
import RadioButton from "@binders/ui-kit/lib/elements/RadioButton";
import RadioButtonGroup from "@binders/ui-kit/lib/elements/RadioButton/RadioButtonGroup";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import Toggle from "@binders/ui-kit/lib/elements/toggle/Toggle";
import { setDefaultVisualSettings } from "../../actions";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "../accountsettings.styl";

const radioStyles = {
    mainStyle: {
        padding: 0,
        paddingRight: 8,
    },
    iconStyle: {
        marginRight: 8,
        width: 16,
        height: 16,
    },
};

const MediaSettings: React.FC<{
    accountId: string;
    enableAudioFeature: boolean;
    settings: IVisualsAccountSettings;
}> = ({ accountId, enableAudioFeature, settings }) => {
    const { t } = useTranslation();

    const onUpdateFitBehaviour = React.useCallback((_e, fitBehaviour: string) => {
        setDefaultVisualSettings(accountId, { ...settings, fitBehaviour });
    }, [accountId, settings]);

    const onUpdateBackgroundColor = React.useCallback((bgColor: string) => {
        setDefaultVisualSettings(accountId, { ...settings, bgColor });
    }, [accountId, settings]);

    const onUpdateAudioOnVideos = React.useCallback(() => {
        const audioEnabled = !settings.audioEnabled;
        setDefaultVisualSettings(accountId, { ...settings, audioEnabled });
    }, [accountId, settings]);

    return (
        <div className="media-settings">
            <MTSettingsSection title={t(TK.Account_MediaDefaultFit)}>
                <RadioButtonGroup
                    name="behaviour"
                    className="media-settings-setting-radios"
                    value={settings?.fitBehaviour ?? "crop"}
                    onChange={onUpdateFitBehaviour}
                >
                    <RadioButton
                        value="crop"
                        label={t(TK.Visual_Crop)}
                        style={radioStyles.mainStyle}
                        iconStyle={radioStyles.iconStyle}
                    />
                    <RadioButton
                        value="fit"
                        label={t(TK.Visual_Fit)}
                        style={radioStyles.mainStyle}
                        iconStyle={radioStyles.iconStyle}
                    />
                </RadioButtonGroup>
            </MTSettingsSection>
            <MTSettingsSection title={t(TK.Account_MediaDefaultBg)}>
                <ColorPicker
                    onColorSelect={onUpdateBackgroundColor}
                    defaultHexColor={settings?.bgColor || "#FFFFFF"}
                />
            </MTSettingsSection>
            {enableAudioFeature && (
                <MTSettingsSection title={t(TK.Visual_EnableAudioDefault)}>
                    <Toggle
                        isToggled={settings?.audioEnabled}
                        onToggle={onUpdateAudioOnVideos}
                        isEnabled={true}
                    />
                </MTSettingsSection>
            )}
        </div>
    );
}

export default MediaSettings;
