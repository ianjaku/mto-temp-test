import * as FlashMessageModule from "@binders/client/lib/react/flashmessages/actions";
import {
    MAX_ATTACHMENTS_PER_COMMENT,
    UPLOAD_MAX_FILE_SIZE
} from "@binders/client/lib/clients/imageservice/v1/contract";
import React, { FC, createRef, useCallback, useEffect, useMemo, useState } from "react";
import {
    UnsupportedMedia,
    fileListToFiles,
    getAcceptVisualsString
} from "@binders/client/lib/clients/imageservice/v1/visuals";
import { isIPhone, isSmartphone } from "@binders/client/lib/util/browsers";
import {
    isPublicationItem,
    isPublicationSummaryItem
} from "@binders/client/lib/clients/repositoryservice/v3/validation";
import {
    useCommentStagedAttachments,
    useIsAnyCommentInEditMode,
    useReaderCommentsStore,
    useReaderCommentsStoreActions
} from "../../../../stores/zustand/readerComments-store";
import Button from "@binders/ui-kit/lib/elements/button";
import { DraftAttachments } from "./DraftAttachments";
import Icon from "@binders/ui-kit/lib/elements/icons";
import { Publication } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { TK } from "@binders/client/lib/react/i18n/translations";
import circularProgress from "@binders/ui-kit/lib/elements/circularprogress";
import cx from "classnames";
import { humanizeBytes } from "@binders/client/lib/util/formatting";
import { useActiveChunkIndex } from "../../../../stores/hooks/chunk-position-hooks";
import { useActiveViewable } from "../../../../stores/hooks/binder-hooks";
import { useCreateReaderComment } from "../../../../stores/hooks/comment-hooks";
import { useOutsideClick } from "@binders/client/lib/react/helpers/useOutsideClick";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./CommentInput.styl";

const NO_COMMENT_TEXT = "";

export const CommentInput: FC<{
    hideButtonsUntilSelected: boolean;
    isFocused: boolean;
    isVisible: boolean;
    onCommentAdded: () => void;
    setIsFocused: (v: boolean) => void;
}> = ({
    hideButtonsUntilSelected,
    isFocused,
    isVisible,
    onCommentAdded,
    setIsFocused,
}) => {
    const { t } = useTranslation();
    const [commentText, setCommentText] = useState(NO_COMMENT_TEXT);
    const hasDraft = useMemo(() => commentText !== NO_COMMENT_TEXT, [commentText]);
    const writeRef = useOutsideClick<HTMLDivElement>(() => setIsFocused(false));
    const textAreaRef = createRef<HTMLTextAreaElement>();
    const { createReaderComment, isLoading } = useCreateReaderComment();
    const viewable = useActiveViewable();
    const activeChunkIndex = useActiveChunkIndex();
    const shouldShowButtons = useMemo(
        () => !hideButtonsUntilSelected || isFocused,
        [isFocused, hideButtonsUntilSelected]
    );
    const [pageYOffset, setPageYOffset] = useState(0);

    const disabled = useMemo(() => {
        // Should be addressed in the future by
        // https://bindersmedia.atlassian.net/browse/MT-4230
        if (!(viewable as Publication).binderLog) return true;
        if (isPublicationSummaryItem(viewable)) return true;
        if (!isPublicationItem(viewable)) return true;
        if (activeChunkIndex >= viewable.binderLog.current.length) return true;
        return false;
    }, [viewable, activeChunkIndex]);

    const sendComment = async () => {
        if (!commentText) return;
        if (!isPublicationItem(viewable)) return;
        const activeChunkMetadata = viewable.binderLog.current.find(c => c.position === activeChunkIndex);
        if (activeChunkMetadata == null) {
            throw new Error(`Active chunk index is ${activeChunkIndex} but there is no chunk with that index in the binder log of viewable with id ${viewable.id}`);
        }
        await createReaderComment({
            publicationId: viewable.id,
            binderId: viewable.binderId,
            chunkId: activeChunkMetadata.uuid,
            text: commentText
        });
        setCommentText(NO_COMMENT_TEXT);
        setIsFocused(false);
        onCommentAdded();
    };

    const stagedAttachments = useCommentStagedAttachments();
    const editedCommentId = useReaderCommentsStore(store => store.editedCommentId);
    const {
        clearStagedAttachmentsForNewComment,
        addFilesAsStagedAttachmentsForComment,
        removeStagedAttachmentForComment,
    } = useReaderCommentsStoreActions();
    const isDisabledOrLoading = disabled || isLoading;
    const isAnotherCommentEdited = useIsAnyCommentInEditMode();

    const cancelComment = () => {
        clearStagedAttachmentsForNewComment();
        setCommentText(NO_COMMENT_TEXT);
        setIsFocused(false);
    };

    const onSelectAttachments = async (e: React.SyntheticEvent) => {
        if (!isPublicationItem(viewable)) return;
        const files = e["dataTransfer"] ? e["dataTransfer"].files : e.target["files"];
        e.persist();
        try {
            const attachmentFiles = await fileListToFiles(files);
            if (!attachmentFiles.length) {
                return;
            }
            if (stagedAttachments.length + attachmentFiles.length > MAX_ATTACHMENTS_PER_COMMENT) {
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

            await addFilesAsStagedAttachmentsForComment(attachmentFiles);
        } catch (e) {
            if (e.name === UnsupportedMedia.NAME) {
                FlashMessageModule.FlashMessageActions.error(e.description || e.message);
            } else {
                throw e;
            }
        }
    };

    const savePageScrollOffset = () => {
        if (isSmartphone()) {
            setPageYOffset(window.pageYOffset);
        }
    }

    const restorePageScrollOffset = useCallback(() => {
        if (isSmartphone()) {
            setTimeout(() => window.scrollTo({ top: pageYOffset }), 100);
        }
    }, [pageYOffset]);

    useEffect(() => {
        if (!editedCommentId && !isFocused && stagedAttachments.length > 0) {
            textAreaRef.current.focus();
        }
    }, [editedCommentId, isFocused, stagedAttachments.length, textAreaRef]);

    // on mobile, we only expand the input in case of a draft, to save space for the comments list below (MT-4524)
    const commentInputIsExpanded = useMemo(() => isSmartphone() ? hasDraft : isFocused, [isFocused, hasDraft]);

    if (!isVisible) return <></>;

    return (
        <div className="commentInput" ref={writeRef}>
            <div className="commentInput-label commentInput-label--hiddenOnMobile">
                {t(TK.Comments_CreateReaderCommentLabel)}
            </div>
            <div className="commentInput-inputWrapper">
                {!disabled && (
                    <>
                        <div className="commentInput-textareaWrapper">
                            <textarea
                                className={cx(
                                    "commentInput-input",
                                    { "commentInput-input--narrow": isSmartphone()},
                                    { "commentInput-input--expanded": commentInputIsExpanded }
                                )}
                                ref={textAreaRef}
                                placeholder={isDisabledOrLoading ? "" : t(TK.Comments_CreateReaderCommentPlaceholder)}
                                onFocus={() => { setIsFocused(true); savePageScrollOffset(); }}
                                onBlur={restorePageScrollOffset}
                                onChange={e => setCommentText(e.target.value)}
                                disabled={isDisabledOrLoading}
                                onKeyUp={e => {
                                    if (e.key === "Enter" && e.ctrlKey) {
                                        sendComment();
                                    }
                                } }
                                value={commentText}
                                autoFocus={isSmartphone() && !isIPhone()}
                            />
                            {!isDisabledOrLoading && stagedAttachments.length > 0 && (
                                <div className="attachmentsList">
                                    <DraftAttachments
                                        attachments={stagedAttachments}
                                        isLoading={isLoading}
                                        onRemoveAttachment={removeStagedAttachmentForComment}
                                    />
                                </div>
                            )}
                        </div>
                        {shouldShowButtons && <div className="commentInput-actions">
                            {!isDisabledOrLoading && (
                                <>
                                    <div
                                        className={cx("commentInput-icon", { "commentInput-icon--disabled": isAnotherCommentEdited })}
                                        id="readerComments-addImage"
                                    >
                                        <label className="commentInput-attach" htmlFor="attachment-upload">
                                            <Icon
                                                name="attachment"
                                                style={{ fontSize: "20px" }}
                                            />
                                            <span className="commentInput-icon-text" aria-disabled={isAnotherCommentEdited}>{t(TK.Comments_AttachMedia)}</span>
                                        </label>
                                        <input
                                            type="file"
                                            id="attachment-upload"
                                            name="attachment-upload"
                                            accept={getAcceptVisualsString()}
                                            multiple
                                            style={{ display: "none" }}
                                            onChange={onSelectAttachments}
                                            disabled={isAnotherCommentEdited}
                                        />
                                    </div>
                                    <div className="commentInput-actions-buttons">
                                        <Button
                                            className={cx("commentInput-cancel")}
                                            onClick={cancelComment}
                                            text={t(TK.General_Cancel)}
                                            id="readerComments-cancelComment"
                                            isEnabled={isFocused}
                                            secondary={true}
                                        />
                                        <Button
                                            className={cx("commentInput-submit")}
                                            onClick={sendComment}
                                            text={t(TK.General_Send)}
                                            id="readerComments-submitComment"
                                            isEnabled={!!commentText && !isAnotherCommentEdited}
                                            CTA
                                        />
                                    </div>
                                </>
                            )}
                        </div>}
                        <div className="commentInput-icons">
                            {isLoading && circularProgress()}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
