import * as React from "react";
import Button from "../../elements/button";
import IconAt from "../../elements/icons/At";
import InputWithIcon from "../../elements/input/InputWithIcon";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import { withTheme } from "@material-ui/core/styles";
import { withTranslation } from "@binders/client/lib/react/i18n";
import "./requestResetPasswordForm.styl";

export interface IRequestResetPasswordFormProps {
    theme?: {palette};
    onRequestReset: (email: string) => Promise<void>;
}

export interface IRequestResetPasswordFormState {
    email: string;
    errorString?: string;
    feedbackHtml?: string;
    isWorking: boolean;
}

class RequestResetPasswordForm extends React.Component<IRequestResetPasswordFormProps, IRequestResetPasswordFormState> {
    private t;

    constructor(props) {
        super(props);
        this.t = props.t;
        this.onClickReset = this.onClickReset.bind(this);
        this.onChangeEmail = this.onChangeEmail.bind(this);
        this.state = {
            email: "",
            errorString: "",
            feedbackHtml: "",
            isWorking: false,
        };
    }

    public render() {
        const { theme } = this.props;
        const { email, errorString, feedbackHtml, isWorking } = this.state;
        return (
            <div className="editForm">
                <div className="editForm-info">
                    <div className="editForm-info-title">{this.t(TranslationKeys.User_ResetPasswordFormTitle)}</div>
                    <div className="editForm-info-description">{this.t(TranslationKeys.User_EnterYourEmail)}</div>
                </div>
                <div className="editForm-content" style={{borderColor: theme.palette.primary }}>
                    <div>
                        <div className="editForm-input">
                            <InputWithIcon
                                type="text"
                                name="email"
                                icon={<IconAt />}
                                placeholder={this.t(TranslationKeys.User_YourEmail)}
                                value={email}
                                onChange={this.onChangeEmail}
                                className="editForm-input-field"
                                onEnterKey={this.onClickReset}
                            />
                        </div>
                        <div className="editForm-validation">
                            {
                                errorString ?
                                    (
                                        <span className="editForm-validation-errors-item">{errorString}</span>
                                    ) :
                                    null
                            }
                        </div>
                        <div className="editForm-feedback">
                            {
                                feedbackHtml ?
                                    (
                                        <span className="editForm-feedback-item">
                                            {feedbackHtml.split("\n").map((h, idx) => <><span key={idx}>{h}</span><br /></>)}
                                        </span>
                                    ) :
                                    null
                            }
                        </div>
                    </div>
                    <div className="editForm-confirm">
                        <Button onClick={this.onClickReset} text={this.t(TranslationKeys.General_Reset)} inactiveWithLoader={isWorking} />
                    </div>
                </div>
            </div>
        );
    }

    private async onClickReset() {
        const errorString = this.validateEmail();
        this.setState({
            errorString,
            feedbackHtml: "",
        });
        if (errorString) {
            return;
        }
        try {
            this.setState({
                isWorking: true,
            });
            await this.props.onRequestReset(this.state.email);
            this.setState({
                email: "",
                feedbackHtml: this.t(TranslationKeys.User_InvitationSentFeedback),
                isWorking: false,
            });
        } catch (error) {
            // User does not exist
            if (error.statusCode === 404) {
                this.setState({
                    errorString: this.t(TranslationKeys.User_NotExistError),
                    isWorking: false,
                });
            } else {
                this.setState({
                    errorString: this.t(TranslationKeys.Exception_SomethingWrong),
                    isWorking: false,
                });
                // eslint-disable-next-line no-console
                console.error(error);
            }
        }


    }

    private onChangeEmail(email) {
        this.setState({
            email,
        });
    }

    private validateEmail(): string {
        if (this.state.email.length === 0) {
            return this.t(TranslationKeys.User_EmailEmptyError);
        }
        return "";
    }
}

export default (withTheme(withTranslation()(RequestResetPasswordForm)));
