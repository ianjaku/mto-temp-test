import { Comment } from "../Comment";
import React from "react";
import { ReaderComment } from "@binders/client/lib/clients/commentservice/v1/contract";
import { TK } from "@binders/client/lib/react/i18n/translations";
import { useActiveChunkId } from "../../../../stores/hooks/chunk-position-hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./CommentsList.styl";

export const CommentsListSummary: React.FC<{
    numberOfComments: number,
    expandView: () => void;
}> = ({ numberOfComments, expandView }) => {
    const { t } = useTranslation();
    const onClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        expandView();
    }
    return (
        <div className="commentsList-summary">
            {numberOfComments > 0 && <button
                className="commentsList-summary-button"
                onClick={onClick}
            >{t(TK.Comments_View)}</button>}
        </div>
    );
};

export const CommentsListDetailed: React.FC<{
    readerComments: ReaderComment[];
    scrollToCommentChunk: (comment: ReaderComment) => void;
}> = ({
    readerComments,
    scrollToCommentChunk,
}) => {
    const activeChunkId = useActiveChunkId();
    return (
        <div className="commentsList-detailed">
            {readerComments.map(comment => (
                <Comment
                    key={comment.commentId}
                    comment={comment}
                    onSelect={() => scrollToCommentChunk(comment)}
                    selected={comment.chunkId === activeChunkId}
                />
            ))}
        </div>
    );
};
