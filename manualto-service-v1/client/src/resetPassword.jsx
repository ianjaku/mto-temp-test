import * as React from "react";
import * as ReactDOM from "react-dom";
import { acceptUserInvitation, resendReset } from "./stores/actions/userinvite";
import { FlashMessageActions } from "@binders/client/lib/react/flashmessages/actions";
import FlashMessages from "@binders/client/lib/react/flashmessages/component";
import InfoSite from "@binders/ui-kit/lib/compounds/infoSite";
import InvitationForm from "@binders/ui-kit/lib/compounds/invitationForm"
import ThemeProvider from "@binders/ui-kit/lib/theme";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import i18next from "@binders/client/lib/react/i18n";
import { validatePasswordInput } from "@binders/client/lib/clients/validation";
import "./resetPassword.styl";
import "@binders/client/assets/flashmessages.styl";

function sendResetPasswordLink(login, domain) {
    return () => resendReset(login, domain)
        .then(() => {
            const key = FlashMessageActions.info(i18next.t(TranslationKeys.User_PasswordResetSent));
            setTimeout(() => FlashMessageActions.dismissMessage(key), 4000);
        })
        .catch(error => {
            FlashMessageActions.error(i18next.t(TranslationKeys.User_ErrorWhenResetting));
            // eslint-disable-next-line
            console.error(error);
        });
}

function prepareDataForInvalidTokenComponent(isConsumed, login, domain) {
    if (isConsumed) {
        return {
            onButtonClick: () => window.location = "/reset-password",
            buttonText: i18next.t(TranslationKeys.User_ResetPassword),
            info: i18next.t(TranslationKeys.User_InviteLinkAlreadyUsedError),
        };
    }
    return {
        onButtonClick: sendResetPasswordLink(login, domain),
        buttonText: i18next.t(TranslationKeys.User_ResendResetLink),
        info: i18next.t(TranslationKeys.User_ResetLinkExpired),
        feedbackHtml: i18next.t(TranslationKeys.User_InvitationSentFeedback),

    }
}

let userEdit = null;
if (window.userData) {
    const { userId, login, displayName, token, isExpired, isConsumed, interfaceLang } = window.userData;

    userEdit = (
        <ThemeProvider accentColor={window.stylusOverrides && window.stylusOverrides.bgDark}>
            <div className="invite-form-wrapper">
                {isConsumed || isExpired ?
                    <InfoSite {...prepareDataForInvalidTokenComponent(isConsumed, login, window.hostname)} /> :
                    <InvitationForm
                        isDisplayNameEditable={false}
                        userId={userId}
                        login={login}
                        displayName={displayName}
                        token={token}
                        language={interfaceLang}
                        onConfirmChanges={acceptUserInvitation}
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
