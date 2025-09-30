import * as React from "react";
import Send from "@binders/ui-kit/lib/elements/icons/Send";
import { TK } from "@binders/client/lib/react/i18n/translations";
import { useCreateEditorComment } from "./hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./CommentTextArea.styl"

const { forwardRef, useCallback, useEffect, useMemo, useState } = React;

export type CommentTextAreaProps = {
    threadId?: string;
    onSuccess?: () => void;
}

export const CommentTextArea = forwardRef<HTMLTextAreaElement, CommentTextAreaProps>(({ onSuccess, threadId }, ref) => {
    const { t } = useTranslation();
    const [text, setText] = useState("");
    const mutation = useCreateEditorComment();
    const isValid = useMemo(() => text.trim().length > 0 && !mutation.isLoading, [mutation, text]);
    const addComment = useCallback(() => {
        if (mutation.isLoading) return;
        if (isValid) {
            mutation.mutate({ threadId, body: text })
        }
    }, [isValid, mutation, text, threadId]);

    useEffect(() => {
        if (mutation.isSuccess) {
            mutation.reset();
            setText("");
            onSuccess?.();
        }
    }, [mutation, onSuccess]);

    return (
        <div className="comment-textarea-container">
            {mutation.isError &&
                <div className="comment-error">
                    <p>{t(TK.Comments_CreateError)}</p>
                </div>
            }
            <div className="comment-textarea">
                <textarea
                    ref={ref}
                    placeholder={t(TK.Edit_CommentInsertHere)}
                    onClick={e => e.stopPropagation()}
                    onChange={e => setText(e.target.value)}
                    disabled={mutation.isLoading}
                    onKeyUp={e => {
                        if (e.key === "Enter" && e.ctrlKey) addComment();
                    }}
                    value={text}
                ></textarea>
                <div
                    className={`btn-send ${isValid ? "visible" : "invisible"}`}
                    onClick={e => {
                        e.stopPropagation();
                        addComment();
                    }}>
                    <Send />
                </div>
            </div>
        </div>
    )
});
