import {
    Button,
    Para,
    brandingColorStyle,
    p,
    style
} from "@binders/binders-service-common/lib/mail/txtHtmlKit";
import {
    TransactionalMailMarkup,
    buildTransactionalMailMarkup,
} from "@binders/binders-service-common/lib/mail/markup";
import { ReaderBranding } from "@binders/client/lib/clients/routingservice/v1/contract";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import i18next from "@binders/client/lib/i18n";

export function buildInvitationMailMarkup(
    accountName: string,
    domain: string,
    acceptInvitationLink: string,
    readerBranding?: ReaderBranding,
    lng?: string,
): TransactionalMailMarkup {
    return buildTransactionalMailMarkup(
        domain,
        [
            Para([
                { content: i18next.t(TK.User_InvitationMailBody1Html, { accountName, lng }) },
                { content: domain, ...style("bold") },
                { content: ` ${i18next.t(TK.User_InvitationMailBody2Html, { lng })}` },
            ], style("center", "marginMedium2Top", "marginLargeRight", "marginLargeBottom", "marginLargeLeft")),
            p([
                Button({
                    text: i18next.t(TK.User_InvitationMailAcceptCaption, { lng }),
                    href: acceptInvitationLink
                }, brandingColorStyle(readerBranding)),
            ], style("center", "marginLargeBottom")),
            Para([
                { content: i18next.t(TK.User_TransactionalMail_WhatIsManualTo, { accountName, lng }), ...style("grayPrint", "fontSmall") },
            ], style("center")),
        ],
        readerBranding,
        {
            salutation: i18next.t(TK.General_Welcome, { lng }),
        }
    );
}

export function buildLoginChangeMarkup(
    salutation: string,
    login: string,
    oldLogin: string,
    domain: string,
    readerBranding?: ReaderBranding,
    lng?: string,
): TransactionalMailMarkup {
    return buildTransactionalMailMarkup(
        domain,
        [
            Para([
                { content: i18next.t(TK.User_LoginChangedMailBody1, { login, oldLogin, lng }) },
            ], style("center", "marginMedium2Top", "marginLargeRight", "marginLargeBottom", "marginLargeLeft")),
            Para([
                { content: i18next.t(TK.User_LoginChangedMailBody2, { lng }) },
            ], style("center", "marginMediumTop", "marginLargeBottom")),
        ],
        readerBranding,
        {
            salutation,
            includeSignature: true,
        }
    )
}

export function buildLoginRemovedMarkup(
    salutation: string,
    oldLogin: string,
    readerBranding: ReaderBranding,
    domain: string,
    lng?: string
): TransactionalMailMarkup {
    return buildTransactionalMailMarkup(
        domain,
        [
            Para([
                { content: i18next.t(TK.User_LoginRemovedMailBody1, { oldLogin, lng }) },
            ], style("center", "marginMedium2Top", "marginLargeRight", "marginLargeBottom", "marginLargeLeft")),
            Para([
                { content: i18next.t(TK.User_LoginRemovedMailBody2, { lng }) },
            ], style("center", "marginMediumTop", "marginLargeBottom")),
        ],
        readerBranding,
        {
            salutation,
            includeSignature: true
        }
    )
}

export function buildResetPasswordMarkup(
    salutation: string,
    resetPasswordLink: string,
    domain: string,
    readerBranding?: ReaderBranding,
    lng?: string,
): TransactionalMailMarkup {
    return buildTransactionalMailMarkup(
        domain,
        [
            Para([
                { content: i18next.t(TK.User_ResetPasswordMailBody1, { lng }) },
                { content: i18next.t(TK.User_ResetPasswordMailBody3, { lng }) },
            ], style("center", "marginMedium2Top", "marginLargeRight", "marginLargeBottom", "marginLargeLeft")),
            p([
                Button({
                    text: i18next.t(TK.User_ResetPasswordCta, { lng }),
                    href: resetPasswordLink
                }, brandingColorStyle(readerBranding)),
            ], style("center", "marginLargeBottom")),
        ],
        readerBranding,
        {
            salutation,
            includeSignature: true,
        }
    )
}