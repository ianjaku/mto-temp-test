import * as React from "react";
import { TFunction, withTranslation } from "@binders/client/lib/react/i18n";
import LoginBox from "@binders/ui-kit/lib/compounds/loginbox";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import ThemeProvider from "@binders/ui-kit/lib/theme";
import { getQueryStringVariable } from "@binders/client/lib/util/uri";
import { isProduction } from "@binders/client/lib/util/environment";
import { pick } from "ramda";
import { translateUiErrorCode } from "@binders/client/lib/errors";
import "./login.styl";


interface LoginProps {
    t: TFunction;
}

interface LoginState {
    errors: string[];
}

class Login extends React.Component<LoginProps, LoginState> {

    constructor(props: LoginProps) {
        super(props);
        this.state = {
            errors: [],
        };
    }

    componentDidMount() {
        const errors = this.extractWindowErrors();
        const searchParamsErrorMessage = this.extractSearchParamsErrorMessage();
        if (searchParamsErrorMessage) {
            if (errors.length === 0) {
                errors.push(searchParamsErrorMessage);
            } else {
                // We don't expect more than one error (except for the same in different language
                // when the account interface is not in English), but just in case, we're logging it
                // eslint-disable-next-line no-console
                console.error(searchParamsErrorMessage);
            }
        }
        if (errors.length > 0) {
            this.setState({errors})
        }
    }

    extractWindowErrors(): string[] {
        const errors = (window as { errors?: string[] | unknown }).errors;
        if (!errors) {
            return [];
        }
        return Array.isArray(errors) ? errors.slice(0, 1) : [errors.toString()];
    }

    extractSearchParamsErrorMessage(): string | undefined {
        const currentUrl = new URL(window.location.href);
        const reason = currentUrl.searchParams.get("reason");
        return reason && translateUiErrorCode(this.props.t, reason);
    }

    navigateToResetPassword() {
        const resetPath = "/reset-password";
        const domain = getQueryStringVariable("domain");
        const suffix = (isProduction() || !domain) ?
            "" :
            `?domain=${domain}`;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).location = `${resetPath}${suffix}`;
    }

    render() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ssoConfig = pick(["showSAMLConnectButton", "ssoButtonText", "ssoProvider"], (window as any));
        return (
            <ThemeProvider>
                <div className="login-box-wrapper">
                    <LoginBox
                        submitUrl="/login"
                        errors={this.state.errors}
                        ssoConfig={ssoConfig}
                    >
                        <label
                            className="login-box-forgot-password"
                            onClick={this.navigateToResetPassword}
                        >
                            {this.props.t(TK.Login_ForgotPassword)}
                        </label>
                    </LoginBox>
                </div>
            </ThemeProvider>
        );
    }
}

export default withTranslation()(Login);
