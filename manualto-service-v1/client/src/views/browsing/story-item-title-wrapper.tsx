import * as React from "react";
import { FEATURE_BROWSE_VIEW_TTS_SUPPORT } from "@binders/client/lib/clients/accountservice/v1/contract";
import { PlayButton } from "../../tts/play_button/play_button";
import { StoryItemTitle } from "./story-item-title";
import { StoryTile } from "../../binders/contract";
import { createStoryTileIdentifier } from "../../tts/identifiers";
import { useActiveAccountFeatures } from "../../stores/hooks/account-hooks";
import { useMemo } from "react";

export const StoryItemTitleWrapper: React.FC<{
    onRef: (el: HTMLElement) => void;
    titleFontSize: number;
    showProgress: boolean;
    shouldAddMarginTop: boolean;
    marginTop: string;
    storyTile: StoryTile;
    smoothResize?: boolean;
    searchTitle?: { title: string; languageCode: string };
}> = ({
    onRef,
    titleFontSize,
    showProgress,
    shouldAddMarginTop,
    marginTop,
    storyTile,
    smoothResize,
    searchTitle
}) => {
    const features = useActiveAccountFeatures();
    const shouldDisplayTtsButton = features.includes(FEATURE_BROWSE_VIEW_TTS_SUPPORT);

    const contentIdentifier = useMemo(
        () => createStoryTileIdentifier(storyTile),
        [storyTile]
    );

    const title = useMemo(
        () => searchTitle?.title ?? storyTile.title,
        [searchTitle, storyTile]
    );

    const languageCode = useMemo(() => {
        return searchTitle?.languageCode ?? storyTile.languageCode ?? "xx";
    }, [searchTitle, storyTile]);
    
    return (
        <div className="title-wrapper">
            <div className="inline-play-button">
                {shouldDisplayTtsButton && <PlayButton
                    identifier={contentIdentifier}
                    html={title}
                    language={languageCode}
                />}
            </div>
            <StoryItemTitle
                onRef={onRef}
                contentIdentifier={contentIdentifier}
                title={title}
                titleFontSize={titleFontSize}
                showProgress={showProgress}
                shouldAddMarginTop={shouldAddMarginTop}
                marginTop={marginTop}
                smoothResize={smoothResize}
            />
        </div>
    )
}
