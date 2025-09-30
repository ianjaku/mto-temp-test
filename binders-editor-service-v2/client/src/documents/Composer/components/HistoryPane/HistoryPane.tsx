import * as React from "react";
import { IReaderLinkParams, buildLink } from "@binders/client/lib/binders/readerPath";
import {
    IViewsSummary,
    PublicationSummary
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { add, flatten, partition, reverse } from "ramda";
import { dateSorterAsc, fmtDateIso8601TZ } from "@binders/client/lib/util/date";
import Checkbox from "@binders/ui-kit/lib/elements/checkbox";
import PublicationRow from "./PublicationRow";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { getReaderLocation } from "@binders/client/lib/util/domains";
import { useBinderPublicationSummaries } from "./hooks";
import { useCurrentUserId } from "../../../../users/hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";
import vars from "@binders/ui-kit/lib/variables";
import "./HistoryPane.styl";

const formatDate = (date: Date, fallback: string) => date == null ? fallback : fmtDateIso8601TZ(date);

type ViewsInfo = {
    totalViewsCount: number;
    currentUserViewsCount: number;
};

export type HistoricalPublication = PublicationSummary & ViewsInfo & {
    publishedFrom: string;
    publishedTo: string;
};

const HistoryPane: React.FC<{
    binderId: string,
    domain: string
}> = ({
    binderId,
    domain,
}) => {
    const { t } = useTranslation();
    const { isSuccess, isLoading, data: publicationSummaries } = useBinderPublicationSummaries(binderId);
    const goToPublication = (publicationId: string) => openPublication(publicationId, domain);
    return (isSuccess ?
        <HistoricalPublicationsContainer publicationSummaries={publicationSummaries} goToPublication={goToPublication} /> :
        <span className="historyPane-not-successful">
            {t(isLoading ? TK.General_LoadingPublications : TK.General_LoadingPublicationsError)}
        </span>
    );
}

const HistoricalPublicationsContainer: React.FC<{
    publicationSummaries: PublicationSummary[];
    goToPublication: (publicationId: string) => void;
}> = ({ publicationSummaries, goToPublication }) => {
    const { t } = useTranslation();
    const currentUserId = useCurrentUserId();
    const historicalPublications = toOrderedHistoricalPublications(publicationSummaries, currentUserId, t(TK.General_Now), t(TK.General_NotApplicable));
    const [hideWhenOnlyViewedByMe, setHideWhenOnlyViewedByMe] = React.useState(false);

    const renderOptions = () => {
        return (
            <div className="historyPane-options" key="hp-options">
                <Checkbox
                    onCheck={() => setHideWhenOnlyViewedByMe(!hideWhenOnlyViewedByMe)}
                    label={t(TK.Edit_HistoryHideViewedMe)}
                    checked={hideWhenOnlyViewedByMe}
                    className="historyPane-options-checkbox"
                    labelStyle={{ color: vars.whiteColor }}
                    iconStyle={{ fill: vars.whiteColor, marginRight: "7px" }}
                />
            </div>
        );
    };

    const renderTable = () => {
        const shownHistoricalPublications = hideWhenOnlyViewedByMe ?
            historicalPublications.filter(p => p.totalViewsCount > p.currentUserViewsCount) :
            historicalPublications;
        return (
            <div className="historyPane-table" key="hp-table">
                {shownHistoricalPublications.map((publication, i) => (
                    <PublicationRow
                        publication={publication}
                        key={`pubsrow${i}`}
                        onClickTitle={() => goToPublication(publication.id)}
                    />
                ))}
            </div>
        );
    };

    return (
        <div className="historyPane-container">
            {
                historicalPublications.length > 0 ?
                    [
                        renderOptions(),
                        renderTable()
                    ] :
                    (
                        <label>
                            {t(TK.Edit_HistoryNoPublications)}
                        </label>
                    )
            }
        </div>
    );
};

function toOrderedHistoricalPublications(publicationSummaries: PublicationSummary[], currentUserId: string, localizedNow: string, localizedNotApplicable: string): HistoricalPublication[] {
    const publicationsSortedAscByPublicationDate = [...publicationSummaries]
        .sort((left, right) => dateSorterAsc(left.publicationDate, right.publicationDate));

    const historicalPublications: HistoricalPublication[] = [];
    for (const [index, publicationSummary] of publicationsSortedAscByPublicationDate.entries()) {
        const publicationsAfterCurrent = publicationsSortedAscByPublicationDate.slice(index + 1);
        const historicalPublication: HistoricalPublication = {
            ...publicationSummary,
            publishedFrom: formatDate(publicationSummary.publicationDate, localizedNotApplicable),
            publishedTo: findPublishedToDateString(publicationSummary, publicationsAfterCurrent, localizedNow, localizedNotApplicable),
            ...countViews(publicationSummary.viewsSummary, currentUserId),
        };
        historicalPublications.push(historicalPublication);
    }
    return flatten(partition(p => p.isPublished, reverse(historicalPublications)));
}

const findPublishedToDateString = (
    publication: PublicationSummary,
    publicationsAfterCurrent: PublicationSummary[],
    localizedNow: string,
    localizedNotApplicable: string
): string => {
    if (publication.isPublished) {
        return localizedNow;
    }
    if (publication.unpublishDate) {
        return formatDate(publication.unpublishDate, localizedNotApplicable);
    }
    const nextPublication = publicationsAfterCurrent.find(futurePublication => futurePublication.language.iso639_1 === publication.language.iso639_1);
    return formatDate(nextPublication?.publicationDate, localizedNotApplicable);
};

const countViews = (viewsSummary: IViewsSummary = {}, currentUserId: string): ViewsInfo => {
    const totalViewsCount = Object.values(viewsSummary).reduce(add, 0);
    const currentUserViewsCount = Object.entries(viewsSummary)
        .map(([userId, views]) => userId === currentUserId ? views : 0)
        .reduce(add, 0);
    return { totalViewsCount, currentUserViewsCount };
};

const openPublication = (publicationId: string, domain: string) => {
    const readerLocation = getReaderLocation(domain);
    const config: IReaderLinkParams = {
        isCollection: false,
        itemId: publicationId,
        domain,
        readerLocation,
        isDraft: false,
        fullPath: false,
        isPublication: true,
    };
    const url = buildLink(config);
    const win = window.open(url, "_blank");
    if (win) {
        win.focus();
    }
};

export default HistoryPane;
