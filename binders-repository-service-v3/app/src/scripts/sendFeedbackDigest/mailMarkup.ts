/* eslint-disable no-console */
import {
    ActionableComment,
    ActionableFeedback,
    DigestInfo,
    LookupData
} from "./sendFeedbackDigest";
import { Button, Para, Table, style, td, tr } from "@binders/binders-service-common/lib/mail/txtHtmlKit";
import {
    TransactionalMailMarkup,
    buildTransactionalMailMarkup
} from "@binders/binders-service-common/lib/mail/markup";
import { buildEditorItemUrl, getEditorLocation } from "@binders/client/lib/util/domains";
import { intersperse, uniq } from "ramda";
import HtmlSanitizer from "@binders/binders-service-common/lib/html/sanitizer";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import {
    NOTIFICATION_COUNTER_LABEL
} from "@binders/binders-service-common/lib/monitoring/prometheus/htmlSanitizing";
import { ReaderBranding } from "@binders/client/lib/clients/routingservice/v1/contract";
import { TK } from "@binders/client/lib/react/i18n/translations";
import { UserPreferences } from "@binders/client/lib/clients/userservice/v1/contract";
import { buildUserName } from "@binders/client/lib/clients/userservice/v1/helpers";
import { extractTitleAndLanguage } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import i18next from "@binders/client/lib/i18n";

const COMMENT_BODY_CUTOFF = 200;

const drawStars = (rating: number): string => {
    const fullStars = "★".repeat(Math.floor(rating));
    const emptyStars = "☆".repeat(5 - Math.ceil(rating));
    return `${fullStars}${emptyStars}`;
}

const makeExcerpt = (logger: Logger, text: string): string => {
    const excerpt = text.length > COMMENT_BODY_CUTOFF ?
        text.slice(0, COMMENT_BODY_CUTOFF) + "..." :
        text;
    return new HtmlSanitizer(logger, NOTIFICATION_COUNTER_LABEL).sanitizeHtml(excerpt);
}

export const buildMailMarkup = (
    digestInfo: DigestInfo,
    userName: string,
    lookupData: LookupData,
    ownerPreferences?: UserPreferences,
): TransactionalMailMarkup => {
    const {
        domainFilters,
        binders,
        publications,
        users,
    } = lookupData;

    let domain: string | undefined, readerBranding: ReaderBranding | undefined;

    const accountIds = uniq([
        ...digestInfo.comments.map(c => c.accountId),
        ...digestInfo.feedbacks.map(f => f.accountId),
    ]);
    if (accountIds.length === 1) {
        const domainFilter = domainFilters.find(a => a.accountId === accountIds[0]);
        domain = domainFilter?.domain;
        readerBranding = domainFilter?.branding;
    }

    const lng = (ownerPreferences?.readerLanguages && ownerPreferences.readerLanguages[0]) || "en";

    const commentsMap = digestInfo.comments.reduce((acc, comment) => {
        if (!acc[comment.binderId]) {
            acc[comment.binderId] = [];
        }
        acc[comment.binderId].push(comment);
        return acc;
    }, {} as Record<string, ActionableComment[]>);

    const feedbacksMap = digestInfo.feedbacks.reduce((acc, feedback) => {
        if (!acc[feedback.publicationId]) {
            acc[feedback.publicationId] = [];
        }
        acc[feedback.publicationId].push(feedback);
        return acc;
    }, {} as Record<string, ActionableFeedback[]>);

    const spacerMd = "<span style='line-height: 20px'>&nbsp;</span>";
    const spacerSm = "<span style='line-height: 10px'>&nbsp;</span>";
    const tableSpacerMd = tr([td([spacerMd])]);
    const tableSpacerSm = tr([td([spacerSm])]);

    const commentBoxes = Object.entries(commentsMap).flatMap(([binderId, comments]) => {
        const binder = binders.find(b => b.id === binderId);
        const { title } = extractTitleAndLanguage(binder);
        const link = buildEditorItemUrl(
            "binder",
            domain,
            binder.id,
            getEditorLocation(domain, lookupData.devEditorLocation),
        );
        return comments.map(comment => {
            const commenter = users.find(u => u.id === comment.userId);
            return Table([
                tr([
                    td([
                        Para([{
                            content: i18next.t(TK.Feedback_DigestMail_UserLeftComment, {
                                commenterName: buildUserName(commenter),
                                title,
                                lng,
                            })
                        }], style("center", "noMargin"))
                    ])
                ]),
                tableSpacerSm,
                tr([
                    td([
                        Table([
                            tableSpacerSm,
                            tr([
                                td([
                                    Para([{
                                        content: `"${makeExcerpt(lookupData.logger, comment.body)}"`,
                                    }], style("center", "paddingLargeHorizontal", "noMargin"))
                                ])
                            ]),
                            tableSpacerSm,
                            tr([
                                td([
                                    Button({
                                        text: i18next.t(TK.Feedback_DigestMail_ReadComment),
                                        href: link,
                                    }, style("outlineButton"))
                                ], style("center"))
                            ]),
                            tableSpacerMd,
                        ], style("fullWidth", "grayFrame"))
                    ])
                ])
            ], style("fullWidth", "whiteBg", "paddingLargeHorizontal", "paddingMediumVertical"))
        })
    });

    const feedbackBoxes = Object.entries(feedbacksMap).flatMap(([publicationId, feedbacks]) => {
        const publication = publications.find(p => p.id === publicationId);
        const title = publication.language.storyTitle;
        const link = buildEditorItemUrl(
            "binder",
            domain,
            publication.binderId,
            getEditorLocation(domain, lookupData.devEditorLocation),
        );
        return feedbacks.map(feedback => {
            const rater = users.find(u => u.id === feedback.userId);
            const raterName = rater ? buildUserName(rater) : i18next.t(TK.Reader_FeedbackAnonymousUser, { lng });
            return Table([
                tr([
                    td([
                        Para([
                            {
                                content: i18next.t(TK.Feedback_DigestMail_UserLeftRating, {
                                    raterName,
                                    title,
                                    lng,
                                })
                            }
                        ], style("center", "noMargin"))
                    ]),
                ]),
                tableSpacerSm,
                tr([
                    td([
                        Table([
                            tableSpacerSm,
                            tr([
                                td([
                                    Para([
                                        { content: drawStars(feedback.rating) }
                                    ], style("center", "fontXLarge", "colorGold", "paddingLargeHorizontal", "noMargin"))
                                ])
                            ]),
                            ...(
                                feedback.message ?
                                    [
                                        tableSpacerSm,
                                        tr([
                                            td([
                                                Para([
                                                    { content: `"${makeExcerpt(lookupData.logger, feedback.message)}"` }
                                                ], style("center", "paddingLargeHorizontal", "noMargin"))
                                            ])
                                        ]),
                                    ] :
                                    []
                            ),
                            tableSpacerSm,
                            tr([
                                td([
                                    Button({
                                        text: i18next.t(TK.Feedback_DigestMail_ReadFeedback),
                                        href: link,
                                    }, style("outlineButton"))
                                ], style("center"))
                            ]),
                            tableSpacerMd,
                        ], style("fullWidth", "grayFrame"))
                    ])
                ])
            ], style("fullWidth", "whiteBg", "paddingLargeHorizontal", "paddingMediumVertical"))
        })
    });

    const boxes = Table(
        intersperse(
            tableSpacerMd,
            [
                ...commentBoxes.map(cb => tr([td([cb])])),
                ...feedbackBoxes.map(fb => tr([td([fb])])),
            ],
        ),
        style("fullWidth"),
    );

    return buildTransactionalMailMarkup(
        domain,
        [
            Para([
                { content: i18next.t(TK.Feedback_DigestMail_Intro, { lng }) },
            ], style("center", "paddingMedium", "whiteBg", "noMargin")),
            Table([tableSpacerMd]),
            boxes,
        ],
        readerBranding,
        {
            salutation: `${i18next.t(TK.General_Hi, { lng })} ${userName}`,
            transparentBackgroundInCenterPane: true,
            noPaddingInCenterRange: true,
        }
    );
}
