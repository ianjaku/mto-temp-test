import * as React from "react";
import { FC, ReactNode, useMemo } from "react";
import { adjustToPixelRatio, backToPixelValue } from "./Paragraph";
import { isLandscape, isPortrait } from "../../../../utils/viewport";
import {
    useActiveChunkPaddingRight,
    useTextModuleStoreActions
} from "../../../../stores/zustand/text-module-store";
import { useEffect, useRef } from "react";
import { ChecklistChunkPart } from "./ChecklistChunkPart";
import { ContentChunkKind } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { ContentChunkProps } from "./types";
import { DEFAULT_BOTTOM_PADDING_CHUNK_CONTENT_VH } from "./constants";
import { FeedbackChunkPart } from "./FeedbackChunkPart";
import { HtmlChunkPart } from "./HtmlChunkPart";
import { ReadConfirmationChunkPart } from "./ReadConfirmationChunkPart/ReadConfirmationChunkPart";
import { TitleChunkPart } from "./TitleChunkPart";
import { isPreviewPath } from "../../../../util";
import { useCurrentUser } from "../../../../stores/hooks/user-hooks";
import "./ContentChunk.styl";

export const ContentChunk: FC<ContentChunkProps> = (props) => {
    const {
        chunkIndex,
        imageViewportDims,
        kind = ContentChunkKind.Html,
        isActive,
        isLastChunk,
        onMouseDown,
    } = props;

    const isVerticallyCentered = chunkIndex === 0;
    const activeChunkPaddingRight = useActiveChunkPaddingRight();

    const availableTextSpace = useMemo(() => {
        const landscape = isLandscape();
        const windowInnerHeightPxRatio = adjustToPixelRatio(window.innerHeight);
        return landscape ?
            windowInnerHeightPxRatio :
            (windowInnerHeightPxRatio - imageViewportDims.height || 0);
    }, [imageViewportDims.height]);

    const chunkContentTopPadding = useMemo(() => {
        if (isVerticallyCentered) {
            return "0";
        }
        return isLandscape() ? "12vh" : "6vh";
    }, [isVerticallyCentered]);

    const chunkContentBottomPadding = useMemo(() => {
        const isUserContentChunk = [ContentChunkKind.Html, ContentChunkKind.TitleChunk].includes(kind);
        return isPortrait() && isLastChunk && isUserContentChunk ?
            `${backToPixelValue(availableTextSpace * .75)}px` :
            `${DEFAULT_BOTTOM_PADDING_CHUNK_CONTENT_VH}vh`;
    }, [availableTextSpace, isLastChunk, kind]);

    const user = useCurrentUser();

    let chunkMarkup: ReactNode;
    switch (kind) {
        case ContentChunkKind.Html:
        case ContentChunkKind.MadeByManualTo:
            chunkMarkup = (
                <HtmlChunkPart {...props} />
            );
            break;
        case ContentChunkKind.Checklist:
            chunkMarkup = (
                <>
                    <HtmlChunkPart {...props} />
                    <ChecklistChunkPart {...props} />
                </>
            );
            break;
        case ContentChunkKind.Feedback:
            chunkMarkup = (
                <>
                    <FeedbackChunkPart {...props} />
                </>
            );
            break;
        case ContentChunkKind.Hidden:
            chunkMarkup = null;
            break;
        case ContentChunkKind.TitleChunk:
            chunkMarkup = (
                <TitleChunkPart {...props} />
            );
            break;
        case ContentChunkKind.ReadConfirmation:
            chunkMarkup = user && !isPreviewPath(window.location.pathname) ?
                (
                    <ReadConfirmationChunkPart {...props} />
                ) :
                null;
            break;
    }

    const activeClass = `chunk ${isActive ? "active" : "inactive"}`;

    const textModuleStoreActions = useTextModuleStoreActions();
    const chunkRef = useRef<HTMLDivElement>();

    useEffect(() => {
        if (isActive) {
            textModuleStoreActions.setActiveChunkElement(chunkRef.current);
        }
    }, [isActive, textModuleStoreActions]);

    return (
        <div
            key={chunkIndex}
            className={activeClass}
            onMouseDown={onMouseDown}
            style={{
                ...(isActive ? { paddingRight: activeChunkPaddingRight } : {}),
            }}
            ref={chunkRef}
        >
            <div
                className="chunk-content"
                style={{
                    paddingTop: chunkContentTopPadding,
                    paddingBottom: chunkContentBottomPadding,
                }}
            >
                {chunkMarkup}
            </div>
        </div>
    )
}

