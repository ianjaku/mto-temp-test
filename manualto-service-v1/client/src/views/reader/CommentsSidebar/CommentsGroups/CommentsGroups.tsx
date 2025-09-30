import { CommentsGroup } from "../CommentsGroup/CommentsGroup";
import { CommentsListSummary } from "../CommentsList";
import { FC } from "react";
import NoFeedbackYet from "../NoFeedbackYet";
import React from "react";
import { ReaderComment } from "@binders/client/lib/clients/commentservice/v1/contract";
import cx from "classnames";
import { sum } from "ramda";
import "./CommentsGroups.styl";

export const CommentsGroups: FC<{
    chunkPositionById: Map<string, number>;
    commentsGroups: Array<{ chunkId: string, comments: ReaderComment[] }>;
    expandCommentsView: () => void;
}> = ({
    chunkPositionById,
    commentsGroups,
    expandCommentsView,
}) => {
    const allCommentsCount = sum(Object.values(commentsGroups).map(({ comments }) => comments.length))
    const isCollapsed = expandCommentsView != null
    const noComments = commentsGroups.length === 0;

    return (
        <div className={cx(
            "commentsGroupsList",
            { "commentsGroupsList--collapsed": isCollapsed },
        )}>
            {noComments && (
                <NoFeedbackYet/>
            )}
            {!noComments && isCollapsed && (
                <CommentsListSummary
                    numberOfComments={allCommentsCount}
                    expandView={expandCommentsView}
                />
            )}
            {!noComments && !isCollapsed && (
                commentsGroups.map(({ chunkId, comments }) => (
                    <CommentsGroup
                        key={chunkId}
                        chunkId={chunkId}
                        chunkPositionById={chunkPositionById}
                        comments={comments}
                    />
                ))
            )}
        </div>
    )
}
