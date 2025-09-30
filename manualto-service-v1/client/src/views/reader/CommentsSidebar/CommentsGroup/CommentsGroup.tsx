import * as React from "react";
import { CommentsListDetailed } from "../CommentsList";
import { FC } from "react";
import { ORPHANED_COMMENT } from "../constants";
import { ReaderComment } from "@binders/client/lib/clients/commentservice/v1/contract";
import cx from "classnames";
import { scrollToChunkIndex } from "../scroll";
import { useActiveChunkId } from "../../../../stores/hooks/chunk-position-hooks";
import { useChunkNumberOffset } from "../../modules/text/ChunkNumber/hooks";
import { useIsLandscape } from "../../../../stores/hooks/orientation-hooks";
import "./CommentsGroup.styl";

export const CommentsGroup: FC<{
    chunkId: string;
    chunkPositionById: Map<string, number>;
    comments: ReaderComment[];
}> = (props) => {
    const activeChunkId = useActiveChunkId();
    const isLandscape = useIsLandscape();
    const chunkNumberOffset = useChunkNumberOffset();

    const scrollToCommentChunk = (comment: ReaderComment) => {
        if (comment.chunkId === ORPHANED_COMMENT) {
            return;
        }
        scrollToChunkIndex(props.chunkPositionById.get(comment.chunkId), isLandscape);
    };

    return (
        <div key={props.chunkId} className={cx(
            "commentsGroup",
            `commentsGroup-${props.chunkId}`,
            "transition-colors",
            { "commentsGroup--selected": props.chunkId === activeChunkId },
        )}>
            <div className={cx(
                "commentsGroup-chunk-index",
                "transition-colors",
            )}>
                {props.chunkId !== ORPHANED_COMMENT && (props.chunkPositionById.get(props.chunkId) + chunkNumberOffset ?? 0)}
            </div>
            <div className="commentsList">
                <CommentsListDetailed
                    readerComments={props.comments}
                    scrollToCommentChunk={scrollToCommentChunk}
                />
            </div>
        </div>
    )
}
