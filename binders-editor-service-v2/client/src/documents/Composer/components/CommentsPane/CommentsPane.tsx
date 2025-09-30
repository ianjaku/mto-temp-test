import * as React from "react";
import { CommentThreadOrigin, ExtendedCommentThread } from "@binders/client/lib/clients/commentservice/v1/contract";
import { Pane, Tabs } from "@binders/ui-kit/lib/elements/tabs";
import { invalidateCommentThreads, useCommentThreads } from "../../../hooks";
import { Application } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { CommentThread } from "./CommentThread";
import Icon from "@binders/ui-kit/lib/elements/icons";
import { NewCommentThread } from "./NewCommentThread";
import RefreshButton from "@binders/ui-kit/lib/elements/button/RefreshButton";
import { TK } from "@binders/client/lib/react/i18n/translations";
import { dateSorterDesc } from "@binders/client/lib/util/date";
import { resolveChunkIdsToShowCommentsFor } from "./util";
import { useCommentContext } from "./CommentContext";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./CommentsPane.styl";

export type CommentsPaneProps = {
    binderId: string;
    readerCommenting: boolean;
    editorCommenting: boolean;
}

export const CommentsPane: React.FC<CommentsPaneProps> = ({
    binderId,
    readerCommenting,
    editorCommenting,
}) => {
    const { t } = useTranslation();
    const { data: allThreads } = useCommentThreads(binderId);
    const { selectedChunkId, selectedLanguageCode, historicalChunkIds, selectedChunkIndex } = useCommentContext();
    const chunkIdsToShowCommentsFor = React.useMemo(() =>
        resolveChunkIdsToShowCommentsFor(allThreads, historicalChunkIds, selectedChunkId, selectedChunkIndex)
    , [allThreads, historicalChunkIds, selectedChunkId, selectedChunkIndex]);
    const chunkThreads = selectedChunkId && allThreads ?
        allThreads
            .filter(t => chunkIdsToShowCommentsFor.has(t.chunkId) && t.languageCode === selectedLanguageCode)
            .sort((a, b) => dateSorterDesc(new Date(a.updated ?? a.created), new Date(b.updated ?? b.created))) :
        [];
    const readerCommentThreads = chunkThreads.filter(t => t.origin === CommentThreadOrigin.Reader);
    const editorCommentThreads = chunkThreads.filter(t => t.origin === CommentThreadOrigin.Editor);
    const unresolvedReaderCount = readerCommentThreads.filter(t => !t.resolved).length;
    const unresolvedEditorCount = editorCommentThreads.filter(t => !t.resolved).length;

    return (
        <div className="pane-comments">
            <div className="pane-comments-refresh">
                <RefreshButton
                    onClick={() => invalidateCommentThreads(binderId)}
                    tooltip={t(TK.General_Refresh)}
                    color="var(--clr-neutral-300)"
                />
            </div>
            <Tabs>
                {editorCommenting && (
                    <Pane testId="comments-pane-label-editor" label={
                        unresolvedEditorCount > 0 ?
                            t(TK.Comments_Editor_SomeUnresolved, { count: unresolvedEditorCount }) :
                            t(TK.Comments_Editor)
                    }>
                        <div className="comment-threads-list">
                            {selectedChunkId ?
                                <CommentThreadsList threads={editorCommentThreads} app={Application.EDITOR} /> :
                                <NoChunkSelected />
                            }
                        </div>
                    </Pane>
                )}
                {readerCommenting && (
                    <Pane testId="comments-pane-label-reader" label={
                        unresolvedReaderCount > 0 ?
                            t(TK.Comments_Reader_SomeUnresolved, { count: unresolvedReaderCount }) :
                            t(TK.Comments_Reader)
                    }>
                        <div className="comment-threads-list">
                            {selectedChunkId ?
                                <CommentThreadsList threads={readerCommentThreads} app={Application.READER} /> :
                                <NoChunkSelected />
                            }
                        </div>
                    </Pane>
                )}
            </Tabs>
        </div>
    )
}

export type CommentThreadsListProps = {
    app: Application,
    threads: ExtendedCommentThread[];
}

const CommentThreadsList: React.FC<CommentThreadsListProps> = ({ app, threads }) => {
    const showNewCommentForm = app === Application.EDITOR;
    if (!threads.length) {
        return <EmptyComments showNewCommentForm={showNewCommentForm} />
    }
    const resolved = threads.filter(t => t.resolved);
    const unresolved = threads.filter(t => !t.resolved);
    return (
        <>
            {showNewCommentForm ? <NewCommentThread /> : null}
            {unresolved.map((ct, idx) => <CommentThread key={ct.id} thread={ct} isExpanded={idx === 0} app={app} />)}
            {resolved.map(ct => <CommentThread key={ct.id} thread={ct} app={app} />)}
        </>
    )
}

const EmptyComments: React.FC<{ showNewCommentForm?: boolean }> = ({ showNewCommentForm }) => {
    const { t } = useTranslation();
    return (
        <div className="comments-empty">
            {showNewCommentForm ? <NewCommentThread /> : <div />}
            <div className="comments-empty-graphic">
                <Icon name="comments" className="comments-empty-icon" />
                <p>{t(TK.Comments_NoComments)}</p>
            </div>
        </div>
    )
}

const NoChunkSelected: React.FC = () => {
    const { t } = useTranslation();
    return (
        <div className="comments-no-chunk-selected">
            <div className="chunk-mockup">
                <img
                    src="/assets/upload-square-gray.svg"
                    alt={t(TK.Comments_NoChunkSelected)}
                    style={{ pointerEvents: "none" }} // prevents selecting the img element itself on mobile/tablet
                />
                <div className="chunk-mockup-body">
                    <span />
                    <span />
                </div>
                <span className="fa fa-mouse-pointer" />
            </div>
            <p>{t(TK.Comments_NoChunkSelected)}</p>
        </div>
    )
}
