import * as React from "react";
import { ActiveCollectionInfo, useBinderStoreActions } from "../../stores/zustand/binder-store";
import { EmptyCollection } from "./EmptyCollection";
import { IChecklistProgress } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { RouteComponentProps } from "react-router-dom";
import SmallestFontSizeWrapper from "../components/SmallestFontSizeWrapper";
import StoryItem from "./story-item";
import { StoryTile } from "../../binders/contract";
import cx from "classnames";
import { switchToLauncher } from "../../navigation";
import { useRibbonsBottomHeight } from "@binders/ui-kit/lib/compounds/ribbons/hooks";

interface IStoryListProps {
    storyTiles?: StoryTile[],
    router: RouteComponentProps,
    browserNavigation: React.JSX.Element;
    noLanguageDropdown?: boolean;
    activeCollectionInfo: ActiveCollectionInfo;
    checklistsProgress: IChecklistProgress[];
    showProgress: boolean;
}

const StoryList: React.FC<IStoryListProps> = ({
    storyTiles,
    router,
    browserNavigation,
    noLanguageDropdown,
    activeCollectionInfo,
    checklistsProgress,
    showProgress,
}) => {
    const ribbonsBottomHeight = useRibbonsBottomHeight();

    const { setLastBrowsedParentId } = useBinderStoreActions();

    const onClickStory = (storyTile: StoryTile) => {
        if (activeCollectionInfo) {
            setLastBrowsedParentId(activeCollectionInfo.id);
        }
        switchToLauncher(router.history, storyTile);
    };

    const calculateProgress = (storyTile: StoryTile) => {
        const binderId = storyTile.original?.id;
        const progress = binderId &&
            (checklistsProgress || []).find(p => p.binderId === binderId);
        return {
            progress: !progress ? undefined : (progress.performed / progress.total),
            lastUpdated: progress?.lastUpdated
        }
    };

    return (
        <div className="story-list-wrapper">
            {browserNavigation}
            <div
                className={storyListClassNames(storyTiles.length, noLanguageDropdown)}
                style={{
                    paddingBottom: ribbonsBottomHeight
                }}
            >
                <SmallestFontSizeWrapper totalItems={storyTiles.length}>
                    {
                        storyTiles.length === 0 ?
                            <EmptyCollection /> :
                            storyTiles.map((storyTile) => (
                                <StoryItem
                                    storyTile={storyTile}
                                    key={storyTile.key}
                                    onClickStory={onClickStory}
                                    checklistProgress={calculateProgress(storyTile)}
                                    showProgress={showProgress}
                                />
                            ))
                    }
                </SmallestFontSizeWrapper>
            </div>
        </div>
    );
};

const storyListClassNames = (storyTilesLength: number, noLanguageDropdown?: boolean) => {
    return cx(
        "story-list",
        "list",
        { "h-full": storyTilesLength === 0 },
        { "half-render": storyTilesLength > 3 && storyTilesLength <= 6 },
        { "full-render": storyTilesLength <= 3 },
        { "quarter-render": storyTilesLength > 6 },
        { "no-language-dropdown": noLanguageDropdown },
    );
};

export default StoryList;
