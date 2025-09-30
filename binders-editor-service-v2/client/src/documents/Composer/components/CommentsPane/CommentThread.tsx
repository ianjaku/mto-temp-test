import * as React from "react";
import { EditorEvent, captureFrontendEvent } from "@binders/client/lib/thirdparty/tracking/capture";
import { Application } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { Comment } from "./Comment";
import { CommentTextArea } from "./CommentTextArea";
import { ExtendedCommentThread } from "@binders/client/lib/clients/commentservice/v1/contract";
import { FlashMessages } from "../../../../logging/FlashMessages";
import { TK } from "@binders/client/lib/react/i18n/translations";
import { fmtDateTimeWritten } from "@binders/client/lib/util/date";
import { resolveThread } from "../../../../bindercomments/actions";
import { useActiveAccountId } from "../../../../accounts/hooks";
import { useInterfaceLanguage } from "../../../../hooks/useInterfaceLanguage";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./CommentThread.styl";

const { useCallback, useEffect, useState } = React;

export type CommentThreadProps = {
    thread: ExtendedCommentThread;
    isExpanded?: boolean;
    app: Application,
}

export const CommentThread: React.FC<CommentThreadProps> = ({ isExpanded: initialExpanded, thread, app }) => {
    const { t } = useTranslation();
    const accountId = useActiveAccountId();
    const [isExpanded, setIsExpanded] = useState(initialExpanded);
    const language = useInterfaceLanguage();
    const onResolveThread = useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            captureFrontendEvent(EditorEvent.CommentThreadResolveClicked, { commentSource: app === Application.READER ? "READER" : "EDITOR" });
            await resolveThread(accountId, thread.binderId, thread.id);
        } catch (e) {
            FlashMessages.error(t(TK.General_SomethingWentWrong));
        }
    }, [accountId, app, thread, t]);
    useEffect(() => setIsExpanded(initialExpanded), [initialExpanded]);

    if (!thread.comments.length) {
        return (
            <div className="comment-thread">
                <span className="comment-deleted">{t(TK.Comments_ThreadDeleted)}</span>
            </div>
        )
    }
    const comments = isExpanded ? thread.comments : [thread.comments[0]];
    const resolvedByWhomWhen = t(TK.Comments_ResolvedBy_Right, {
        name: thread.resolvedByName,
        date: thread.resolvedDate ? fmtDateTimeWritten(new Date(thread.resolvedDate), language) : "",
    });
    return (
        <div className={`comment-thread ${thread.resolved ? "resolved" : ""}`} onClick={() => setIsExpanded(prev => !prev)}>
            <span className={`fa fa-chevron-${isExpanded ? "down" : "right"} comment-chevron`} />
            {comments.map((comment, idx) => (
                <Comment
                    key={comment.id}
                    comment={comment}
                    isInResolvedThread={thread.resolved}
                    isFirstCommentInThread={idx === 0}
                    threadNewComments={thread.comments.length}
                />
            ))}
            {thread.resolved && isExpanded ?
                (
                    <p>
                        <span className="resolved-hint">{t(TK.Comments_ResolvedBy_Left)}</span> {resolvedByWhomWhen}
                    </p>
                ) :
                null}
            {!thread.resolved && isExpanded ?
                (
                    <button className="resolve-btn" onClick={onResolveThread}>
                        {t(TK.Edit_CommentMarkResolved)}
                    </button>
                ) :
                null}
            {isExpanded && <CommentTextArea threadId={thread.id} />}
        </div>
    )
}

