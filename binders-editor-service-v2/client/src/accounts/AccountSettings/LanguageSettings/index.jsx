import * as PropTypes from "prop-types";
import * as React from "react";
import { setDefaultInterfaceLanguage, setDefaultLanguageSettings } from "../../actions";
import FilterableDropdown from "@binders/ui-kit/lib/elements/dropdown/FilterableDropdown";
import MTSettingsSection from "../MTSettings/shared/MTSettingsSection";
import { PaneSection } from "../components";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { getLanguageElements } from "../../../browsing/tsHelpers";
import { languageResources } from "@binders/client/lib/i18n/resources";
import { withTranslation } from "@binders/client/lib/react/i18n";
import "../accountsettings.styl";

const userInterfaceLanguageOptions = languageResources.map(res => ({
    id: res.iso639_1,
    label: res.label,
    value: res.iso639_1,
}));

class LanguageSettings extends React.Component {

    constructor(props) {
        super(props);
        this.allLanguageElements = getLanguageElements().elements;

        this.onUpdateDefaultLanguage = this.onUpdateDefaultLanguage.bind(this);
        this.onClearDefaultLanguage = this.onClearDefaultLanguage.bind(this);
        this.onUpdateUserInterfaceLanguage = this.onUpdateUserInterfaceLanguage.bind(this);
        this.getSelectedInterfaceLanguage = this.getSelectedInterfaceLanguage.bind(this);
        this.renderDocumentLanguagesOptions = this.renderDocumentLanguagesOptions.bind(this);
        this.renderUserInterfaceLanguageOptions = this.renderUserInterfaceLanguageOptions.bind(this);

        this.state = {
            selectedLanguageCode: undefined,
            selectedInterfaceLanguage: undefined,
        };
    }

    onUpdateDefaultLanguage(languageCode) {
        const { accountId } = this.props;
        setDefaultLanguageSettings(accountId, { defaultCode: languageCode });
    }

    onUpdateUserInterfaceLanguage(interfaceLanguage) {
        const { accountId } = this.props;
        setDefaultInterfaceLanguage(accountId, { interfaceLanguage })
    }

    onClearDefaultLanguage() {
        const { accountId } = this.props;
        setDefaultLanguageSettings(accountId, { defaultCode: null });
    }

    getSelectedInterfaceLanguage() {
        const { settings } = this.props;
        return (!settings || !settings.interfaceLanguage) ? undefined : settings.interfaceLanguage;
    }

    renderDocumentLanguagesOptions() {
        const { settings, t } = this.props;

        return (
            <MTSettingsSection title={t(TK.Account_DefaultLanguage)}>
                <FilterableDropdown
                    className="media-settings-setting-select"
                    selectedElementId={settings?.defaultCode}
                    maxRows={5}
                    type={t(TK.General_Language)}
                    onSelectElement={this.onUpdateDefaultLanguage}
                    elements={this.allLanguageElements}
                />
                <span className="media-settings-setting-clear" onClick={this.onClearDefaultLanguage}>
                    {t(TK.Account_DefaultLanguageClear)}
                </span>
            </MTSettingsSection>
        )
    }

    renderUserInterfaceLanguageOptions() {
        const { t } = this.props;

        return (
            <MTSettingsSection title={t(TK.Account_UserInterfaceLanguage)}>
                <FilterableDropdown
                    className="media-settings-setting-select"
                    selectedElementId={this.getSelectedInterfaceLanguage()}
                    maxRows={5}
                    type={t(TK.General_Language)}
                    onSelectElement={this.onUpdateUserInterfaceLanguage}
                    elements={userInterfaceLanguageOptions}
                />
            </MTSettingsSection>
        );
    }

    render() {
        const { showInterfaceLanguagePreference, t } = this.props;
        return (
            <>
                <PaneSection label={t(TK.Account_PrefsSectionLanguageContent)}>
                    {this.renderDocumentLanguagesOptions()}
                </PaneSection>
                {showInterfaceLanguagePreference && <PaneSection label={t(TK.Account_PrefsSectionLanguageUI)}>
                    {this.renderUserInterfaceLanguageOptions()}
                </PaneSection>}
            </>
        )
    }

}

LanguageSettings.propTypes = {
    settings: PropTypes.object,
    onUpdateDefaultLanguage: PropTypes.func,
    showInterfaceLanguagePreference: PropTypes.bool
};

export default withTranslation()(LanguageSettings);
