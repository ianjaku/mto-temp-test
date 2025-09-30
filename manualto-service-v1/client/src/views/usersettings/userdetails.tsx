import * as React from "react";
import { TFunction, withTranslation } from "@binders/client/lib/react/i18n";
import { FlashMessageActions } from "@binders/client/lib/react/flashmessages/actions";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import { updateUser } from "../../stores/actions/user";

type UserDetailsSettingsProps = {
    accountId: string;
    userDetails: User;
    t: TFunction;
}

type UserDetailsSettingsState = {
    userDetails: UserDetailsSettingsProps["userDetails"]
}

class UserDetailsSettings extends React.Component<UserDetailsSettingsProps, UserDetailsSettingsState> {
    private readonly t: TFunction;

    UNSAFE_componentWillReceiveProps(props: UserDetailsSettingsProps) {
        this.setState(this.getStateFromProps(props));
    }

    constructor(props: UserDetailsSettingsProps) {
        super(props);
        this.t = props.t;
        this.state = this.getStateFromProps(props);
    }

    getStateFromProps(props: UserDetailsSettingsProps) {
        return {
            userDetails: props.userDetails
        };
    }

    onChangeDisplayName(change) {
        const displayName = change.target.value;
        const userDetails = Object.assign({}, this.state.userDetails, { displayName });
        this.setState({ userDetails });
    }

    render() {
        const onChangeDisplayName = this.onChangeDisplayName.bind(this);
        return (
            <div className="userDetails-layout" data-private-nocookie>
                <div className="userDetails-title">{this.t(TranslationKeys.User_UserPreferences)}</div>
                {this.renderDataRow(this.t(TranslationKeys.General_Email), this.state.userDetails.login)}
                {this.renderDataRow(this.t(TranslationKeys.User_DisplayName), this.state.userDetails.displayName, onChangeDisplayName)}
                {this.renderSaveButton()}
            </div>
        );
    }

    renderDataRow(label: string, value: string, onChange = null) {
        return (
            <div className="userDetails-row">
                <div className="userDetails-label">{label}</div>
                {!onChange ?
                    <p className="userDetails-input userDetails-input--disabled">{value}</p> :
                    <input
                        type={"text"}
                        className={"userDetails-input"}
                        disabled={!onChange}
                        value={value}
                        onChange={onChange}
                    />}

            </div>
        );
    }

    renderSaveButton() {
        const onSave = this.save.bind(this);
        return (
            <div className="userDetails-button" onClick={onSave}>
                <span className="userDetails-button-label">{this.t(TranslationKeys.General_SaveChanges)}</span>
            </div>
        );
    }

    save() {
        updateUser(this.state.userDetails, this.props.accountId).then(() => {
            const messageKey = FlashMessageActions.success(this.t(TranslationKeys.User_UpdateSuccess));
            setTimeout(() => FlashMessageActions.dismissMessage(messageKey), 3000);
        }).catch(() => {
            const messageKey = FlashMessageActions.error(this.t(TranslationKeys.User_UpdateError));
            setTimeout(() => FlashMessageActions.dismissMessage(messageKey), 3000);
        });
    }
}

export default withTranslation()(UserDetailsSettings);
