import * as React from "react";
import { FaIconBars, FaIconTimes } from "@binders/client/lib/react/icons/font-awesome";
import { TFunction, withTranslation } from "@binders/client/lib/react/i18n";
import { FEATURE_INTERFACE_I18N } from "@binders/client/lib/clients/accountservice/v1/contract";
import Select from "react-select";
import Sortable from "@binders/ui-kit/lib/elements/sortable";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import autobind from "class-autobind";
import { getAllLanguageCodes } from "@binders/client/lib/languages/helper";
import { getAvailableInterfaceLanguages } from "@binders/client/lib/i18n/resources";
import { getLanguageLabel } from "../../utils/languages";
import { reorder } from "@binders/client/lib/dnd/helpers";
import "./readerpreferences.styl";

const INTERFACE_LANGS = getAvailableInterfaceLanguages();

export type ReaderPreferencesProps = {
    accountFeatures;
    interfaceLanguage: string | undefined;
    readerLanguages: string[] | undefined;
    onClearUserInterfaceLanguage: () => void;
    onUpdateInterfaceLanguage: (_: string) => void;
    onUpdateReaderLanguages: (languages: string[]) => void;
    t: TFunction;
}

type ReaderPreferencesState = {
    interfaceLanguage: string | undefined;
    readerLanguages: string[];
    showInterfaceLanguagePreference: boolean;
}

export class ReaderPreferences extends React.Component<ReaderPreferencesProps, ReaderPreferencesState> {
    private readonly t: TFunction;
    private readonly allLanguages: { value: string, label: string }[];

    UNSAFE_componentWillReceiveProps(props: ReaderPreferencesProps) {
        this.setState(this.getStateFromProps(props));
    }

    constructor(props: ReaderPreferencesProps) {
        super(props);
        this.t = props.t;
        autobind(this);
        this.state = this.getStateFromProps(props);
        this.allLanguages = getAllLanguageCodes().map(languageCode => {
            return {
                value: languageCode,
                label: getLanguageLabel(languageCode)
            };
        });
    }

    getStateFromProps(props: ReaderPreferencesProps): ReaderPreferencesState {
        return {
            readerLanguages: props.readerLanguages ? props.readerLanguages : [],
            interfaceLanguage: props.interfaceLanguage ? props.interfaceLanguage : undefined,
            showInterfaceLanguagePreference: props.accountFeatures.includes(FEATURE_INTERFACE_I18N)
        };
    }

    onClearInterfaceLanguage() {
        if (this.props.onUpdateInterfaceLanguage) {
            this.props.onClearUserInterfaceLanguage();
        }
    }

    onAddLanguage(language: { value: string, label: string }) {
        const currentLanguages = this.state.readerLanguages;
        const readerLanguages = currentLanguages.concat([language.value]);
        this.updateReaderLanguages(readerLanguages);
    }

    onRemove(index: number) {
        const currentLanguages = this.state.readerLanguages;
        const readerLanguages = currentLanguages.slice(0, index).concat(currentLanguages.slice(index + 1));
        this.updateReaderLanguages(readerLanguages);
    }

    renderReaderLanguagePreference() {
        return (
            <div className="userDetails-layout">
                <div className="userDetails-title">{this.t(TranslationKeys.User_LanguagePreferences)}</div>
                {this.renderSelectedReaderLanguages()}
                {this.renderNewLanguage()}
            </div>
        );
    }

    renderInterfaceLanguagePreference() {
        return (
            <div className="userDetails-layout">
                <div className="userDetails-title">{this.t(TranslationKeys.User_LanguagePreferenceInterface)}</div>
                {this.renderInterfaceLanguage()}
                {this.state.interfaceLanguage &&
                    <span
                        className="preferences-setting-clear"
                        onClick={this.onClearInterfaceLanguage}>
                        {this.t(TranslationKeys.User_ClearLanguagePreferenceInterface)}
                    </span>
                }
            </div>
        );
    }

    render() {
        const { showInterfaceLanguagePreference } = this.state;
        return (
            <>
                {this.renderReaderLanguagePreference()}
                {showInterfaceLanguagePreference && this.renderInterfaceLanguagePreference()}
            </>
        );
    }

    renderNewLanguage() {
        const options = this.allLanguages.filter(lang => this.state.readerLanguages.indexOf(lang.value) === -1);
        return (
            <div className="preferences-languagePicker">
                <Select
                    options={options}
                    placeholder={this.t(TranslationKeys.User_LanguagePreferenceAdd)}
                    searchable
                    autoBlur
                    arrowRenderer={() => {
                        return "";
                    }}
                    value={null}
                    onChange={this.onAddLanguage.bind(this)}
                />
            </div>
        );
    }

    renderInterfaceLanguage() {
        const { interfaceLanguage } = this.state;
        return (
            <div className="preferences-languagePicker">
                <Select
                    options={INTERFACE_LANGS}
                    placeholder={this.t(TranslationKeys.User_LanguagePreferenceChoose)}
                    searchable
                    autoBlur
                    arrowRenderer={() => {
                        return "";
                    }}
                    value={interfaceLanguage ? INTERFACE_LANGS.find(l => l.value === interfaceLanguage) : null}
                    onChange={this.updateInterfaceLanguage.bind(this)}
                />
            </div>
        );
    }

    onReorderLanguages(startIndex: number, endIndex: number) {
        this.updateReaderLanguages(
            reorder(this.state.readerLanguages, startIndex, endIndex)
        );
    }

    renderSelectedReaderLanguages() {
        if (this.state.readerLanguages.length === 0) {
            return <div>{this.t(TranslationKeys.User_LanguagePreferenceChoose)}</div>;
        }
        const languages = this.state.readerLanguages.map((languageCode, index) => {
            const languageLabel = getLanguageLabel(languageCode);
            const languageKey = `language-${index}`;
            const onRemove = () => this.onRemove.bind(this)(index);
            const remove = (
                <div onClick={onRemove}>
                    <FaIconTimes id={`delete-${languageCode}`} className="u-active" />
                </div>
            );
            return (
                <div key={`rl${languageCode}`}>
                    <div
                        key={languageKey}
                        className="preferences-language"
                    >
                        <div className="preferences-language-dnd">
                            {/* <div {...provided.dragHandleProps}> */}
                            <div>
                                <FaIconBars className="u-active" />
                            </div>
                        </div>
                        <div className="preferences-language-order">{index + 1}</div>
                        <div className="preferences-language-name">{languageLabel}</div>
                        <div className="preferences-language-remove">{remove}</div>
                    </div>
                </div>
            );
        });
        return (
            <div>
                <div className="preferences">
                    <div className="preferences-body">
                        <Sortable onReorder={this.onReorderLanguages}>
                            {languages}
                        </Sortable>
                    </div>
                </div>
            </div>
        );
    }

    updateReaderLanguages(readerLanguages: string[]) {
        if (this.props.onUpdateReaderLanguages) {
            this.props.onUpdateReaderLanguages(readerLanguages);
        }
        this.setState({ readerLanguages });
    }

    updateInterfaceLanguage(interfaceLanguage: { label: string; value: string }) {
        if (this.props.onUpdateInterfaceLanguage) {
            this.props.onUpdateInterfaceLanguage(interfaceLanguage.value);
        }
        this.setState({ interfaceLanguage: interfaceLanguage.value });
    }
}

export default withTranslation()(ReaderPreferences);
