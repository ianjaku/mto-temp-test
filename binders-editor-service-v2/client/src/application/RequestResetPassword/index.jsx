import * as React from "react";
import { APISendMePasswordResetLink } from "../../users/api";
import RequestResetPasswordForm from "@binders/ui-kit/lib/compounds/requestResetPasswordForm";
import ThemeProvider from "@binders/ui-kit/lib/theme";

import "./requestResetPassword.styl";

class RequestResetPassword extends React.Component {

    async onRequestReset(email) {
        await APISendMePasswordResetLink(email, window.location.hostname.replace(".editor", ""));
    }

    render() {
        return (
            <ThemeProvider>
                <div className="reset-password-box-wrapper">
                    <RequestResetPasswordForm onRequestReset={this.onRequestReset} />
                </div>
            </ThemeProvider>
        );
    }
}

export default RequestResetPassword;
