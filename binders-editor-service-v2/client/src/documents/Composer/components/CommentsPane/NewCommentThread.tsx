import * as React from "react";
import { CommentTextArea } from "./CommentTextArea";
import Icon from "@binders/ui-kit/lib/elements/icons";
import { TK } from "@binders/client/lib/react/i18n/translations";
import { useAnimateVisibility } from "@binders/client/lib/react/helpers/hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./NewCommentThread.styl";

const { useEffect, useRef } = React;

export const NewCommentThread: React.FC = () => {
    const { t } = useTranslation();
    const {
        isVisible: isFormVisible,
        setVisibility: setIsFormVisible,
        shouldRender: shouldFormRender,
    } = useAnimateVisibility(false);
    const {
        isVisible: isBtnVisible,
        setVisibility: setIsBtnVisible,
        shouldRender: shouldBtnRender,
    } = useAnimateVisibility(true);

    const showForm = () => {
        if (isFormVisible || shouldFormRender || !isBtnVisible || !shouldBtnRender) return;
        setIsBtnVisible(false);
        setIsFormVisible(true);
    };

    const hideForm = () => {
        if (isBtnVisible || shouldBtnRender || !isFormVisible || !shouldFormRender) return;
        setIsFormVisible(false);
        setIsBtnVisible(true);
    };

    const textAreaRef = useRef<HTMLTextAreaElement>();

    useEffect(() => {
        if (isFormVisible) {
            textAreaRef.current?.focus();
        }
    }, [isFormVisible, textAreaRef]);

    const buttonMarkup = shouldBtnRender ?
        (
            <button
                className={`new-thread-btn animate-visibility ${isBtnVisible ? "visible" : "invisible"}`}
                onClick={showForm}
            >
                <Icon name="add" />
                <span>{t(TK.Comments_NewThread)}</span>
            </button>
        ) :
        null;

    const formMarkup = shouldFormRender ?
        (
            <div
                className={`new-thread-form animate-visibility ${isFormVisible ? "visible" : "invisible"}`}
            >
                <CommentTextArea ref={textAreaRef} onSuccess={hideForm} />
                <button className="new-thread-close" onClick={hideForm}>
                    <Icon name="close" />
                </button>
            </div>
        ) :
        null;

    return (
        <div className="comments-new-thread">
            <div className="comments-new-thread-container">
                {formMarkup}
                {buttonMarkup}
            </div>
        </div>
    )
}
