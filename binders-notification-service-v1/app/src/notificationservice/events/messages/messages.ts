import { Para, Table, style, td, tr } from "@binders/binders-service-common/lib/mail/txtHtmlKit";
import {
    TransactionalMailMarkup,
    buildTransactionalMailMarkup
} from "@binders/binders-service-common/lib/mail/markup";
import { ReaderBranding } from "@binders/client/lib/clients/routingservice/v1/contract";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import i18next from "@binders/client/lib/i18n";

export function buildPublishNotificationMarkup(
    domain: string,
    readerBranding?: ReaderBranding,
): TransactionalMailMarkup {
    return buildTransactionalMailMarkup(
        domain,
        [
            Para([
                { content: i18next.t(TK.Notifications_Publish_Body) },
            ], style("center", "marginLargeTop", "marginLargeBottom")),
            Table([
                tr([
                    td([
                        Para([
                            { content: `${i18next.t(TK.General_LinkReader).replace(/ /g, "&nbsp;")}:` },
                        ], style("bold")),
                    ], style("paddingMediumRight", "paddingMediumBottom")),
                    td([
                        Para([
                            { content: "[[reader_link]]" },
                        ])
                    ], style("paddingMediumBottom"))
                ])
            ], style("grayFrame", "paddingMedium2", "fontSmall", "fullWidth")),
        ],
        readerBranding,
        {
            salutation: `${i18next.t(TK.General_Dear)} [[name]],`,
            includeSignature: true,
        }
    )
}

export function buildReviewRequestNotificationMarkup(
    domain: string,
    readerBranding?: ReaderBranding,
): TransactionalMailMarkup {
    return buildTransactionalMailMarkup(
        domain,
        [
            Para([
                { content: i18next.t(TK.Notifications_Review_Request_Body) },
            ], style("center", "marginLargeTop", "marginLargeBottom")),

            Table([
                tr([
                    td([
                        Para([
                            { content: `${i18next.t(TK.DocManagement_DocumentTitle).replace(/ /g, "&nbsp;")}:` },
                        ], style("bold")),
                    ], style("paddingMediumRight", "paddingMediumBottom")),
                    td([
                        Para([
                            { content: "[[title]]" },
                        ])
                    ], style("paddingMediumBottom"))
                ]),
                tr([
                    td([
                        Para([
                            { content: `${i18next.t(TK.General_LinkEditor).replace(/ /g, "&nbsp;")}:` },
                        ], style("bold")),
                    ], style("paddingMediumRight", "paddingMediumBottom")),
                    td([
                        Para([
                            { content: "[[editor_link]]" },
                        ])
                    ], style("paddingMediumBottom"))
                ])
            ], style("grayFrame", "paddingMedium2", "fontSmall", "fullWidth")),
        ],
        readerBranding,
        {
            salutation: `${i18next.t(TK.General_Dear)} [[name]],`,
            includeSignature: true,
        }
    )
}

export function buildPublishRequestNotificationMarkup(
    domain: string,
    readerBranding?: ReaderBranding,
): TransactionalMailMarkup {
    return buildTransactionalMailMarkup(
        domain,
        [
            Para([
                { content: i18next.t(TK.Notifications_Publish_Request_Body) },
            ], style("center", "marginLargeTop", "marginLargeBottom")),

            Table([
                tr([
                    td([
                        Para([
                            { content: `${i18next.t(TK.DocManagement_DocumentTitle).replace(/ /g, "&nbsp;")}:` },
                        ], style("bold")),
                    ], style("paddingMediumRight", "paddingMediumBottom")),
                    td([
                        Para([
                            { content: "[[title]]" },
                        ])
                    ], style("paddingMediumBottom"))
                ]),
                tr([
                    td([
                        Para([
                            { content: `${i18next.t(TK.General_LinkEditor).replace(/ /g, "&nbsp;")}:` },
                        ], style("bold")),
                    ], style("paddingMediumRight", "paddingMediumBottom")),
                    td([
                        Para([
                            { content: "[[editor_link]]" },
                        ])
                    ], style("paddingMediumBottom"))
                ])
            ], style("grayFrame", "paddingMedium2", "fontSmall", "fullWidth")),
        ],
        readerBranding,
        {
            salutation: `${i18next.t(TK.General_Dear)} [[name]],`,
            includeSignature: true,
        }
    )
}

export function buildCustomNotificationMarkup(
    text: string,
    domain: string,
    readerBranding?: ReaderBranding,
): TransactionalMailMarkup {
    return buildTransactionalMailMarkup(
        domain,
        [
            Para([
                { content: text.replace(/\n/g, "<br />") },
            ], style("center")),
        ],
        readerBranding,
    )
}

export const PUBLISH_NOTIFICATION_MESSAGE = `Dear [[name]],

The document with title "[[title]]" has been published by [[actor]].

Reader link: [[reader_link]]

Regards,
Manual.to
`;

export const REVIEW_REQUEST_NOTIFICATION_MESSAGE = `Dear [[name]],

[[actor]] requested you to review a document.

Document title: [[title]]
Editor link: [[editor_link]]

Regards,
Manual.to
`;

export const PUBLISH_REQUEST_NOTIFICATION_MESSAGE = `Dear [[name]],

[[actor]] requested you to publish a document.

Document title: [[title]]
Editor link: [[editor_link]]

Regards,
Manual.to
`;