import * as React from "react";
import {
    useMostRecentPublicationUserFeedback,
    useSendPublicationUserFeedback
} from "../../../../stores/hooks/feedback-hooks";
import Checkbox from "@binders/ui-kit/lib/elements/checkbox";
import { ContentChunkProps } from "./types";
import { FEATURE_ANONYMOUS_RATING } from "@binders/client/lib/clients/accountservice/v1/contract";
import { FEEDBACK_CHUNK_DATAPROP } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { IBinderFeedback } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { Rating } from "@binders/ui-kit/lib/elements/Rating";
import { TK } from "@binders/client/lib/react/i18n/translations";
import tokenstore from "@binders/client/lib/clients/tokenstore";
import { useActiveAccountFeatures } from "../../../../stores/hooks/account-hooks";
import { useAnimateVisibility } from "@binders/client/lib/react/helpers/hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./FeedbackChunkPart.styl";

const { useCallback, useEffect, useMemo, useState } = React;

export type FeedbackChunkPartProps = ContentChunkProps;

export const FeedbackChunkPart: React.FC<FeedbackChunkPartProps> = ({ viewable }) => {
    const publicationId = viewable.id;
    const isPublic = tokenstore.isPublic();
    const publicationInDraft = viewable["publicationDate"] == null;
    const [isUpdateFeedback, setIsUpdateFeedback] = useState(false);
    const [updatedUserBinderFeedback, setUpdatedUserBinderFeedback] = useState<IBinderFeedback | null>(null);

    const {
        isVisible: feedbackIsVisible,
        setVisibility: setFeedbackVisibility,
    } = useAnimateVisibility(false);

    const {
        data: initialUserBinderFeedback,
        error: isLoadingFeedbackError,
    } = useMostRecentPublicationUserFeedback(publicationId, publicationInDraft || isPublic);

    const accountFeatures = useActiveAccountFeatures();
    const allowAnonymous = accountFeatures.includes(FEATURE_ANONYMOUS_RATING);
    const userBinderFeedback = updatedUserBinderFeedback || initialUserBinderFeedback;

    useEffect(() => {
        if (userBinderFeedback && !isUpdateFeedback) {
            setFeedbackVisibility(true);
        } else if (!userBinderFeedback && feedbackIsVisible) {
            setFeedbackVisibility(false);
        }
    }, [userBinderFeedback, setFeedbackVisibility, isUpdateFeedback, feedbackIsVisible]);

    useEffect(() => {
        setIsUpdateFeedback(false);
    }, [userBinderFeedback]);

    const isGatherFeedback = isUpdateFeedback || !userBinderFeedback;
    const requestUpdateFeedback = () => {
        setIsUpdateFeedback(true);
        setFeedbackVisibility(false);
    };

    return (
        <div className="chunk-feedback" {...{[FEEDBACK_CHUNK_DATAPROP]: true}}>
            <div className="chunk-feedback-wrapper">
                {isGatherFeedback ?
                    <FeedbackForm
                        allowAnonymous={allowAnonymous && !isPublic}
                        isLoadingFeedbackError={isLoadingFeedbackError}
                        isPreview={publicationInDraft}
                        isVisible={!feedbackIsVisible}
                        publicationId={publicationId}
                        userBinderFeedback={userBinderFeedback}
                        onUpdate={setUpdatedUserBinderFeedback}
                    /> :
                    <FeedbackDisplay
                        requestUpdateFeedback={requestUpdateFeedback}
                        userBinderFeedback={userBinderFeedback}
                        isVisible={feedbackIsVisible}
                    />
                }
            </div>
        </div>
    );
}

const FeedbackForm: React.FC<{
    allowAnonymous: boolean,
    isLoadingFeedbackError: unknown,
    isPreview: boolean,
    isVisible: boolean,
    publicationId: string,
    userBinderFeedback: IBinderFeedback | null,
    onUpdate: (feedback: IBinderFeedback) => void,
}> = ({
    allowAnonymous,
    isLoadingFeedbackError,
    isPreview,
    isVisible,
    publicationId,
    userBinderFeedback,
    onUpdate
}) => {
    const { t } = useTranslation();
    const [rating, setRating] = useState<number | null>();
    const [message, setMessage] = useState("");
    const [isAnonymous, setIsAnonymous] = useState(false);
    const isValidForm = useMemo(() => message && message.length || rating != null, [message, rating]);
    const animationClassNames = `animate-visibility ${isVisible ? "visible" : "invisible"}`;

    const {
        mutate: sendFeedbackFn,
        error: isCreateFeedbackError,
        isLoading: isAddingFeedback,
    } = useSendPublicationUserFeedback(onUpdate);

    useEffect(() => {
        if (userBinderFeedback?.message != null) setMessage(userBinderFeedback.message);
        if (userBinderFeedback?.rating != null) setRating(userBinderFeedback.rating);
        if (userBinderFeedback?.isAnonymous != null) setIsAnonymous(userBinderFeedback.isAnonymous);
    }, [userBinderFeedback]);

    const sendFeedback = useCallback(async () => {
        if (!isValidForm) return;
        sendFeedbackFn({
            publicationId,
            isAnonymous,
            rating,
            message,
        });
    }, [sendFeedbackFn, rating, isValidForm, message, isAnonymous, publicationId]);

    const errorMarkup = isPreview || isCreateFeedbackError || isLoadingFeedbackError ?
        (
            <div className="chunk-feedback-error">
                <p>{t(isPreview ? TK.Edit_FeedbackPreviewMode : TK.General_SomethingWentWrong)}</p>
            </div>
        ) :
        null;

    const buttonMarkup = (
        <button
            className={"chunk-feedback-submit"}
            onClick={sendFeedback}
            disabled={isPreview || !isValidForm}
        >{t(TK.General_Submit)}</button>
    );

    const progressMarkup = (
        <span className="chunk-feedback-progress">{t(TK.General_Sending)}</span>
    );

    return (
        <div className={`chunk-feedback-form ${animationClassNames}`}>
            { errorMarkup }
            <p className={"chunk-feedback-form-title"}>{t(TK.Reader_FeedbackFormTitle)}</p>
            <Rating
                onChange={setRating}
                onReset={() => setRating(null)}
                value={rating}
                width={22}
                disabled={isPreview}
            />
            <textarea
                className="chunk-feedback-message"
                onChange={e => setMessage(e.target.value)}
                placeholder={t(TK.Reader_FeedbackMessageHint)}
                value={message}
                disabled={isPreview}
            ></textarea>
            {
                allowAnonymous ?
                    <Checkbox
                        className="chunk-feedback-anonymous"
                        onCheck={setIsAnonymous}
                        checked={isAnonymous}
                        label={t(TK.Reader_FeedbackStayAnonymous)}
                        disabled={isPreview}
                    /> :
                    null
            }
            {isAddingFeedback ? progressMarkup : buttonMarkup}
        </div>
    );
};

const FeedbackDisplay: React.FC<{
    requestUpdateFeedback: () => void,
    userBinderFeedback: IBinderFeedback,
    isVisible: boolean,
}> = ({
    requestUpdateFeedback,
    userBinderFeedback,
    isVisible
}) => {
    const { t } = useTranslation();
    const animationClassNames = `animate-visibility ${isVisible ? "visible" : "invisible"}`;
    return (
        <div className={`chunk-feedback-last ${animationClassNames}`}>
            <div className={"chunk-feedback-last-title"}>
                <p>{t(TK.Reader_FeedbackExistingTitle)}</p>
            </div>
            {
                userBinderFeedback?.rating ?
                    <Rating disabled value={userBinderFeedback.rating}/> :
                    <></>
            }
            {
                userBinderFeedback?.message ?
                    <blockquote className="message">{userBinderFeedback.message}</blockquote> :
                    <></>
            }
            <button
                className={"chunk-feedback-update"}
                onClick={requestUpdateFeedback}
            >{t(TK.Reader_FeedbackUpdate)}</button>
        </div>
    );
};

