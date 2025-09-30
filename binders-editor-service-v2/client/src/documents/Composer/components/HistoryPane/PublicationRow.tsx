import * as React from "react";
import { UNDEFINED_LANG, UNDEFINED_LANG_UI } from "@binders/client/lib/util/languages";
import { HistoricalPublication } from "./HistoryPane";
import RightArrow from "@binders/ui-kit/lib/elements/icons/RightArrow";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import cx from "classnames";
import { useTranslation } from "@binders/client/lib/react/i18n";
import vars from "@binders/ui-kit/lib/variables";

export interface PublicationRowProps {
    publication: HistoricalPublication;
    onClickTitle: () => void;
}

const PublicationRow: React.FC<PublicationRowProps> = ({
    publication,
    onClickTitle,
}) => {
    const { t } = useTranslation();
    const {
        isPublished,
        language: { storyTitle, iso639_1: languageCode },
        chunkCount,
        publishedFrom,
        publishedTo,
        totalViewsCount,
        currentUserViewsCount,
        publishedBy
    } = publication;

    return (
        <div className={cx("historyPane-table-row", { "historyPane-table-row--inactive": !isPublished })}>
            <div className="historyPane-table-row-title" onClick={onClickTitle}>
                <div className={cx("historyPane-table-row-title-lang", { "historyPane-table-row-title-lang--render-disabled": !isPublished })}>
                    {languageCode === UNDEFINED_LANG ? UNDEFINED_LANG_UI : languageCode}
                </div>
                <div className="historyPane-table-row-title-text">
                    {storyTitle}
                </div>
            </div>
            {
                publishedBy && (
                    <div className="historyPane-table-row-info">
                        {t(TK.Analytics_PublishedBy, { by: publishedBy })}
                    </div>
                )
            }
            {
                publishedFrom && (
                    <div className="historyPane-table-row-info">
                        {publishedFrom}{RightArrow({ fontSize: "15px", color: vars.disabledColor })}{publishedTo}{", "}
                        {
                            chunkCount !== undefined &&
                                `${t(TK.Analytics_ViewWithCount, { count: totalViewsCount })} ${totalViewsCount > 0 ? `(${currentUserViewsCount} ${t(TK.Edit_HistoryByMe)})` : ""}, ${t(TK.Edit_ChunkWithCount, { count: chunkCount })}`
                        }
                    </div>
                )
            }
        </div>
    );
}

export default PublicationRow;