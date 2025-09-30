import * as React from "react";
import * as ReactDOM from "react-dom";
import { acceptUserInvitation, inviteResend } from "./stores/actions/userinvite";
import { useEffect, useState } from "react";
import { APIGetAccountFeatures } from "./api/accountService";
import { FEATURE_INTERFACE_I18N } from "@binders/client/lib/clients/accountservice/v1/contract";
import { FlashMessageActions } from "@binders/client/lib/react/flashmessages/actions";
import FlashMessages from "@binders/client/lib/react/flashmessages/component";
import InfoSite from "@binders/ui-kit/lib/compounds/infoSite";
import InvitationForm from "@binders/ui-kit/lib/compounds/invitationForm"
import ThemeProvider from "@binders/ui-kit/lib/theme";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import i18next from "@binders/client/lib/react/i18n";
import { validatePasswordInput } from "@binders/client/lib/clients/validation";
import "./invite.styl";
import "@binders/client/assets/flashmessages.styl";

function sendInviteLink(login, domain, accountId) {
    return () => inviteResend(login, domain, accountId)
        .then(() => {
            const key = FlashMessageActions.info(i18next.t(TranslationKeys.User_InviteLinkSent));
            setTimeout(() => FlashMessageActions.dismissMessage(key), 4000);
        })
        .catch(error => {
            FlashMessageActions.error(i18next.t(TranslationKeys.User_InviteLinkError));
            // eslint-disable-next-line
            console.error(error);
        });
}

function prepareDataForInvalidTokenComponent(isConsumed, login, domain, accountId) {
    if (isConsumed) {
        return {
            onButtonClick: () => window.location = "/login",
            buttonText: i18next.t(TranslationKeys.User_Login),
            info: i18next.t(TranslationKeys.User_InviteLinkAlreadyUsedError),
            onSecondaryButtonClick: () => window.location = "/reset-password",
            secondaryButtonText: i18next.t(TranslationKeys.User_ResetPassword),
        };
    }
    return {
        onButtonClick: sendInviteLink(login, domain, accountId),
        buttonText: i18next.t(TranslationKeys.User_ResendInvitationLink),
        info: i18next.t(TranslationKeys.User_InvitationLinkExpired),
        feedbackHtml: i18next.t(TranslationKeys.User_InvitationSentFeedback),
    }
}

let UserEdit = null;
if (window.userData) {
    const { userId, login, firstName, lastName,
        token, isExpired, isConsumed, accountId, interfaceLang } = window.userData;

    UserEdit = () => {
        const [accountFeatures, setAccountFeatures] = useState();
        // eslint-disable-next-line
        useEffect(async () => {
            const features = await APIGetAccountFeatures(accountId);
            setAccountFeatures(features);
        }, []);
        return (
            <ThemeProvider accentColor={window.stylusOverrides && window.stylusOverrides.bgDark}>
                <div className="invite-form-wrapper">
                    {isConsumed || isExpired ?
                        <InfoSite {...prepareDataForInvalidTokenComponent(isConsumed, login, window.hostname, accountId)} /> :
                        <InvitationForm
                            isDisplayNameEditable={true}
                            userId={userId}
                            login={login}
                            displayName={""}
                            firstName={firstName}
                            lastName={lastName}
                            token={token}
                            language={interfaceLang}
                            onConfirmChanges={acceptUserInvitation}
                            validatePasswordInput={validatePasswordInput}
                            showInterfaceLanguageChoice={accountFeatures && accountFeatures.includes(FEATURE_INTERFACE_I18N)}
                        />}
                </div>
            </ThemeProvider>
        )
    };
}

ReactDOM.render(
    <div>
        <FlashMessages />
        <UserEdit />
    </div>,
    document.getElementById("invite-main")
);
