import * as React from "react";
import * as validator from "validator";
import { FlashMessageActions } from "@binders/client/lib/react/flashmessages/actions";
import FlashMessages from "@binders/client/lib/react/flashmessages/component";
import { Input } from "../views/components/input";
import Loading from "../views/components/loader";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import autobind from "class-autobind";
import { getQueryStringVariable } from "@binders/client/lib/util/uri";
import { isProduction } from "@binders/client/lib/util/environment";
import { sendMePasswordResetLink } from "../api/userservice";
import { withTranslation } from "@binders/client/lib/react/i18n";
import "./reset-password.styl";


class ResetPassword extends React.Component {
    constructor(props) {
        super(props);
        autobind(this);
        this.t = props.t;
        this.state = {
            email: "",
            isSending: false,
            isSent: false
        };
    }

    saveInput(value) {
        this.setState({ email: value });
    }

    sendResetPasswordLinkTo() {
        if (!validator.isEmail(this.state.email)) {
            const messageKey = FlashMessageActions.error(this.t(TranslationKeys.User_InvalidEmail, {email: this.state.email}));
            setTimeout(() => FlashMessageActions.dismissMessage(messageKey), 3000);
            return;
        }
        const domain = isProduction() ?
            window.location.hostname :
            getQueryStringVariable("domain") || window.location.hostname;
        this.setState({ isSending: true });
        return sendMePasswordResetLink(this.state.email, domain)
            .then( () => {
                const key = FlashMessageActions.info(this.t(TranslationKeys.User_PasswordResetSent));
                setTimeout(() => FlashMessageActions.dismissMessage(key), 4000);
                this.setState({ isSending: false, isSent: true });
            })
            .catch(error => {
                //User does not exist
                if (error.statusCode === 404) {
                    this.setState({ isSent: true, isSending: false });
                } else {
                    FlashMessageActions.error(this.t(TranslationKeys.User_ErrorWhenResetting));
                    // eslint-disable-next-line
                    console.error(error);
                }
            });
    }

    render() {
        if (this.state.isSending) {
            return <Loading text={this.t(TranslationKeys.User_SendingResetLink)} />;
        }
        if (this.state.isSent && !this.state.isSending) {
            return (
                <div className="resetPassword">
                    <div className="resetPassword-form">
                        <div className="resetPassword-success">
                            {this.t(TranslationKeys.User_ResetPasswordFeedback)}
                        </div>
                    </div>
                </div>
            );
        }
        return (
            <div>
                <FlashMessages />
                <div className="resetPassword">
                    <div className="resetPassword-form">
                        <div className="resetPassword-form-title">{this.t(TranslationKeys.User_ResetPasswordFormTitle)}</div>
                        <div className="resetPassword-form-inputWrapper">
                            {" "}
                            <Input
                                className="resetPassword-form-input"
                                placeholder={this.t(TranslationKeys.User_EmailInputPlaceholder)}
                                onChange={this.saveInput}
                                onEnterKey={this.sendResetPasswordLinkTo}
                                value={this.state.email}
                            />
                        </div>
                        <div className="resetPassword-form-button" onClick={this.sendResetPasswordLinkTo}>
                            {this.t(TranslationKeys.General_Send)}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

export default withTranslation()(ResetPassword);
