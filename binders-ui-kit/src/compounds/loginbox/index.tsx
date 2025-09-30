import * as React from "react";
import {
    SSOProvider,
    resolveSSOProviderName
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { TFunction, withTranslation } from "@binders/client/lib/react/i18n";
import Button from "../../elements/button";
import IE11WarningBanner from "../banners/ie11warning";
import IconAccount from "../../elements/icons/Account";
import IconPassword from "../../elements/icons/Password";
import InputWithIcon from "../../elements/input/InputWithIcon";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import cx from "classnames";
import "./loginbox.styl";

export interface ILoginBoxProps {
    t: TFunction,
    submitUrl: string;
    errors?: string[];
    ssoConfig: {
        showSAMLConnectButton?: boolean;
        ssoButtonText?: string;
        ssoProvider?: SSOProvider;
    }
}

export interface ILoginBoxState {
    username: string;
    password: string;
    submitted: boolean;
}

const getQueryDomain = () => {
    const params = (new URL(document.location.href)).searchParams;
    const queryDomain = params.get("domain");
    if (queryDomain) {
        return `?domain=${queryDomain}`;
    }
    return "";
};

class LoginBox extends React.Component<ILoginBoxProps, ILoginBoxState> {
    private form: HTMLFormElement;
    private readonly t: TFunction;

    constructor(props: ILoginBoxProps) {
        super(props);
        this.t = props.t.bind(this);
        this.onChangeUsername = this.onChangeUsername.bind(this);
        this.onChangePassword = this.onChangePassword.bind(this);
        this.referenceForm = this.referenceForm.bind(this);
        this.submit = this.submit.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
        this.state = {
            password: "",
            submitted: false,
            username: "",
        };
    }

    public render() {
        const { errors, children } = this.props;
        const { submitted, username, password } = this.state;
        const renderErrorMessage = (e) => <label key={e}>{e}</label>;
        const containsErrors = errors && errors.length > 0;
        const errorsDiv = containsErrors ? <div className="login-box-errors">{errors.map(renderErrorMessage)}</div> : undefined;
        return (
            <form action={this.props.submitUrl} method="post" ref={this.referenceForm}>
                <div className={cx("login-box", { "login-box--containserrors": containsErrors })}>
                    <label className="login-box-header">manual.to</label>
                    {errorsDiv}
                    <InputWithIcon
                        type="text"
                        name="username"
                        icon={<IconAccount />}
                        placeholder={this.t(TranslationKeys.General_EmailAddress)}
                        value={username}
                        onChange={this.onChangeUsername}
                        onKeyUp={this.onKeyUp}
                        disabled={submitted}
                        autoFocus={true}
                    />
                    <InputWithIcon
                        type="password"
                        name="password"
                        icon={<IconPassword />}
                        placeholder={this.t(TranslationKeys.User_Password)}
                        value={password}
                        onChange={this.onChangePassword}
                        onKeyUp={this.onKeyUp}
                        disabled={submitted}
                    />
                    <Button text={this.t(TranslationKeys.User_LogIn)} onClick={this.submit} isEnabled={!submitted} CTA={true} />
                    {this.renderSSOOptions()}
                    {children}
                </div>
                <div className="ribbons">
                    <IE11WarningBanner />
                </div>
            </form>
        );
    }

    private renderSSOOptions() {
        const { showSAMLConnectButton, ssoButtonText, ssoProvider } = this.props.ssoConfig;
        if (!showSAMLConnectButton) {
            return null;
        }
        const queryDomain = getQueryDomain();
        const providerLogo = ssoProvider === SSOProvider.OKTA ? "/assets/okta-logo.svg" : "/assets/entra-logo.svg";
        const buttonText = ssoButtonText ?
            ssoButtonText :
            this.t(TranslationKeys.Login_WithProvider, { providerName: resolveSSOProviderName(ssoProvider) });
        return (
            <>
                <div className="login-box-separator">
                    <span>{this.t(TranslationKeys.General_Or).toUpperCase()}</span>
                </div>
                <div className="login-box-sso">
                    <div className="identity-provider">
                        <a href={`/sso/saml/request${queryDomain}`}>
                            <img className="identity-provider-logo" src={providerLogo} alt="sso-provider-logo" />
                            <span>{buttonText}</span>
                        </a>
                    </div>
                </div>
            </>
        );
    }

    private referenceForm(form) {
        this.form = form;
    }

    private submit() {
        this.setState({
            submitted: true,
        });
        this.form.submit();
    }

    private onChangeUsername(username: string) {
        this.setState({
            username,
        });
    }

    private onChangePassword(password: string) {
        this.setState({
            password,
        });
    }

    private onKeyUp(e) {
        if (e.key === "Enter" && this.state.username && this.state.password) {
            this.submit();
        }
    }
}

export default withTranslation()(LoginBox);
