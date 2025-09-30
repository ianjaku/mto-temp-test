import * as React from "react";
import * as ReactDOM from "react-dom";
import {
    DEFAULT_BOTTOM_PADDING_CHUNK_CONTENT_VH,
    DEFAULT_FONTSIZE_PX,
    INTERACTIVE_ELEMENT_TAGNAMES,
    INTERACTIVE_TEXTMODULE_ELEMENT_CLASSNAMES,
    KEYBOARD_KEYS,
    SCROLL_OFFSET,
    SIZE_HINTS
} from "./constants";
import { IBinderLog, IChecklist } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { TFunction, withTranslation } from "@binders/client/lib/react/i18n";
import { UseChecklist, useChecklist } from "./useChecklist";
import {
    animateToChunk,
    calculateNewFontSize,
    findScrollTarget,
    getChunkElements,
    getElementPosition,
    getMinPadding,
    getParagraphFontSize,
    scrollDownCurrentChunk,
    scrollUpCurrentChunk,
    transformListsStyles
} from "./utils";
import { ActiveDocument } from "../../../../stores/zustand/binder-store";
import { ChunkNumber } from "./ChunkNumber";
import { ContentChunk } from "./ContentChunk";
import { IDims } from "@binders/client/lib/clients/imageservice/v1/contract";
import { ScrollDirection } from "./types";
import { ScrollHint } from "../../ScrollHint";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import { UseScrollHint } from "../../ScrollHint/useScrollHint";
import autobind from "class-autobind";
import { findClosest } from "../../../../utils/boundaries";
import { isLanguageRTL } from "@binders/client/lib/languages/helper";
import { originalToDeviceDimension } from "../../../../utils/viewport";
import twemoji from "twemoji";
import { useChecklistStoreActions } from "../../../../stores/zustand/checklist-store";
import { useHasOpenModal } from "@binders/ui-kit/lib/compounds/modals/ModalViewProvider";
import { useScrollHintFromContext } from "../../ScrollHint/ScrollHintContext";
import { useShouldIgnoreScroll, } from "../../../../stores/zustand/text-module-store";
import vars from "../../../../vars.json";
import { withHooks } from "@binders/client/lib/react/hooks/withHooks";
import "./text.styl";

type UseHasOpenModal = { hasOpenModal: boolean };
type UseTextModuleStore = { shouldIgnoreScroll?: boolean };
type UseChecklistStoreActions = { loadChecklists: (ch: IChecklist[]) => void }
type UseScrollHintContext = { scrollHint: UseScrollHint };

type ITextModuleProps = UseChecklist & UseChecklistStoreActions & UseHasOpenModal & UseTextModuleStore & UseScrollHintContext & {
    accountId: string;
    activeLanguageCode: string;
    binderId: string;
    binderLog: IBinderLog;
    checklistProgressBlock: boolean;
    checklists: IChecklist[];
    chunks: string[][];
    chunksImages: string[][];
    fontFamily?: string;
    fontSizeHint?: keyof typeof SIZE_HINTS;
    imageViewportDims: IDims;
    isLandscape: boolean;
    onChunkChange: (closest: number, newClosest: number) => void;
    onScrollUp: () => void;
    previewChunk: number;
    t: TFunction;
    translatedLanguage: string;
    translatedTitle: string;
    translations: string[];
    userId: string;
    viewable: ActiveDocument;
    waitingForResize: boolean;
    mediaModuleTailslotRef?: HTMLDivElement;
}

interface ITextModuleState {
    allowPinching: boolean,
    fontSize: string;
    fontSizeFactor: number;
    ignoreScrolling: boolean,
    initialFontSizeFactor: number;
    languageChange: boolean,
    positionX?: number;
    positionY?: number;
    preview: boolean,
    previewFontSizeFactor: number;
    previousScale: number,
    scrollTo: number,
    selection?: string;
    showTextSelectionOptions: boolean;
    textModuleHeight: number;
    textVisibility?: "hidden" | "visible",
    timeKeeper?: NodeJS.Timeout;
    windowWidth?: number,
}

class TextModule extends React.Component<ITextModuleProps, ITextModuleState> {
    private textModule: HTMLDivElement;
    private lastScrollTop: number;
    private doubleClickTimeoutId: NodeJS.Timeout;

    constructor(props: ITextModuleProps) {
        super(props);
        this.state = {
            allowPinching: true,
            fontSize: "",
            fontSizeFactor: 1,
            ignoreScrolling: false,
            initialFontSizeFactor: 1,
            languageChange: false,
            preview: false,
            previewFontSizeFactor: 1,
            previousScale: 1,
            scrollTo: 0,
            selection: null,
            showTextSelectionOptions: false,
            textModuleHeight: 0,
            textVisibility: undefined,
            timeKeeper: null,
            windowWidth: undefined,
        };
        autobind(this, TextModule.prototype);
        document.addEventListener("keydown", this.keyNavigationPressed);
    }

    componentDidMount() {
        const { fontSizeHint, previewChunk, setTextModuleRef } = this.props;
        document.addEventListener("keydown", this.onKeyboardDown);
        this.setState({
            previewFontSizeFactor: SIZE_HINTS[fontSizeHint] || 1,
            fontSizeFactor: SIZE_HINTS[fontSizeHint] || 1,
            initialFontSizeFactor: SIZE_HINTS[fontSizeHint] || 1,
            fontSize: `${DEFAULT_FONTSIZE_PX}px`,
        });
        this.adaptFontSizeToResolution();
        window.addEventListener("scroll", this._onScroll);
        twemoji.parse(this.textModule, {
            ext: ".svg",
            folder: "svg",
            base: "/assets/",
        });
        if (previewChunk > 0) {
            // arbitrary timeout value
            setTimeout(() => this.snapToChunk(previewChunk), 523);
        }
        // to be sure, even if imageVieport dimensions are not specified, we show the text after 1 second
        setTimeout(() => this.setState({ textVisibility: "visible" }), 1000);

        setTextModuleRef(this.getElement() as HTMLElement);
    }

    componentDidUpdate(prevProps: ITextModuleProps, prevState: ITextModuleState) {
        const { isLandscape, recalculateBoundariesMap, translations } = this.props;
        const { fontSizeFactor, languageChange, textModuleHeight: currentTextModuleHeight, windowWidth } = this.state;
        const { translations: prevTranslations } = prevProps;
        const { fontSizeFactor: prevFontSizeFactor } = prevState;

        if (translations !== prevTranslations) {
            twemoji.parse(this.textModule, {
                ext: ".svg",
                folder: "svg",
                base: "/assets/",
            });
        }

        if (window.innerWidth !== windowWidth || fontSizeFactor !== prevFontSizeFactor) {
            this.adaptFontSizeToResolution();
        }

        let languageStateUpdate = {};
        if (languageChange) {
            this.snapToChunk();
            languageStateUpdate = { languageChange: false }
        }

        let textModuleStateUpdate = {};
        const newTextModuleHeight = this.textModule.clientHeight;
        if (newTextModuleHeight !== currentTextModuleHeight) {
            textModuleStateUpdate = { textModuleHeight: newTextModuleHeight }
        }

        const stateUpdate = {
            ...languageStateUpdate,
            ...textModuleStateUpdate,
        };

        if (Object.keys(stateUpdate).length > 0) {
            this.setState({ ...stateUpdate });
            recalculateBoundariesMap(isLandscape);
        }

    }

    UNSAFE_componentWillReceiveProps(nextProps: ITextModuleProps) {
        if (nextProps.isLandscape !== this.props.isLandscape) {
            this.snapToChunk();
        }
        if (nextProps.activeLanguageCode !== this.props.activeLanguageCode) {
            this.setState({ languageChange: true });
        }
        // When we finally had a resize, snap to chunk.
        if (nextProps.waitingForResize === false && this.props.waitingForResize === true) {
            this.snapToChunk();
        }
    }

    componentWillUnmount() {
        document.removeEventListener("keydown", this.onKeyboardDown);
        document.removeEventListener("keydown", this.keyNavigationPressed);
        window.removeEventListener("scroll", this._onScroll);
        this.props.hideBlockProgressWarning();
        this.props.loadChecklists([])
    }

    getElement() {
        return ReactDOM.findDOMNode(this);
    }

    getChunkElements() {
        const el = this.getElement();
        return getChunkElements(el);
    }

    adaptFontSizeToResolution() {
        const { fontSizeFactor } = this.state;
        const windowWidth = window.innerWidth;
        const fontSizeBase = windowWidth > vars.xlVal ? "1.17vw" : `${DEFAULT_FONTSIZE_PX}px`;
        const fontSize = `calc(${fontSizeBase} * ${fontSizeFactor})`;
        this.setState({ windowWidth, fontSize });
    }

    onKeyboardDown(e: KeyboardEvent) {
        const { scrollTo } = this.state;
        if (this.shouldSwallowKeyboardEvent()) {
            return;
        }

        if (e.code === "ArrowDown") {
            const max = Math.max(0, scrollTo + SCROLL_OFFSET);
            this.textModule.scrollTop = max;
            this.setState({ scrollTo: max });
        }
        if (e.code === "ArrowUp") {
            const min = Math.max(scrollTo - SCROLL_OFFSET, 0);
            this.textModule.scrollTop = min;
            this.setState({ scrollTo: min });
        }
    }

    async snapToChunk(previewChunkIndex?: number) {
        const { closest, isLandscape } = this.props;
        const chunkIndex = previewChunkIndex || closest;
        const chunkElements = this.getChunkElements();
        const chunk = chunkElements[Math.min(chunkElements.length - 1, chunkIndex)];
        // because it scrolled the container and gave a feeling text is jumping
        if (chunk && chunkIndex > 0) {
            const targetScrollTop = findScrollTarget(chunk as HTMLElement, isLandscape, ScrollDirection.Down);
            window.scrollTo(0, targetScrollTop);
        }
    }

    _onScroll(evt: Event) {
        const {
            blockScroll,
            boundariesMap,
            closest,
            hideBlockProgressWarning,
            isLandscape,
            recalculateBoundariesMap,
            shouldIgnoreScroll,
            onScrollUp,
            onChunkChange,
            setClosest,
        } = this.props;
        const { ignoreScrolling } = this.state;
        const scrollTop = window.pageYOffset;
        if (shouldIgnoreScroll || ignoreScrolling) {
            evt.preventDefault();
            evt.stopPropagation();
            return false;
        }
        this.setState({ showTextSelectionOptions: false });
        if (this.lastScrollTop > scrollTop) {
            onScrollUp?.();
        }
        this.lastScrollTop = scrollTop;

        const atTheBottom = (window.innerHeight + Math.ceil(window.pageYOffset)) >= document.body.offsetHeight;

        if (blockScroll(atTheBottom)) return;

        const newClosest = findClosest(isLandscape, boundariesMap);

        const updateClosest = (closest: number, newClosest: number) => {
            hideBlockProgressWarning();
            onChunkChange?.(closest, newClosest);
            recalculateBoundariesMap(isLandscape);
            setClosest(newClosest);
        }

        if (newClosest !== closest) {
            updateClosest(closest, newClosest);
        }
    }

    shouldSwallowKeyboardEvent() {
        const focused = document.activeElement;
        const isTextInputContext = focused && INTERACTIVE_ELEMENT_TAGNAMES.includes(focused.tagName);
        return isTextInputContext;
    }

    shouldSwallowMouseEvent(evt: React.MouseEvent<HTMLDivElement, MouseEvent>) {
        if (!evt.target) {
            return false;
        }
        return INTERACTIVE_TEXTMODULE_ELEMENT_CLASSNAMES.some(
            className => (evt.target as Element).closest(`.${className}`) != null
        )
    }

    _onClick(evt: React.MouseEvent<HTMLDivElement, MouseEvent>) {
        const { chunks, closest, isLandscape, imageViewportDims } = this.props;
        const { showTextSelectionOptions } = this.state;
        const isDoubleClick = (evt.detail === 2);
        if (this.shouldSwallowMouseEvent(evt)) {
            return;
        }
        if (isDoubleClick) {
            clearTimeout(this.doubleClickTimeoutId);
            return;
        }
        const isLink = evt.currentTarget.closest("a");
        const scrollToNextChunkFed = this.scrollToNextChunk.bind(
            this,
            isLink,
            showTextSelectionOptions,
            chunks,
            closest,
            isLandscape,
            imageViewportDims
        );
        this.doubleClickTimeoutId = setTimeout(scrollToNextChunkFed, 300);
    }

    scrollToNextChunk(isLink: boolean, showTextSelectionOptions: boolean, chunks: string[][], closest: number, isLandscape: boolean, imageViewportDims: IDims) {
        const { blockNextChunkScroll, boundariesMap } = this.props;
        if (isLink || showTextSelectionOptions) {
            return;
        }
        document.removeEventListener("keydown", this.onKeyboardDown);

        if (blockNextChunkScroll()) return;

        const chunksHtmlElements = this.getChunkElements();
        const textModuleHeight = isLandscape ? window.innerHeight : window.innerHeight - originalToDeviceDimension(imageViewportDims.height);

        const factor = (100 - DEFAULT_BOTTOM_PADDING_CHUNK_CONTENT_VH) / 100;

        if (factor * chunksHtmlElements[closest].clientHeight > textModuleHeight) {
            // we have chunk bigger than text available space
            const currentScrollTopPosition = window.pageYOffset + 5;
            const halfTextSpace = 0.5 * textModuleHeight;
            // take chunk-html height, no margins
            const textHeight = chunksHtmlElements[closest].children[0].clientHeight;
            const scrollStop = boundariesMap[closest][0] + textHeight - halfTextSpace;
            // check if we can still scroll big chunk
            if (currentScrollTopPosition < scrollStop) {
                return scrollDownCurrentChunk(textModuleHeight, scrollStop);
            }
        }

        if (closest + 1 < chunks.length) {
            const chunk = this.getChunkElements()[closest + 1];
            animateToChunk(chunk, isLandscape);
        }
    }

    scrollToPreviousChunk(isLink: boolean, showTextSelectionOptions: boolean, closest: number, isLandscape: boolean, imageViewportDims: IDims) {
        const { boundariesMap } = this.props;
        if (isLink || showTextSelectionOptions) {
            return;
        }
        document.removeEventListener("keydown", this.onKeyboardDown);
        const chunksHtmlElements = this.getChunkElements();
        const textModuleHeight = isLandscape ? window.innerHeight : window.innerHeight - originalToDeviceDimension(imageViewportDims.height);

        const currentHigher = chunksHtmlElements[closest].clientHeight > textModuleHeight
        const previousHigher = closest - 1 >= 0 && chunksHtmlElements[closest - 1].clientHeight > textModuleHeight;

        if (currentHigher) {
            // current chunk is higher than text module space
            const currentScrollTopPosition = window.pageYOffset;
            const scrollStop = boundariesMap[closest][0];
            // check if we still can scroll this chunk
            if (currentScrollTopPosition > scrollStop) {
                return scrollUpCurrentChunk(textModuleHeight, scrollStop);
            }
        }
        if (previousHigher) {
            // current chunk is also higher than text module
            const chunk = this.getChunkElements()[closest - 1];
            // let's scroll to the bottom of it
            return animateToChunk(chunk, isLandscape, ScrollDirection.Up);
        }
        // center previous small chunk
        if (closest - 1 >= 0) {
            const chunk = this.getChunkElements()[closest - 1];
            animateToChunk(chunk, isLandscape);
        }
    }

    nextChunk() {
        const { closest, chunks, isLandscape, imageViewportDims } = this.props;
        const { showTextSelectionOptions } = this.state;
        this.scrollToNextChunk(false, showTextSelectionOptions, chunks, closest, isLandscape, imageViewportDims);
    }

    keyNavigationPressed(evt: KeyboardEvent) {
        const { closest, chunks, hasOpenModal, isLandscape, imageViewportDims } = this.props;
        const { showTextSelectionOptions } = this.state;
        if (this.shouldSwallowKeyboardEvent()) {
            return;
        }
        if (hasOpenModal) return;
        if (Object.values(KEYBOARD_KEYS).includes(evt.keyCode)) {
            evt.preventDefault();
            evt.stopPropagation();
            switch (evt.keyCode) {
                case KEYBOARD_KEYS.PAGE_DOWN:
                case KEYBOARD_KEYS.SPACE: {
                    this.scrollToNextChunk(false, showTextSelectionOptions, chunks, closest, isLandscape, imageViewportDims);
                    break;
                }
                case KEYBOARD_KEYS.PAGE_UP: {
                    this.scrollToPreviousChunk(false, showTextSelectionOptions, closest, isLandscape, imageViewportDims);
                    break;
                }
            }
        }
    }

    finalizeFontSizeTweak() {
        const { previewFontSizeFactor } = this.state;
        this.snapToChunk();
        this.setState({
            fontSizeFactor: previewFontSizeFactor,
            initialFontSizeFactor: previewFontSizeFactor,
            ignoreScrolling: false,
            preview: false
        });

        setTimeout(() => this.setState({ ignoreScrolling: false }));
    }

    filterImageChunks() {
        const { chunks, chunksImages } = this.props;
        let lastImageIndex = 0;
        return chunks.map((_, index) => {
            if (index === 0) {
                return 0;
            }
            if (chunksImages[index] && chunksImages[index].length > 0) {
                lastImageIndex++;
            }
            return lastImageIndex;
        });
    }

    _onPinch(e) {
        e.preventDefault();
        const { initialFontSizeFactor, previousScale, timeKeeper } = this.state;
        if (e.distance > 100) return; // should prevent unwanted reverse of zoom
        clearTimeout(timeKeeper);
        this.setState({
            previewFontSizeFactor: calculateNewFontSize(initialFontSizeFactor, previousScale * e.scale),
            ignoreScrolling: true,
            preview: true,
            timeKeeper: setTimeout(this.finalizeFontSizeTweak, 1000)
        });
    }

    _onPinchEnd() {
        this.finalizeFontSizeTweak();
    }

    onTextSelection(e: React.MouseEvent<Element, MouseEvent>) {
        const selection = window.getSelection();
        if (!selection.isCollapsed) {
            this.setState({
                showTextSelectionOptions: true,
                selection: selection.toString(),
                ...getElementPosition(e),
            })
        }
    }

    hideTextSelectionOptions() {
        this.setState({ showTextSelectionOptions: false });
    }

    renderExampleFontSize() {
        const { t } = this.props;
        const { previewFontSizeFactor } = this.state;
        return (
            <div id="font-size-preview" style={{ fontSize: `${previewFontSizeFactor}em` }}>
                {t(TranslationKeys.Edit_ExampleFontSize)}
            </div>
        );
    }

    chunkProps(chunkIndex: number) {
        const {
            accountId,
            binderId, binderLog, blockProgressWarningShown, blockingChunkIndex,
            checklistByChunkId, checklistsReset, checklists, checklistProgressBlock,
            chunks, chunksImages, chunksKinds, chunkIdByIndex,
            closest, handleTogglePerformed, imageViewportDims, isLandscape,
            translatedLanguage, translatedTitle,
            userId, viewable,
        } = this.props;
        const chunkId = chunkIdByIndex[chunkIndex];
        const checklist = checklistByChunkId[chunkIdByIndex[chunkIndex]];
        const chunkKind = chunksKinds[chunkIndex];
        // make sure current chunk has checklists
        // which is blocking progress
        // and user is looking at it
        // with high probability
        const isBlocking = checklistProgressBlock &&
            (chunkIndex === closest) &&
            (chunkIndex === blockingChunkIndex) &&
            blockProgressWarningShown;

        return {
            accountId,
            binderId,
            binderLog,
            checklist,
            checklistByChunkId,
            checklistProgressBlock,
            checklists,
            checklistsReset,
            chunkId,
            chunkIdByIndex,
            chunkIndex,
            chunks,
            chunksImages,
            chunksKinds,
            closest,
            htmlTransformer: transformListsStyles,
            imageViewportDims: imageViewportDims,
            isActive: chunkIndex === closest,
            isBlocking,
            isLastChunk: chunkIndex === chunks.length - 1,
            key: `tc-${chunkIndex}`,
            kind: chunkKind,
            minPadding: getMinPadding(isLandscape),
            onMouseDown: this.hideTextSelectionOptions,
            onTextSelection: this.onTextSelection,
            onTogglePerformed: handleTogglePerformed,
            translatedLanguage,
            translatedTitle,
            userId,
            viewable,
        }
    }

    renderChunks(chunks: string[][], languageCode: string) {
        const { blockingChunkIndex, checklistProgressBlock, checklists } = this.props;
        const chunksSliced = chunks.slice(0, checklists?.length && checklistProgressBlock && blockingChunkIndex >= 0 ? Math.min(blockingChunkIndex + 1, chunks.length) : chunks.length);
        return chunksSliced.map((chunk, chunkIndex) => (
            <ContentChunk
                {...this.chunkProps(chunkIndex)}
                chunk={chunk}
                language={languageCode}
                mediaModuleTailslotRef={this.props.mediaModuleTailslotRef}
            />
        ));
    }

    render() {
        const { preview, fontSize, textVisibility } = this.state;
        const { activeLanguageCode, chunks, fontFamily = "inherit", imageViewportDims, isLandscape, translations, translatedLanguage } = this.props;
        const { width: imageViewportWidth, height: imageViewportHeight } = imageViewportDims;

        const exampleFontSize = preview ? this.renderExampleFontSize() : undefined;
        // take textVisibility from state or check if imageViewport is already initialized
        const textModuleVisibility = textVisibility ||
            ((isNaN(imageViewportWidth) && isNaN(imageViewportHeight)) ? "hidden" : "visible");

        const deviceHeight = originalToDeviceDimension(imageViewportHeight);
        const deviceWidth = originalToDeviceDimension(imageViewportWidth);
        const marginTop = (isLandscape || isNaN(imageViewportHeight)) ? 0 : deviceHeight;
        const marginLeft = (isLandscape && !isNaN(imageViewportWidth)) ? deviceWidth : 0;
        const textModuleStyle = {
            fontSize, // this fontSize doesn't include any branding overrides (customTagsStyles)
            marginLeft,
            marginTop,
            visibility: textModuleVisibility,
            transform: this.props.scrollHint.isVisible ? "translateY(-50px)" : "translateY(0)",
            ["--paragraph-font-size"]: getParagraphFontSize(fontSize),
        } as React.CSSProperties;
        if (isNaN(marginTop)) {
            textModuleStyle.marginTop = 0;
        }
        const isLangRTL = activeLanguageCode && isLanguageRTL(activeLanguageCode);

        const chunksMarkup = translations ?
            this.renderChunks(translations.map(t => [t]), translatedLanguage) :
            this.renderChunks(chunks, activeLanguageCode);

        return (
            <div
                style={{ fontFamily }}
                className={`text-module-wrapper ${isLangRTL && "right-to-left"}`}
            >
                {exampleFontSize}
                <div
                    className="text-module"
                    onClick={e => this._onClick(e)}
                    style={textModuleStyle}
                    ref={ref => this.textModule = ref}
                >
                    {chunksMarkup}
                </div>
                <ScrollHint marginLeft={`${marginLeft}px`} goToNextChunk={this.nextChunk.bind(this)} />
                <ChunkNumber chunkKinds={this.props.chunksKinds} />
            </div>
        );
    }
}

const TextModuleWithHooks = withHooks<
    ITextModuleProps,
    UseChecklist & UseChecklistStoreActions & UseHasOpenModal & UseTextModuleStore & UseScrollHintContext
>(
    TextModule,
    (props) => ({
        hasOpenModal: useHasOpenModal(),
        shouldIgnoreScroll: useShouldIgnoreScroll(),
        loadChecklists: useChecklistStoreActions().loadChecklists,
        scrollHint: useScrollHintFromContext(),
        ...useChecklist(props),
    }),
);

export default withTranslation()(TextModuleWithHooks);
