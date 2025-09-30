import * as React from "react";
import { useTTSHighlighter } from "../../tts/use_tts_highlighter";

const { useMemo } = React;

export const StoryItemTitle: React.FC<{
    onRef: (el: HTMLElement) => void;
    contentIdentifier: string;
    title: string;
    titleFontSize: number;
    showProgress: boolean;
    shouldAddMarginTop: boolean;
    marginTop: string;
    smoothResize?: boolean;
}> = ({
    onRef,
    contentIdentifier,
    title,
    titleFontSize,
    showProgress,
    shouldAddMarginTop,
    marginTop,
    smoothResize,
}) => {
    const highlighter = useTTSHighlighter();
    const highlightedTitle = useMemo(() => {
        return highlighter(contentIdentifier, title);
    }, [title, contentIdentifier, highlighter]);

    return (
        <h2
            ref={r => onRef(r)}
            className={`title ${title !== highlightedTitle ? "hide-search-hit" : ""} ${smoothResize ? "smooth-resize" : ""}`}
            style={{
                fontSize: `${titleFontSize}pt`,
                paddingBottom: showProgress ? "0px" : undefined,
                marginTop: shouldAddMarginTop ? marginTop : "0px",
                alignSelf: shouldAddMarginTop ? "flex-start" : "auto",
            }}
            dangerouslySetInnerHTML={{__html: highlightedTitle}}
        >
        </h2>
    );
};
