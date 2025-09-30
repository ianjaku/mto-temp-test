import React, { useEffect, useMemo, useRef, useState } from "react";
import { ascend, descend, groupBy, sort } from "ramda";
import {
    isBinderItem,
    isPublicationItem
} from "@binders/client/lib/clients/repositoryservice/v3/validation";
import {
    useIsAnyCommentInEditMode,
    useReaderCommentsStoreActions
} from "../../../stores/zustand/readerComments-store";
import CircleButton from "../../components/CircleButton";
import { CommentInput } from "./CommentInput";
import { CommentsGroups } from "./CommentsGroups";
import { LoadingComments } from "./LoadingComments";
import { ModalProps } from "@binders/ui-kit/lib/compounds/modals/ModalViewProvider";
import { ORPHANED_COMMENT } from "./constants";
import { isSmartphone } from "@binders/client/lib/util/browsers";
import { scrollToChildElement } from "./scroll";
import { useActiveChunkId } from "../../../stores/hooks/chunk-position-hooks";
import { useActiveViewable } from "../../../stores/hooks/binder-hooks";
import { useIntelligentActiveChunkPadding } from "./useIntelligentActiveChunkPadding";
import { useOutsideClick } from "@binders/client/lib/react/helpers/useOutsideClick";
import { usePrevious } from "@binders/client/lib/react/helpers/hooks";
import { useReaderComments } from "../../../stores/hooks/comment-hooks";
import { useResizeObserver } from "@binders/client/lib/react/hooks/useResizeObserver";
import { useSlidingModal } from "@binders/ui-kit/lib/hooks/useSlidingModal";
import { useTextModuleStoreActions } from "../../../stores/zustand/text-module-store";
import "./CommentsSidebar.styl";

export const COMMENTS_SIDEBAR_ID = "comments-sidebar";

export const CommentsSidebar: React.FC<ModalProps<unknown, unknown>> = ({ hide: hideFn }) => {
    const viewable = useActiveViewable();
    const activeChunkId = useActiveChunkId();
    const previousActiveChunkId = usePrevious(activeChunkId);
    const binderId = isBinderItem(viewable) ? viewable.id : viewable?.binderId;
    const { isLoading, data: comments } = useReaderComments(binderId);
    const { setShouldIgnoreScroll, setSidebarWidth } = useTextModuleStoreActions();

    const chunkPositionById = useMemo(
        () => isPublicationItem(viewable) ?
            viewable.binderLog?.current
                .reduce((byId, { uuid }, idx) => byId.set(uuid, idx), new Map<string, number>()) :
            new Map<string, number>(),
        [viewable],
    );
    const sortedReaderCommentsGroups = useMemo(() => {
        if (!Array.isArray(comments)) return [];
        const commentsByChunkId = groupBy(comment => comment.chunkId, comments)
        return Object.entries(commentsByChunkId)
            .map(([chunkId, comments]) => {
                const chunkPresent = viewable.binderLog?.current.some(entry => entry.uuid === chunkId);
                return {
                    chunkId: chunkPresent ? chunkId : ORPHANED_COMMENT,
                    comments: sort(descend(comment => comment.created.getTime()), comments),
                }
            })
            .sort(ascend(({ chunkId }) => chunkPositionById.get(chunkId) ?? 0))
            .sort(ascend(({ chunkId }) => chunkId === ORPHANED_COMMENT ? 1 : 0))
    }, [chunkPositionById, comments, viewable]);
    const [commentInputIsFocused, setCommentInputIsFocused] = useState(false);
    const [collapsedCommentsView, setCollapsedCommentsView] = useState(isSmartphone());
    const { discardAllStagedChanges } = useReaderCommentsStoreActions();
    const isAnyCommentInEditMode = useIsAnyCommentInEditMode();
    const sidebarRef = useRef<HTMLDivElement>(null);

    const contentRef = useOutsideClick<HTMLDivElement>(() => {
        if (isSmartphone() && !commentInputIsFocused) {
            hide();
        }
    });

    const hide = () => {
        discardAllStagedChanges();
        hideFn();
        closeModal(false);
    };

    const { closeModal } = useSlidingModal({
        modalRef: contentRef,
        onClose: hide,
        focusableSelectors: "input, textarea, button, a, div.button, label",
        cancelableSelectors: "div.commentsGroupsList",
    });

    useResizeObserver(
        sidebarRef,
        (newDimensions) => {
            setSidebarWidth(newDimensions.widthPx);
        }
    );

    useEffect(() => {
        if (previousActiveChunkId !== activeChunkId) {
            scrollToChildElement("commentsGroupsList", `commentsGroup-${activeChunkId}`);
        }
    }, [activeChunkId, previousActiveChunkId]);

    useEffect(() => {
        setShouldIgnoreScroll(isSmartphone() && collapsedCommentsView);
        return () => {
            setShouldIgnoreScroll(false);
        }
    }, [collapsedCommentsView, setShouldIgnoreScroll])

    useEffect(() => {
        if (!isSmartphone()) return;
        const bodyOverFlowValue = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = bodyOverFlowValue;
        }
    }, []);

    useIntelligentActiveChunkPadding();

    const onCommentAdded = () => setCollapsedCommentsView(false);
    const expandCommentsView = collapsedCommentsView ?
        () => setCollapsedCommentsView(false) :
        undefined;

    return (
        <>
            <div className="commentsSidebar-outside"></div>
            <div className="commentsSidebar" ref={sidebarRef}>
                <CircleButton
                    materialIcon="close"
                    onSelect={hide}
                    className="commentsSidebar-closeButton"
                />
                <div
                    className="commentsSidebar-content"
                    ref={contentRef}
                >
                    <div className="commentsSidebar-dragHandle">
                        <span></span>
                    </div>
                    {isLoading ?
                        <LoadingComments /> :
                        <>
                            <CommentInput
                                onCommentAdded={onCommentAdded}
                                hideButtonsUntilSelected={isSmartphone()}
                                isFocused={commentInputIsFocused}
                                isVisible={!isSmartphone() || !isAnyCommentInEditMode}
                                setIsFocused={setCommentInputIsFocused}
                            />
                            <CommentsGroups
                                chunkPositionById={chunkPositionById}
                                commentsGroups={sortedReaderCommentsGroups}
                                expandCommentsView={expandCommentsView}
                            />
                        </>
                    }
                </div>
            </div>
        </>
    );
}
