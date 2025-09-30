import * as React from "react";
import { FaIconFolderOpen } from "@binders/client/lib/react/icons/font-awesome";
import Image from "@binders/client/lib/react/image";
import ProgressBar from "@binders/ui-kit/lib/elements/progress-bar";
import { SmallestFontSizeContext } from "../components/SmallestFontSizeWrapper";
import { StoryItemTitleWrapper } from "./story-item-title-wrapper";
import { StoryTile } from "../../binders/contract";
import debounce from "lodash.debounce";
import { isMobileDevice } from "../../util";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const vars = require("../../vars.json")

interface IStoryItemProps {
    storyTile: StoryTile;
    onClickStory: (storyTile: StoryTile) => void;
    children?: React.ReactNode;
    checklistProgress?: { progress: number, lastUpdated: Date };
    showProgress?: boolean;
    searchTitle?: {
        languageCode: string;
        title: string;
    };
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface IStoryItemState {
}

class StoryItem extends React.Component<IStoryItemProps, IStoryItemState> {
    static contextType = SmallestFontSizeContext;

    private storyItemEl: HTMLElement;
    private titleRef: HTMLElement;
    private onResize: () => void;

    constructor(props: IStoryItemProps) {
        super(props);
        this.updateFontSize = this.updateFontSize.bind(this);
        this.onClickStory = this.onClickStory.bind(this);
    }

    componentDidMount(): void {
        this.updateFontSize();

        this.onResize = debounce(() => {
            this.updateFontSize();
        }, 250)
        window.addEventListener("resize", this.onResize)
    }

    componentWillUnmount(): void {
        window.removeEventListener("resize", this.onResize)
    }

    private trialTitleRender(width, trialFontSize, itemHeight, titleHtml) {
        // to measure actual width and height of text block we need to render it
        // Since the story-item will have different widths accross different resolutions, we use it
        // as a container of the trial text element so we can replicate all styles

        let fontSizeToTest = trialFontSize;
        let currentWidth = 0;
        let currentHeight = 0;

        const fakeStoryItem = this.storyItemEl.cloneNode(true) as HTMLElement;
        fakeStoryItem.style.visibility = "hidden";
        const fakeStoryInfo = fakeStoryItem.querySelector(".story-info") as HTMLElement;
        fakeStoryInfo.className = `${fakeStoryInfo.className} ${fakeStoryInfo.className}--fake-info`;
        fakeStoryInfo.innerHTML = ""; // removes all elements;
        fakeStoryInfo.style.maxWidth = `${width}px`;

        const fakeImageWrapper = fakeStoryItem.querySelector(".image-wrapper") as HTMLElement;
        fakeImageWrapper.style.width = `${itemHeight}px`;
        fakeImageWrapper.style.minWidth = `${itemHeight}px`;

        const fakeTitle = document.createElement("h2");
        fakeTitle.innerHTML = titleHtml;
        fakeTitle.className = "title";

        fakeStoryInfo.appendChild(fakeTitle);
        const storyList = this.storyItemEl.parentElement;
        storyList.appendChild(fakeStoryItem);
        fakeStoryItem.querySelector(".story-info-wrapper").appendChild(fakeStoryInfo);
        do {
            fakeTitle.style.fontSize = `${fontSizeToTest--}pt`;
            currentWidth = fakeTitle.offsetWidth;
            currentHeight = fakeTitle.offsetHeight;
        } while ((currentWidth >= fakeStoryInfo.clientWidth || currentHeight >= itemHeight) && (fontSizeToTest > 0));
        storyList.removeChild(fakeStoryItem);
        return fontSizeToTest;
    }

    private updateFontSize() {
        const { storyTile } = this.props;

        const titleVerticalPadding = 2 * vars.storyInfoVerticalPadding;
        const titleWidth = this.titleRef && this.titleRef.offsetWidth;
        const itemHeight = (this.storyItemEl && this.storyItemEl.offsetHeight) || 0;
        const itemWidth = (this.storyItemEl && this.storyItemEl.offsetWidth) || titleWidth;
        const textAreaWidth = itemWidth - itemHeight;

        const titleFontSize = this.titleRef && getComputedStyle(this.titleRef).fontSize;
        const trialFontSize = parseInt(titleFontSize, 10);

        const actualTitle = this.props?.searchTitle?.title ?? storyTile.title;

        const fontSize = this.trialTitleRender(
            textAreaWidth,
            trialFontSize,
            itemHeight - titleVerticalPadding,
            actualTitle,
        );

        this.context.onFinishCalculation(fontSize);
    }

    private renderDetails() {
        const { storyTile, children, showProgress, checklistProgress } = this.props;
        const { icon } = storyTile;
        const itemHeight = (this.storyItemEl && this.storyItemEl.offsetHeight - vars.storyInfoVerticalPadding) || 0;
        const titleHeight = this.titleRef && this.titleRef.offsetHeight;
        const progressWillBeViewed = showProgress && (checklistProgress !== undefined) && (checklistProgress.progress !== undefined);
        const shouldAddMarginTop = progressWillBeViewed &&
            !isNaN(itemHeight) &&
            !isNaN(titleHeight) &&
            (itemHeight - (2 * (isMobileDevice() ? vars.checklistPlaceholderHeightMobile : vars.checklistPlaceholderHeightDesktop)) < titleHeight);

        const marginTop = isMobileDevice() ? `${vars.checklistPlaceholderHeightMobile}px` : `${vars.checklistPlaceholderHeightDesktop}px`;

        const iconMarkup = !!icon && icon.includes("folder-open") ?
            <FaIconFolderOpen outline /> :
            <></>;

        return (
            <div className="story-info">
                <div className="story-info-flexHelperWrapper">
                    <span className="finder-icon">
                        {iconMarkup}
                    </span>
                    <StoryItemTitleWrapper
                        onRef={r => this.titleRef = r}
                        titleFontSize={this.context.titleFontSize}
                        showProgress={showProgress}
                        shouldAddMarginTop={shouldAddMarginTop}
                        marginTop={marginTop}
                        storyTile={storyTile}
                        smoothResize={!this.context.isFirstCalculation}
                        searchTitle={this.props.searchTitle}
                    />
                    {children}
                </div>
            </div>
        );
    }

    onKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
        if (e.key === "Enter") {
            this.onClickStory(e);
        }
    }

    render(): React.ReactNode {
        const { storyTile, checklistProgress, showProgress } = this.props;
        const progressWillBeViewed = showProgress && checklistProgress !== undefined && checklistProgress.progress !== undefined;
        return (
            <div
                className={`story-item ${showProgress ? "story-item--with-progress" : ""}`}
                onClick={this.onClickStory}
                ref={itm => this.storyItemEl = itm}
                tabIndex={0}
                onKeyDown={this.onKeyDown.bind(this)}
            >
                <Image
                    image={storyTile.thumbnail}
                    className="story-thumbnail"
                />
                <div className="story-info-wrapper">
                    {progressWillBeViewed && (
                        <ProgressBar
                            percentage={checklistProgress.progress}
                            lastUpdated={checklistProgress.lastUpdated}
                            height={10}
                            borderRadius={5}
                            width={150}
                        />
                    )}
                    {this.renderDetails()}
                </div>
            </div>
        );
    }

    private onClickStory(e: React.MouseEvent | React.KeyboardEvent): void {
        const { onClickStory, storyTile } = this.props;
        e.preventDefault();
        e.stopPropagation();
        onClickStory(storyTile);
    }
}

export default StoryItem;
