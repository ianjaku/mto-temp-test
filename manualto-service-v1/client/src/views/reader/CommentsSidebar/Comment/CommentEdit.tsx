import * as FlashMessageModule from "@binders/client/lib/react/flashmessages/actions";
import {
    MAX_ATTACHMENTS_PER_COMMENT,
    UPLOAD_MAX_FILE_SIZE
} from "@binders/client/lib/clients/imageservice/v1/contract";
import React, { useEffect, useMemo, useState } from "react";
import {
    UnsupportedMedia,
    fileListToFiles,
    getAcceptVisualsString
} from "@binders/client/lib/clients/imageservice/v1/visuals";
import {
    useCommentStagedAttachments,
    useReaderCommentsStoreActions
} from "../../../../stores/zustand/readerComments-store";
import Button from "@binders/ui-kit/lib/elements/button";
import { DraftAttachments } from "../CommentInput/DraftAttachments";
import { EditedAttachments } from "../CommentInput/EditedAttachments";
import { FlashMessageActions } from "@binders/client/lib/react/flashmessages/actions";
import Icon from "@binders/ui-kit/lib/elements/icons";
import { ReaderComment } from "@binders/client/lib/clients/commentservice/v1/contract";
import { TK } from "@binders/client/lib/react/i18n/translations";
import circularProgress from "@binders/ui-kit/lib/elements/circularprogress";
import { humanizeBytes } from "@binders/client/lib/util/formatting";
import { useEditReaderComment } from "../../../../stores/hooks/comment-hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./CommentEdit.styl";

export const CommentEdit: React.FC<{
    editedComment: ReaderComment,
    finishEdit: () => void
}> = ({ editedComment, finishEdit }) => {
    const { t } = useTranslation();
    const [ commentText, setCommentText ] = useState(editedComment.body);
    const [ attachmentIdsForRemoval, setAttachmentIdsForRemoval ] = useState<string[]>([]);
    const { editReaderComment, isLoading } = useEditReaderComment(editedComment.threadId, editedComment.commentId);

    const editComment = async () => {
        if (!commentText) {
            return;
        }
        const successful = await editReaderComment({
            binderId: editedComment.binderId,
            commentEdits: { text: commentText, attachmentIdsForRemoval }
        }); 
        if (successful) {
            finishEdit();
        } else {
            FlashMessageActions.error(t(TK.General_SomethingWentWrong));
        }
    };
    const editCommentClick = (e?: React.MouseEvent) => {
        e.preventDefault();
        editComment();
    };

    const cancelCommentClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        finishEdit();
    };

    const stagedAttachments = useCommentStagedAttachments(editedComment.commentId);
    const {
        clearStagedAttachmentsForNonNewComments,
        addFilesAsStagedAttachmentsForComment,
        removeStagedAttachmentForComment,
    } = useReaderCommentsStoreActions();

    const onSelectAttachments = async (e: React.SyntheticEvent) => {
        const files = e["dataTransfer"] ? e["dataTransfer"].files : e.target["files"];
        e.persist();
        try {
            const attachmentFiles = await fileListToFiles(files);
            if (!attachmentFiles.length) {
                return;
            }
            if (editedAttachments.length + stagedAttachments.length + attachmentFiles.length > MAX_ATTACHMENTS_PER_COMMENT) {
                FlashMessageModule.FlashMessageActions.error(
                    t(TK.Comments_MaximumNumberOfAttachments, { count: MAX_ATTACHMENTS_PER_COMMENT })
                );
                return;
            }
            for (const attachmentFile of attachmentFiles) {
                if (attachmentFile.size > UPLOAD_MAX_FILE_SIZE) {
                    const humanizedMaxSize = humanizeBytes(UPLOAD_MAX_FILE_SIZE);
                    FlashMessageModule.FlashMessageActions.error(
                        t(TK.General_FileTooLarge, { file: attachmentFile.name, humanizedMaxSize })
                    );
                    return;
                }
            }
            e.target["value"] = "";
            await addFilesAsStagedAttachmentsForComment(attachmentFiles, editedComment.commentId);
        } catch (e) {
            if (e.name === UnsupportedMedia.NAME) {
                FlashMessageModule.FlashMessageActions.error(e.description || e.message);
            } else {
                throw e;
            }
        }
    };
    const editedAttachments = useMemo(() =>
        editedComment.attachments.filter(attachment => !attachmentIdsForRemoval.includes(attachment.id)),
    [editedComment.attachments, attachmentIdsForRemoval]);

    const removeEditedAttachment = (attachmentId: string) => {
        setAttachmentIdsForRemoval(ids => [...ids, attachmentId]);
    }
    const removeStagedAttachment = (clientId: string) =>
        removeStagedAttachmentForComment(clientId, editedComment.commentId);

    useEffect(() => clearStagedAttachmentsForNonNewComments(), [clearStagedAttachmentsForNonNewComments]);

    return (
        <div className="commentEdit-inputWrapper">
            <div className="commentEdit-textareaWrapper">
                <textarea
                    className="commentEdit-input"
                    placeholder={t(TK.Comments_CreateReaderCommentPlaceholder)}
                    onChange={e => setCommentText(e.target.value)}
                    onKeyUp={e => {
                        if (e.key === "Enter" && e.ctrlKey) {
                            editComment();
                        }
                    }}
                    value={commentText}
                    disabled={isLoading}
                    autoFocus={true}
                />
                <div className="attachmentsList">
                    <EditedAttachments
                        attachmentVisuals={editedAttachments}
                        onRemoveAttachment={removeEditedAttachment}
                    />
                    <DraftAttachments
                        attachments={stagedAttachments}
                        isLoading={isLoading}
                        onRemoveAttachment={removeStagedAttachment}
                    />
                </div>
            </div>
            <div className="commentEdit-actions">
                <div className="commentEdit-icon">
                    <label className="commentEdit-attach" htmlFor="attachment-edit-upload">
                        <Icon
                            name="attachment"
                            style={{ fontSize: "20px" }}
                        />
                        <span className="commentEdit-icon-text">{t(TK.Comments_AttachMedia)}</span>
                    </label>
                    <input
                        type="file"
                        id="attachment-edit-upload"
                        name="attachment-edit-upload"
                        accept={getAcceptVisualsString()}
                        multiple
                        style={{ display: "none" }}
                        onChange={onSelectAttachments}
                    />
                </div>
                <div className="commentEdit-actions-buttons">
                    <Button
                        className="commentEdit-cancel"
                        onClick={cancelCommentClick}
                        text={t(TK.General_Cancel)}
                        id="readerComments-cancelComment"
                        secondary={true}
                    />
                    <Button
                        className="commentEdit-submit"
                        onClick={editCommentClick}
                        text={t(TK.General_Save)}
                        id="readerComments-submitComment"
                        isEnabled={!!commentText}
                        CTA
                    />
                </div>
            </div>
            <div className="commentEdit-loading">
                {isLoading && circularProgress()}
            </div>
        </div>
    );
};
