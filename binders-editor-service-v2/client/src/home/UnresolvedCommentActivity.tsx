import * as React from "react";
import { EditorEvent, captureFrontendEvent } from "@binders/client/lib/thirdparty/tracking/capture";
import { FC, useCallback, useMemo } from "react";
import { TFunction, useTranslation } from "@binders/client/lib/react/i18n";
import ArrowOutward from "@binders/ui-kit/lib/elements/icons/ArrowOutward";
import Assignment from "@binders/ui-kit/lib/elements/icons/Assignment";
import { COMPOSER_ROUTE } from "../documents/Composer/routes";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { UserActivity } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import cx from "classnames";
import { fmtDateTimeRelative } from "@binders/client/lib/util/date";
import { getUserName } from "@binders/client/lib/clients/userservice/v1/helpers";
import { useCurrentUserId } from "../users/hooks";
import "./UnresolvedCommentActivity.styl";

export const UnresolvedCommentsActivity: FC<{ activity: UserActivity }> = ({ activity }) => {
    const { t } = useTranslation();
    const userId = useCurrentUserId();

    const [ isHovered, setIsHovered ] = React.useState(false);

    const handleGoToDoc = useCallback(() => {
        captureFrontendEvent(EditorEvent.HomePageGoToDocumentClicked, { docId: activity.documentId });
        window.open(`${COMPOSER_ROUTE}/${activity.documentId}`, "_blank");
    }, [activity.documentId]);

    const authors = useMemo(
        () => activity.commentsAuthors.map(u => u.id === userId ? t(TK.General_You) : getUserName(u)),
        [activity.commentsAuthors, t, userId],
    );
    const activityAuthors = useMemo(
        () => getActivityAuthors(t, authors),
        [authors, t]
    )
    const latestCommentAuthor = authors.at(0);

    return (
        <div
            onClick={handleGoToDoc}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="activity"
        >
            <div className="activity-icon"><Assignment /></div>
            <div className="activity-body">
                <div className="activity-body-message">
                    <div>
                        <span className="doc-title">{activity.documentTitle}</span>
                        &nbsp;
                        {t(TK.HomePage_HasUnresolvedComments, { count: activity.commentsCount, authors: activityAuthors })}
                    </div>
                    <div className="activity-body-message-footer">
                        {t(TK.HomePage_LatestCommentMessage, {
                            when: fmtDateTimeRelative(activity.latestCommentDate, { addSuffix: true, strict: true }),
                            author: latestCommentAuthor,
                        })}
                    </div>
                </div>
                <button type="button" className={cx("activity-body-link", { "activity-body-link--hovered": isHovered })}>
                    <div className="activity-body-link-message">{t(TK.HomePage_LinkToDocument)}</div>
                    <ArrowOutward />
                </button>
            </div>
        </div>
    );
}

function getActivityAuthors(t: TFunction, authors: string[]) {
    if (authors.length === 1) {
        return authors.at(0);
    }
    if (authors.length === 2) {
        return t(TK.HomePage_ExpandedCommentAuthors_two, {
            latestAuthor: authors.at(0),
            oldestAuthor: authors.at(-1),
        });
    }
    return t(TK.HomePage_ExpandedCommentAuthors_other, {
        latestAuthor: authors.at(0),
        otherCount: authors.length - 1,
    });
}
