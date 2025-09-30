import * as React from "react";
import * as ReactDOM from "react-dom";
import { doResetPassword, resendReset } from "./users/resetPassword";
import { FlashMessageActions } from "@binders/client/lib/react/flashmessages/actions";
import FlashMessages from "@binders/client/lib/react/flashmessages/component";
import InfoSite from "@binders/ui-kit/lib/compounds/infoSite"
import InvitationForm from "@binders/ui-kit/lib/compounds/invitationForm"
import ThemeProvider from "@binders/ui-kit/lib/theme";
import { validatePasswordInput } from "@binders/client/lib/clients/validation";

import "./styles/resetPassword.styl";
import "./styles/global.styl";
import "@binders/client/assets/flashmessages.styl";

function sendResetPasswordLink(login, domain) {
    return () => resendReset(login, domain)
        .then(() => {
            const key = FlashMessageActions.info("Password reset sent");
            setTimeout(() => FlashMessageActions.dismissMessage(key), 4000);
        })
        .catch(error => {
            FlashMessageActions.error("Something went wrong while reseting your password.");
            // eslint-disable-next-line
            console.error(error);
        });
}

function prepareDataForInvalidTokenComponent(isConsumed, login, domain) {
    if (isConsumed) {
        return {
            onButtonClick: () => window.location = "/reset-password",
            buttonText: "Reset your password",
            info: "This link can be used only once.",
        };
    }
    return {
        onButtonClick: sendResetPasswordLink(login, domain),
        buttonText: "Send reset link again",
        info: "Reset link has expired.",
        feedbackHtml: "If your email address exists in our database,\nwe will send you a password reset link.\nCheck your mailbox!",
    }
}


let userEdit = null;
if (window.userData) {
    const { userId, login, displayName, token, isConsumed, isExpired, interfaceLang } = window.userData;
    userEdit = (
        <ThemeProvider>
            <div className="reset-password-box-wrapper">
                {isConsumed || isExpired ?
                    <InfoSite {...prepareDataForInvalidTokenComponent(isConsumed, login, window.domain)} /> :
                    <InvitationForm
                        isDisplayNameEditable={false}
                        userId={userId}
                        login={login}
                        displayName={displayName}
                        token={token}
                        language={interfaceLang}
                        onConfirmChanges={doResetPassword}
                        validatePasswordInput={validatePasswordInput}
                    />
                }
            </div>
        </ThemeProvider>
    );
}

ReactDOM.render(
    <div>
        <FlashMessages />
        {userEdit}
    </div>,
    document.getElementById("resetPassword-main")
);
