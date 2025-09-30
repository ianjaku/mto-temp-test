import React, { useCallback, useState } from "react";
import {
    useIsCurrentCommentInEditMode,
    useReaderCommentsStoreActions
} from "../../../../stores/zustand/readerComments-store";
import { CommentAttachments } from "../CommentAttachments";
import { CommentContextMenu } from "./CommentContextMenu";
import { CommentDeleteConfirmationModal } from "./CommentDeleteConfirmationModal";
import { CommentEdit } from "./CommentEdit";
import { FlashMessageActions } from "@binders/client/lib/react/flashmessages/actions";
import { ReaderComment } from "@binders/client/lib/clients/commentservice/v1/contract";
import { ResolvedIcon } from "./ResolvedIcon";
import { TK } from "@binders/client/lib/react/i18n/translations";
import cx from "classnames";
import { fmtDateWritten } from "@binders/client/lib/util/date";
import { isTouchDevice } from "@binders/client/lib/util/browsers";
import { useDeleteReaderComment } from "../../../../stores/hooks/comment-hooks";
import { useInterfaceLanguage } from "../../../../helpers/hooks/useInterfaceLanguage";
import { useShowModal } from "@binders/ui-kit/lib/compounds/modals/ModalViewProvider";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./Comment.styl";

export const Comment: React.FC<{
    comment: ReaderComment;
    onSelect: () => void;
    selected: boolean;
}> = ({
    comment,
    onSelect,
    selected,
}) => {
    const inEditMode = useIsCurrentCommentInEditMode(comment.commentId);
    const { setCommentEditStatus, clearCommentEditStatus } = useReaderCommentsStoreActions();
    const { t } = useTranslation();
    const language = useInterfaceLanguage();
    const [ isHovered, setIsHovered ] = useState(false);
    const deleteCommentFn = useDeleteReaderComment(comment);

    const onConfirmDeleteCommentClick = useCallback(async (): Promise<void> => {
        try {
            await deleteCommentFn();
        } catch (e) {
            FlashMessageActions.error(t(TK.Comments_DeleteFailed));
        }
    }, [deleteCommentFn, t]);
    const deletionConfirmationModal = useShowModal(CommentDeleteConfirmationModal);

    return (
        <div
            className={cx(
                "comment-item",
                "transition-shadow",
                { "comment-item--selected": selected }
            )}
            key={comment.commentId}
            onMouseEnter={() => !isTouchDevice() && setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={onSelect}
        >
            <div className="comment-item-content-wrapper">
                <div className="comment-item-content-top">
                    <div className="comment-item-content-top-left">
                        <div className={cx(
                            { "comment-time--selected": isHovered }
                        )}>
                            {fmtDateWritten(comment.created, language)}
                        </div>
                    </div>
                    <div className="comment-item-content-top-right">
                        {comment.resolved && <ResolvedIcon />}
                        <CommentContextMenu
                            onEditCommentClick={() => setCommentEditStatus(comment.commentId)}
                            onDeleteCommentClick={() => deletionConfirmationModal({ onConfirm: onConfirmDeleteCommentClick })}
                        />
                    </div>
                </div>
                <div className="comment-item-content-body">
                    {
                        inEditMode ?
                            <div className="comment-item-content-edit">
                                <CommentEdit
                                    editedComment={comment}
                                    finishEdit={() => clearCommentEditStatus(comment.commentId)}
                                />
                            </div> :
                            <div className="comment-item-content-preview">
                                <div className="comment-body">
                                    <span>{comment.body}</span>
                                    {comment.isEdited && <span className="comment-edited-label">
                                        &nbsp;({t(TK.Comments_Edited)})
                                    </span>}
                                </div>
                                <CommentAttachments
                                    commentId={comment.commentId}
                                    feedbackAttachments={comment.attachments ?? []}
                                />
                            </div>
                    }
                </div>
            </div>
        </div>
    );
};

