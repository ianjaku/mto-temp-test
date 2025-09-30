import * as React from "react";
import LoginBox from "@binders/ui-kit/lib/compounds/loginbox";
import { TFunction } from "@binders/client/lib/i18n";
import { translateUiErrorCode } from "@binders/client/lib/errors";
import { withTranslation } from "@binders/client/lib/react/i18n";
import "./login.styl";

export interface ILoginState {
    errors: string[];
}

// eslint-disable-next-line @typescript-eslint/ban-types
export type ILoginProps = {
    t: TFunction,
};

class Login extends React.Component<ILoginProps, ILoginState> {

    constructor(props: ILoginProps) {
        super(props);
        this.state = {
            errors: [],
        };
    }

    componentDidMount(): void {
        const { t } = this.props;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const errors = (window as any).errors || [];
        const query = new URL(window.location.href).searchParams;
        if (query.get("reason")) {
            errors.push(translateUiErrorCode(t, query.get("reason")));
        }
        if (errors.length > 0) {
            this.setState({ errors });
        }
    }

    render(): React.ReactNode {
        return (
            <div className="login-box-wrapper">
                <LoginBox
                    submitUrl="/login"
                    errors={this.state.errors}
                    ssoConfig={{ showSAMLConnectButton: false }}
                />
            </div>
        );
    }
}

export default withTranslation()(Login);
