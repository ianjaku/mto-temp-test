import * as React from "react";
import { FlashMessages } from "../logging/FlashMessages";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { UserImportResult } from "@binders/client/lib/clients/userservice/v1/contract";
import { sendInvitationMails } from "../users/actions";
import { useTranslation } from "@binders/client/lib/react/i18n";

const { useCallback, useState } = React;

export type UseSendInvitationMailsProps = {
    account: { id: string };
    domains: string[];
}

export type UseSendInvitationMails = {
    isSendingInvitationMails: boolean;
    sendInvitationMails: (payload: UserImportResult[]) => Promise<void>;
}

export function useSendInvitationMails({ account, domains }: UseSendInvitationMailsProps): UseSendInvitationMails {
    const [isSendingInvitationMails, setIsSendingInvitationMails] = useState(false);
    const { t } = useTranslation();

    const sendInvitationMailsCallback = useCallback(async function(payload: UserImportResult[]) {
        const domain = (domains || []).length > 0 && domains[0];
        setIsSendingInvitationMails(true);
        const importedUsersLogins = payload.filter(r => r.invitationLink).map(r => r.user.login);
        try {
            const importResults = await sendInvitationMails(importedUsersLogins, account.id, domain);
            setIsSendingInvitationMails(false);
            const importedUsersLoginsCount = importedUsersLogins.length;
            const actualSent = importResults.filter(res => !(res.exception)).length;
            if (actualSent === 0) {
                FlashMessages.error(t(TK.User_CantSendInvitationMails));
                return;
            }
            if (actualSent === importedUsersLoginsCount) {
                FlashMessages.success(t(TK.User_InvitationMailsSent));
                return;
            }
            FlashMessages.info(t(TK.User_InvitationMailsPartiallySent, { actualSent, importedUsersLoginsCount }));
        } catch (error) {
            setIsSendingInvitationMails(false);
            FlashMessages.error(t(TK.User_CantSendInvitationMails));
        }
    }, [account, domains, setIsSendingInvitationMails, t]);

    return {
        isSendingInvitationMails,
        sendInvitationMails: sendInvitationMailsCallback,
    }
}

