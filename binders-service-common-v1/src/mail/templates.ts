import { Para, style } from "./txtHtmlKit";
import { MailMessage } from "./mailgun";
import { ReaderBranding } from "@binders/client/lib/clients/routingservice/v1/contract";
import { TK } from "@binders/client/lib/react/i18n/translations";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import { buildTransactionalMailMarkup } from "./markup";
import i18next from "@binders/client/lib/react/i18n";


export const buildGenericMailMessage = (
    targetUser: User,
    subject: string,
    paragraphs: string[],
    domain?: string,
    readerBranding?: ReaderBranding,
): MailMessage => {
    const firstName = targetUser.firstName;
    const salutation = firstName ? `${i18next.t(TK.General_Dear)} ${firstName},` : i18next.t(TK.General_UnaddressedEmailSalutation);

    return {
        from: "Manual.to <info@mail.manual.to>",
        to: targetUser.login,
        subject,
        text: `${salutation},
${paragraphs.join("\n\n")}
`,
        ...buildTransactionalMailMarkup(
            domain,
            [
                ...paragraphs.map((p, index) => {
                    return Para(
                        [
                            { content: p },
                        ],
                        style(
                            "center",
                            "marginLargebottom",
                            index === 0 ? "marginMedium2Top" : "marginMediumTop"
                        )
                    );
                })
            ],
            readerBranding,
            {
                includeSignature: true,
                salutation
            }
        )
    };
}
