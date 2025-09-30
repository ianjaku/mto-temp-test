import { FlashMessageActions } from "@binders/client/lib/react/flashmessages/actions";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { doPost } from "../shared/helper";
import { getQueryStringVariable } from "@binders/client/lib/util/uri";
import i18n from "@binders/client/lib/react/i18n";

export const doResetPassword = async (displayName, newPassword, token) => {
    const domainFromQuery = getQueryStringVariable("domain");
    const url = `/reset/${token}${domainFromQuery ? `?domain=${domainFromQuery}` : ""}`;
    const body = {
        displayName,
        newPassword
    };
    const result = await doPost(url, body);
    if (result.status === 200) {
        window.location = "/";
    } else {
        // eslint-disable-next-line
        console.error(result);
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
            FlashMessageActions.error(i18n.t(TK.General_SomethingWentWrong));
        }
    });
}