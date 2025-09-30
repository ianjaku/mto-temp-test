import { FlashMessageActions } from "@binders/client/lib/react/flashmessages/actions";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import { doPost } from "@binders/client/lib/clients/request";
import i18next from "@binders/client/lib/react/i18n";
import { isDev } from "@binders/client/lib/util/environment";

export async function acceptUserInvitation(displayName, newPassword, token, domain, interfaceLanguage) {
    // TODO: MT-4121
    const isStaging = window.location.hostname.endsWith("staging.binders.media");
    const params = isDev() || isStaging ? `?domain=${domain}` : "";
    const url = `/invite/${token}${params}`;
    const body = {
        displayName,
        newPassword,
        interfaceLanguage,
    };
    try {
        const result = await doPost(url, body);
        if (result.status === 200) {
            window.location = `/?domain=${domain}`;
        } else {
            throw result;
        }
    } catch (e) {
        // eslint-disable-next-line
        console.error(e);
        FlashMessageActions.error(i18next.t(TranslationKeys.General_SomethingWentWrong));
    }
}

export function resendReset(login, domain) {
    const url = "/reset-resend";
    const body = {
        login,
        domain,
    };
    return doPost(url, body).then(result => {
        if (result.status !== 200) {
            // eslint-disable-next-line
            console.error(result);
            FlashMessageActions.error(i18next.t(TranslationKeys.General_SomethingWentWrong));
        }
    });
}

export function inviteResend(login, domain, accountId) {
    const url = "/invite-resend";
    const body = {
        login,
        accountId,
        domain,
    };
    return doPost(url, body).then(result => {
        if (result.status !== 200) {
            // eslint-disable-next-line
            console.error(result);
            FlashMessageActions.error(i18next.t(TranslationKeys.General_SomethingWentWrong));
        }
    });
}
