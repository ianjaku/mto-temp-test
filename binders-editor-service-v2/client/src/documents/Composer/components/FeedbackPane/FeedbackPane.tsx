import * as React from "react";
import { dateSorterDesc, fmtDateIso8601TZ, fmtDateTimeWritten } from "@binders/client/lib/util/date";
import { APIExportBinderFeedbacks } from "../../../api";
import Binder from "@binders/client/lib/binders/custom/class";
import Button from "@binders/ui-kit/lib/elements/button";
import Download from "@binders/ui-kit/lib/elements/icons/Download";
import { FaIconStarRating } from "@binders/client/lib/react/icons/font-awesome";
import { FlashMessages } from "../../../../logging/FlashMessages";
import { IBinderFeedback } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { TK } from "@binders/client/lib/react/i18n/translations";
import {
    calculateAverageRating
} from  "@binders/client/lib/clients/repositoryservice/v3/feedbacks/helpers";
import { extractTitleAndLanguage } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { saveCsvToFile } from "@binders/client/lib/util/download";
import { useFeedbackList } from "./hooks";
import { useInterfaceLanguage } from "../../../../hooks/useInterfaceLanguage";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./FeedbackPane.styl";

export type FeedbackPaneProps = {
    binder: Binder;
}

export const FeedbackPane: React.FC<FeedbackPaneProps> = ({ binder }) => {
    const { data } = useFeedbackList(binder.id);

    if (!data || data.length === 0) {
        return (
            <div className="pane-feedback">
                <EmptyFeedbacks />
            </div>
        )
    }
    const feedbacks = data.sort((a, b) => dateSorterDesc(a.created, b.created));
    return (
        <div className="pane-feedback">
            <FeedbacksAggregation feedbacks={feedbacks} binder={binder} />
            <FeedbacksList feedbacks={feedbacks} />
        </div>
    );
}

type FeedbacksAggregationProps = {
    feedbacks: IBinderFeedback[];
    binder: Binder;
}

const FeedbacksAggregation: React.FC<FeedbacksAggregationProps> = ({ feedbacks, binder }) => {
    const [isLoading, setIsLoading] = React.useState(false);
    const { t } = useTranslation();

    const downloadBinderFeedbacks = () => saveCsvToFile(
        () => APIExportBinderFeedbacks(binder.id),
        `${extractTitleAndLanguage(binder.toJSON()).title}_ratings_${fmtDateIso8601TZ(new Date())}`,
        () => FlashMessages.error(t(TK.Exception_SomethingWrong), true),
        setIsLoading,
    );

    const avgRating = calculateAverageRating(feedbacks);
    const maxRating = 5;
    const count = feedbacks.length;
    return (
        <div className="feedbacks-aggregation">
            {!isNaN(avgRating) && (
                <span className="fa fa-star"></span>
            )}
            <div className="feedback-agg-info">
                {!isNaN(avgRating) && (
                    <span className="avg-rating">{avgRating} / {maxRating}</span>
                )}
                <span className="feedbacks-info">
                    {count === 1 ? t(TK.Reader_FeedbackSingular, { count }) : t(TK.Reader_FeedbackPlural, { count })}
                    <Button
                        className="download-ratings-button"
                        onClick={downloadBinderFeedbacks}
                        inactiveWithLoader={isLoading}
                        icon={Download({ fontSize: "12px", margin: "auto 4px" })}
                        text="CSV"
                    />
                </span>
            </div>
        </div>
    );
}

type FeedbacksListProps = {
    feedbacks: IBinderFeedback[];
}

const FeedbacksList: React.FC<FeedbacksListProps> = ({ feedbacks }) => {
    return (
        <div className="feedbacks-list">
            {feedbacks.map(f => <Feedback key={f.id} feedback={f} />)}
        </div>
    )
}

type FeedbackProps = {
    feedback: IBinderFeedback;
}

const Feedback: React.FC<FeedbackProps> = ({ feedback }) => {
    const { t } = useTranslation();
    const language = useInterfaceLanguage();
    return (
        <div className="feedback-item">
            {feedback.rating && (
                <div className="feedback-row">
                    <span className="feedback-rating">
                        <FaIconStarRating rating={feedback.rating} /> 
                        {feedback.rating}
                    </span>
                </div>
            )}
            <div className="feedback-row">
                <span className="feedback-username">{feedback.isAnonymous ? t(TK.Reader_FeedbackAnonymousUser) : feedback.userName}</span>
                <span className="feedback-date">{feedback.created && fmtDateTimeWritten(feedback.created, language)}</span>
            </div>
            <span className="feedback-message">{feedback.message}</span>
        </div>
    )
}

const EmptyFeedbacks: React.FC = () => {
    const { t } = useTranslation();
    return (
        <div className="feedbacks-empty">
            <p>{t(TK.Reader_FeedbackNoFeedbacksYet)}</p>
        </div>
    )
}

