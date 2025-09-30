import * as React from "react";
import { TFunction } from "@binders/client/lib/i18n";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import { updatePassword } from "../../api/credentials";
import { validatePasswordInput } from "@binders/client/lib/clients/validation";
import { withTranslation } from "@binders/client/lib/react/i18n";

interface UserPasswordProps {
    t: TFunction;
    user: User;
}

interface UserPasswordState {
    currentPassword: string;
    newPassword: string;
    newPasswordConfirmation: string;
}

class UserPassword extends React.Component<UserPasswordProps, UserPasswordState> {
    t: TFunction;

    buildOnUpdate(statusKey: keyof UserPasswordState) {
        const setState = this.setState.bind(this);
        return function(event) {
            const newState: Partial<UserPasswordState> = {};
            newState[statusKey] = event.target.value;
            setState(newState);
        };
    }

    buildValidationErrors() {
        let errors: string[] = [];
        if (this.state.newPassword.length > 0) {
            errors = errors.concat(validatePasswordInput(this.state.newPassword));
        }
        if (this.state.newPassword.length > 0 && this.state.newPasswordConfirmation.length > 0) {
            if (this.state.newPassword !== this.state.newPasswordConfirmation) {
                errors.push(this.t(TranslationKeys.User_PasswordsNoMatch));
            }
        }
        return errors;
    }

    constructor(props: UserPasswordProps) {
        super(props);
        this.t = props.t;
        this.state = {
            currentPassword: "",
            newPassword: "",
            newPasswordConfirmation: ""
        };
    }

    onSave() {
        updatePassword(this.props.user.id, this.props.user.login, this.state.currentPassword, this.state.newPassword);
        this.setState({
            currentPassword: "",
            newPassword: "",
            newPasswordConfirmation: ""
        });
    }

    render() {
        const renderInputRow = this.renderInputRow.bind(this);
        return (
            <div className="userDetails-layout">
                {renderInputRow(this.t(TranslationKeys.User_CurrentPassword), "password", "currentPassword")}
                {renderInputRow(this.t(TranslationKeys.User_NewPassword), "password", "newPassword")}
                {renderInputRow(this.t(TranslationKeys.User_RetypePassword), "password", "newPasswordConfirmation")}
                {this.renderFeedback()}
                {this.renderSave()}
            </div>
        );
    }

    renderErrors(errors: string[]) {
        return (
            <div className="validation">
                <ul className="validation-errors">
                    {errors.map((error, index) => (
                        <li className="validation-errors-item" key={`error-${index}`}>
                            {error}
                        </li>
                    ))}
                </ul>
            </div>
        );
    }

    renderSave() {
        if (this.state.currentPassword.length && this.state.newPassword && this.state.newPasswordConfirmation && this.buildValidationErrors().length === 0) {
            return this.renderSaveButton(true);
        } else {
            return this.renderSaveButton(false);
        }
    }

    renderFeedback() {
        const errors = this.buildValidationErrors();
        if (errors.length > 0) {
            return this.renderErrors(errors);
        }
        return undefined;
    }

    renderInputRow(label: string, inputType: React.HTMLInputTypeAttribute, statusKey: keyof UserPasswordState) {
        const value = this.state[statusKey];
        const onChange = this.buildOnUpdate(statusKey);

        return (
            <div className="userDetails-row">
                <div className="userDetails-label">{label}</div>
                <input type={inputType} className="userDetails-input" value={value} onChange={onChange} />
            </div>
        );
    }

    renderSaveButton(isActive: boolean) {
        const onSave = this.onSave.bind(this);
        return (
            <div
                className={"userDetails-button " + (!isActive ? "userDetails-button--disabled" : "")}
                onClick={isActive ? onSave : () => undefined}
            >
                <span className="userDetails-button-label">{this.t(TranslationKeys.User_UpdatePassword)}</span>
            </div>
        );
    }
}


export default withTranslation()(UserPassword);