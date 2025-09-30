import * as React from "react";
import { defaultLanguage, switchInterfaceLanguage } from "@binders/client/lib/i18n";
import Button from "../../elements/button";
import Dropdown from "../../elements/dropdown";
import IconAccount from "../../elements/icons/Account";
import IconAt from "../../elements/icons/At";
import IconPassword from "../../elements/icons/Password";
import InputWithIcon from "../../elements/input/InputWithIcon";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import autobind from "class-autobind";
import { buildUserName } from "@binders/client/lib/clients/userservice/v1/helpers";
import { isEnterPressed } from "../../helpers/helpers";
import { withTheme } from "@material-ui/core/styles";
import { withTranslation } from "@binders/client/lib/react/i18n";
import "./invitationForm.styl";

const interfaceLanguages = [
    {
        id: "en",
        label: "English",
    },
    {
        id: "nl",
        label: "Nederlands",
    },
    {
        id: "fr",
        label: "Français",
    },
];

export interface IInvitationFormProps {
    displayName?: string;
    firstName?: string;
    lastName?: string;
    token?: string;
    theme?: { palette };
    onConfirmChanges: (name: string, password: string, token: string, domain: string, interfaceLanguage?: string) => void;
    validatePasswordInput: (password: string, confirmPassword: string) => string[];
    isDisplayNameEditable?: boolean;
    showInterfaceLanguageChoice?: boolean;
    language?: string;
}

export interface IInvitationFormState {
    password: string;
    confirmPassword: string;
    // eslint-disable-next-line @typescript-eslint/ban-types
    errors: object;
    displayName?: string;
    token?: string;
    interfaceLanguage?: string;
    domain?: string;
}

class InvitationForm extends React.Component<IInvitationFormProps, IInvitationFormState> {
    private t;
    constructor(props) {
        super(props);
        this.t = props.t;
        const interfaceLanguage = props.language;
        if (interfaceLanguage !== defaultLanguage) {
            switchInterfaceLanguage(interfaceLanguage);
        }
        autobind(this);
        this.state = Object.assign(
            {
                confirmPassword: "",
                errors: {},
                password: "",
            },
            props,
            {
                displayName: this.props.isDisplayNameEditable ?
                    buildUserName({
                        firstName: this.props.firstName,
                        lastName: this.props.lastName,
                        displayName: this.props.displayName,
                    }) :
                    this.props.displayName,
            },
        );
    }

    public componentDidMount() {
        const params = new URLSearchParams(
            window?.location?.search ?? {}
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const domain = params.get("domain") || (window as any)?.bindersConfig?.domain || (window as any)?.hostname || window?.location?.hostname;
        this.setState({ domain });
    }

    public render() {
        const domainTitleEl = this.getDomainTitleEl();
        const { showInterfaceLanguageChoice } = this.props;
        return (
            <div className="editForm" tabIndex={0} onKeyDown={this.onEnter}>
                <div className="editForm-info">
                    <div className="editForm-info-title">{this.t(TranslationKeys.General_WelcomeToDomain)}{domainTitleEl}</div>
                    <div className="editForm-info-description">{this.t(TranslationKeys.User_VerifyEmailPassword)}</div>
                </div>
                <div className="editForm-content" style={{ borderColor: this.props.theme.palette.primary }}>
                    {this.renderRow(this.t(TranslationKeys.User_YourEmail), "login", false, "text", <IconAt />)}
                    {this.renderRow(this.t(TranslationKeys.User_YourName), "displayName", this.props.isDisplayNameEditable, "text", <IconAccount />)}
                    {this.renderRow(this.t(TranslationKeys.User_SetPassword), "password", true, "password", <IconPassword />)}
                    {this.renderRow(this.t(TranslationKeys.User_RepeatPassword), "confirmPassword", true, "password", <IconPassword />)}
                    {showInterfaceLanguageChoice && (
                        <Dropdown
                            onSelectElement={this.onChange("interfaceLanguage")}
                            type={this.t(TranslationKeys.User_LanguagePreferenceInterface)}
                            elements={interfaceLanguages}
                            className="editForm-dropdown"
                        />
                    )}
                    <div className="editForm-confirm">
                        <Button onClick={this.onClickSave} text={this.t(TranslationKeys.General_Confirm)} />
                    </div>
                </div>
            </div>
        );
    }

    private onEnter(e) {
        if (isEnterPressed(e)) {
            this.onClickSave();
        }
    }

    private onChange(name) {
        const setState = this.setState.bind(this);
        return function(newValue) {
            setState({ [name]: newValue, errors: {} });
        };
    }

    private onClickSave() {
        const { displayName: defaultName, onConfirmChanges } = this.props;
        const { displayName: currentName, password, token, interfaceLanguage, domain } = this.state;
        const errors = { ...this.validatePassword(), ...this.validateDisplayName() };
        if (Object.keys(errors).length > 0) {
            this.setState({ errors });
            return;
        }
        onConfirmChanges(
            (currentName.length > 0 ? currentName : defaultName).trim(),
            password,
            token,
            domain,
            interfaceLanguage,
        );
    }

    private getDomainParts() {
        const host = window.location.hostname;
        if (!host.includes(".")) {
            return {
                prefix: "local",
                suffix: "dev"
            };
        }
        const { domain } = this.state;
        const domainParts = domain.split(".");
        const prefixes = domainParts.slice(0, domainParts.length - 2);
        const suffixes = domainParts.slice(domainParts.length - 2);
        return {
            prefix: prefixes.join("."),
            suffix: suffixes.join("."),
        };
    }

    private getDomainTitleEl() {
        if (!this.state.domain) {
            return null;
        }
        const { prefix, suffix } = this.getDomainParts();
        return (
            <span>
                <span className="domain-prefix">{prefix}</span>
                <span className="domain-suffix">.{suffix}</span>
            </span>
        );
    }

    private renderRow(label, name, isEditable, type = "text", icon = null) {
        return (
            <div>
                <div className="editForm-input">
                    <InputWithIcon
                        type={type}
                        name={name}
                        icon={icon}
                        placeholder={label}
                        value={this.state[name]}
                        onChange={this.onChange(name)}
                        disabled={!isEditable}
                        className="editForm-input-field"
                    />
                </div>
                <div className="editForm-validation">
                    {this.state.errors[name] && this.state.errors[name].map((el, i) => <span key={i} className="editForm-validation-errors-item">{el}</span>)}
                </div>
            </div>
        );
    }

    private validatePassword() {
        let result = {}
        const errors = this.props.validatePasswordInput(this.state.password, this.state.confirmPassword);
        if (errors.length > 0) {
            result = { password: errors };
        }
        if (this.state.password !== this.state.confirmPassword) {
            result = { ...result, confirmPassword: [this.t(TranslationKeys.User_PasswordsNoMatch)] };
        }
        return result;
    }

    private validateDisplayName() {
        return (this.state.displayName?.trim().length ?? 0) === 0 ?
            { displayName: [this.t(TranslationKeys.User_DisplayNameErrorEmpty)] } :
            {};
    }
}


export default (withTheme(withTranslation()(InvitationForm)))
