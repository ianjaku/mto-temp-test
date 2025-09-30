import { MailgunMailer } from "@binders/binders-service-common/lib/mail/mailgun";
import { TK } from "@binders/client/lib/react/i18n/translations";
import { TransactionalMailMarkup } from "@binders/binders-service-common/lib/mail/markup";
import i18next from "@binders/client/lib/i18n";
import { stripHTML } from "@binders/client/lib/util/html";

const DIGEST_SENDER = "Manual.to <feedback-digest@mail.manual.to>";

export async function sendMail(
    mailer: MailgunMailer,
    mailMarkup: TransactionalMailMarkup,
    to: string,
): Promise<void> {
    const mailMessage = {
        to,
        from: DIGEST_SENDER,
        subject: i18next.t(TK.Feedback_DigestMail_Subject),
        text: stripHTML(mailMarkup.html),
        html: mailMarkup.html,
        inlineAttachments: mailMarkup.inlineAttachments,
    };

    await mailer.sendMessage(mailMessage);
}