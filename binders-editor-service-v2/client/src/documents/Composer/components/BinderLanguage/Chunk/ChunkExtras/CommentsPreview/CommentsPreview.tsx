import * as React from "react";
import { FC } from "react";
import { IChunkCurrentPositionLog } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import Icon from "@binders/ui-kit/lib/elements/icons";
import { NavigationDrawerPaneItem } from "../../../../NavigationDrawer";
import { TK } from "@binders/client/lib/react/i18n/translations";
import { resolveChunkIdsToShowCommentsFor } from "../../../../CommentsPane";
import { useCommentThreads } from "../../../../../../hooks";
import { useComposerContext } from "../../../../../contexts/composerContext";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./CommentsPreview.styl";

export const ChunkCommentsPreview: FC<{
    binderId: string;
    chunkCurrentPositionLog: IChunkCurrentPositionLog;
    chunkIndex: number;
    chunkId: string;
    languageCode: string;
    selectChunk: () => void;
}> = ({ binderId, chunkCurrentPositionLog, chunkId, chunkIndex, languageCode, selectChunk }) => {
    const { t } = useTranslation();
    const composerContext = useComposerContext();
    const { data: allThreads, isLoading } = useCommentThreads(binderId);

    const chunkIdsToShowCommentsFor = React.useMemo(() => {
        const historicalChunkIds = new Set(chunkCurrentPositionLog?.targetId ?? []);
        return resolveChunkIdsToShowCommentsFor(allThreads, historicalChunkIds, chunkId, chunkIndex);
    }, [chunkCurrentPositionLog, chunkId, allThreads, chunkIndex]);

    const threads = React.useMemo(() => {
        if (allThreads == null) return [];
        return allThreads.filter(ct => chunkIdsToShowCommentsFor.has(ct.chunkId) && ct.languageCode === languageCode);
    }, [allThreads, languageCode, chunkIdsToShowCommentsFor]);
    const resolvedCount = React.useMemo(() => threads.filter(t => t.resolved).length, [threads]);
    const unresolvedCount = threads.length - resolvedCount;

    const openCommentsInSidebar = () => {
        selectChunk();
        composerContext.setNavigationDrawerItem(NavigationDrawerPaneItem.CommentsPane);
    }

    if (isLoading) return null;
    if (!threads.length) return null;
    return (
        <div className="chunkCommentsPreview" onClick={openCommentsInSidebar}>
            <Icon name="comment" className="chunkCommentsPreview-icon" />
            {resolvedCount} {t(TK.Edit_CommentResolved)}
            {unresolvedCount !== 0 && (
                <span className="chunkCommentsPreview-unresolved">
                    ({unresolvedCount} {t(TK.Edit_CommentUnresolved)})
                </span>
            )}
        </div>
    );
}
