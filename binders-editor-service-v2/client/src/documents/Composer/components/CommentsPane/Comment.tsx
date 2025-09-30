import * as React from "react";
import { FC, useCallback, useRef, useState } from "react";
import { ModalProps, useShowModal } from "@binders/ui-kit/lib/compounds/modals/ModalViewProvider";
import Button from "@binders/ui-kit/lib/elements/button";
import ContextMenu from "@binders/ui-kit/lib/elements/contextmenu";
import { FitBehaviour } from "@binders/ui-kit/lib/elements/thumbnail";
import { IBinderComment } from "@binders/client/lib/clients/commentservice/v1/contract";
import Icon from "@binders/ui-kit/lib/elements/icons";
import MenuItem from "@binders/ui-kit/lib/elements/contextmenu/MenuItem";
import Modal from "@binders/ui-kit/lib/elements/modal";
import { TK } from "@binders/client/lib/react/i18n/translations";
import { Visual } from "@binders/client/lib/clients/imageservice/v1/Visual";
import VisualThumbnail from "@binders/ui-kit/lib/elements/thumbnail/VisualThumbnail";
import cx from "classnames";
import { fmtDateTimeWritten } from "@binders/client/lib/util/date";
import { useCurrentUserId } from "../../../../users/hooks";
import { useDeleteEditorComment } from "./hooks";
import { useInterfaceLanguage } from "../../../../hooks/useInterfaceLanguage";
import { useTranslation } from "@binders/client/lib/react/i18n";
import { useVisualModal } from "../../../../media/VisualModal";
import "./CommentThread.styl";

export type CommentProps = {
    comment: IBinderComment;
    isInResolvedThread: boolean;
    isFirstCommentInThread: boolean;
    threadNewComments?: number;
}

export const Comment: FC<CommentProps> = ({
    comment,
    isInResolvedThread,
    isFirstCommentInThread,
    threadNewComments,
}) => {
    const { t } = useTranslation();
    const { showVisualModal } = useVisualModal();
    const language = useInterfaceLanguage();
    const [isHovered, setIsHovered] = useState(false);
    const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
    const userId = useCurrentUserId();
    const commentContextMenuAnchorRef = useRef();
    const isOwnComment = comment.userId === userId;
    const { mutate: deleteComment } = useDeleteEditorComment();
    const showModal = useShowModal(DeleteCommentModal);

    const confirmDelete = useCallback(async () => {
        setIsContextMenuOpen(false);
        if (await showModal()) {
            deleteComment({
                commentId: comment.id,
                threadId: comment.threadId,
            })
        }
    }, [comment, deleteComment, setIsContextMenuOpen, showModal]);

    const resolvedIconMarkup = <div className="comment-resolved-icon"><span className="fa fa-check" /></div>;
    const newCommentsMarkup = <div className="comment-new-comments">{t(TK.Comments_SomeNew, { count: threadNewComments })}</div>;

    return (
        <div
            className="comment-thread-comment"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="comment-row-author-date">
                <span className="comment-author">{comment.userName}</span>
                <span className="comment-date">{comment.created && fmtDateTimeWritten(new Date(comment.created), language)}</span>
                <span className="grow" />
                {
                    <span
                        className={cx(
                            "comment-context-menu",
                            isOwnComment && isHovered && "comment-context-menu__visible"
                        )}
                        onClick={e => {
                            e.stopPropagation();
                            setIsContextMenuOpen(prev => !prev)
                        }}
                        ref={commentContextMenuAnchorRef}
                    >
                        <Icon name="more_horiz" />
                        {/* <ThreeDotsElastic /> */}
                    </span>
                }
                {isFirstCommentInThread && (isInResolvedThread ? resolvedIconMarkup : newCommentsMarkup)}
            </div>
            <ContextMenu
                anchorRef={commentContextMenuAnchorRef.current}
                anchorOrigin={{
                    horizontal: "right",
                    vertical: "bottom"
                }}
                className="comment-context-menu-dropdown"
                open={isContextMenuOpen}
                onClose={() => setIsContextMenuOpen(false)}
            >
                <MenuItem
                    iconName="delete"
                    onClick={confirmDelete}
                    title={t(TK.Edit_CommentDelete)}
                />
            </ContextMenu>
            <div className="comment-row-body">
                <span className="comment-body">{comment.markedAsDeleted ? `[${t(TK.Comments_DeletedByAuthor)}]` : comment.body}</span>
            </div>
            <div className="comment-row-attachments">
                {comment.attachments?.map(attch => {
                    const visual = Object.assign(Object.create(Visual.prototype), attch);
                    return (
                        <div key={attch.id} className="comment-row-attachment">
                            <VisualThumbnail
                                visual={visual}
                                width={60}
                                fitBehaviour={FitBehaviour.CROP}
                                onClick={() => showVisualModal(visual, { showDownloadButton: true })}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

const DeleteCommentModal: FC<ModalProps<{ noop?: boolean }, boolean>> = ({ hide }) => {
    const { t } = useTranslation();
    return (
        <Modal
            title={t(TK.Comments_DeletionConfirmation_Title)}
            classNames="modal-delete-comment"
            buttons={[
                <Button
                    text={t(TK.General_Cancel)}
                    secondary
                    onClick={() => hide(false)}
                />,
                <Button
                    text={t(TK.Edit_CommentDelete)}
                    CTA
                    onClick={() => hide(true)}
                />
            ]}
        >
            <p>{t(TK.Comments_DeletionWarning)}</p>
        </Modal>
    )
}

