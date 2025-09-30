import * as PropTypes from "prop-types";
import * as React from "react";
import {
    DraftHandleValue,
    EditorState,
    KeyBindingUtil,
    Modifier,
    RichUtils,
    getDefaultKeyBinding,
} from "draft-js";
import { KEY_COMMANDS, REGEXPS, buildStyleMap } from "@binders/client/lib/draftjs/constants";
import {
    calculateToolbarPosition,
    formattingDetected,
    getHyperlinkFromEditorStateSelection,
    spliceInPastedContent
} from "./helpers";
import { onNonBreakingSpaceInsert, onNonBreakingSpaceReplace } from "./nonBreakingSpace";
import ClearFormattingMenu from "./components/ClearFormattingMenu";
import Editor from "@draft-js-plugins/editor";
import { Hyperlink } from "./components/LinkCreator";
import LinkCreator from "./components/LinkCreator";
import { TFunction } from "@binders/client/lib/i18n";
import Toolbar from "./components/Toolbar";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import autobind from "class-autobind";
import classnames from "classnames";
import clearFormatting from "draft-js-clear-formatting";
import createEmojiPlugin from "./components/customEmojis";
import { linkDecorator } from "./decorators";
import toggleLink from "./custom/toggleLink";
import { withTranslation } from "@binders/client/lib/react/i18n";
import "./editor.styl";
import "draft-js/dist/Draft.css";

export interface ITextEditorProps {
    className?: string;
    disabled: boolean;
    editorState: EditorState;
    editorStateVersion: number;
    enableEmoji?: boolean;
    index?: number;
    isActiveVersion?: number;
    metaKey?: string;
    onChange: (change: { state, version }) => void;
    onFocus?: (e, index) => void;
    placeholder?: string;
    placeholderOverride?: string;
    setDisableChunkPointerEvents?: (visible: boolean) => void;
    // eslint-disable-next-line @typescript-eslint/ban-types
    style?: object;
    t: TFunction;
    tabIndex?: number;
    textAlignment?: "right" | "left";
}

export interface ITextEditorState {
    editorState: EditorState;
    editorStateVersion: number;
    hasTextPasted: boolean;
    lastPropagatedState: EditorState;
    selectedHyperlink?: Hyperlink;
    showClearFormattingMenu: boolean;
    showLinkCreator: boolean;
    showToolbar: boolean;
    toolbarArrow: string;
    toolbarArrowLeft: number;
    toolbarLeft: number | string;
    toolbarTop: number | string;
}


class TextEditor extends React.Component<ITextEditorProps, ITextEditorState> {
    public static propTypes = {
        fonts: PropTypes.array,
    };

    private EmojiSuggestions;
    private clearFormattingTimeout;
    private contentStateWithUnformattedPaste;
    private editor: Editor;
    private editorContainerRef = null;
    private emojiPlugin;
    private readonly inlineStyleMap: Record<string, React.CSSProperties>;
    private readonly onNonBreakingSpaceReplace: () => void;
    private rteRoot: Element;
    private readonly t: TFunction;

    constructor(props: ITextEditorProps) {
        super(props);
        const { editorState, editorStateVersion, enableEmoji } = props;

        this.t = props.t;
        autobind(this);
        this.inlineStyleMap = buildStyleMap();

        if (enableEmoji) {
            this.initiateEmojiPlugin();
        }
        this.state = {
            editorState,
            editorStateVersion,
            hasTextPasted: false,
            lastPropagatedState: editorState,
            showClearFormattingMenu: false,
            showLinkCreator: false,
            showToolbar: false,
            toolbarArrow: "bottom",
            toolbarArrowLeft: 218,
            toolbarLeft: 0,
            toolbarTop: 0,
        };
        this.onNonBreakingSpaceReplace = onNonBreakingSpaceReplace.bind(this, this.onChange);
    }

    private initiateEmojiPlugin() {
        this.emojiPlugin = createEmojiPlugin({
            useNativeArt: false,
        });
        this.EmojiSuggestions = this.emojiPlugin.EmojiSuggestions;
    }

    public componentDidMount() {
        if (this.props.isActiveVersion) {
            const { pageXOffset, pageYOffset } = window;
            setTimeout(() => {
                if (this.editor) {
                    this.editor.focus();
                }
                window.scroll(pageXOffset, pageYOffset);
            }, 20);
        }
    }

    public componentDidUpdate(prevProps: ITextEditorProps, prevState: ITextEditorState) {
        const {
            editorStateVersion: prevStateVersion,
            editorState: prevStateEditorState,
            showLinkCreator: prevShowLinkCreator
        } = prevState;
        const { isActiveVersion: prevIsActiveVersion } = prevProps;
        const {
            editorState: propsEditorState,
            editorStateVersion: propsEditorStateVersion,
            isActiveVersion,
        } = this.props;
        const { editorState: stateEditorState, showLinkCreator } = this.state;

        let stateUpdates: Partial<ITextEditorState> = {};

        if (propsEditorState && prevStateVersion !== propsEditorStateVersion) {
            const stateDecorator = stateEditorState.getDecorator();
            const newState = EditorState.set(propsEditorState, { decorator: stateDecorator });
            stateUpdates = {
                ...stateUpdates,
                editorState: newState,
                editorStateVersion: propsEditorStateVersion,
                lastPropagatedState: newState,
            };
        }

        if (stateEditorState !== prevStateEditorState) {
            const selectedHyperlink = getHyperlinkFromEditorStateSelection(stateEditorState);
            if (selectedHyperlink) {
                stateUpdates.selectedHyperlink = selectedHyperlink;
            }
        }

        if (this.editor && ((prevIsActiveVersion || 0) < (isActiveVersion || 0))) {
            this.editor.focus();
        }
        if (showLinkCreator !== prevShowLinkCreator) {
            this.props.setDisableChunkPointerEvents(showLinkCreator);
        }
        if (Object.keys(stateUpdates).length > 0) {
            this.setState(stateUpdates as Pick<ITextEditorState, keyof ITextEditorState>);
        }
    }

    public focus(e) {
        const { onFocus, index, disabled } = this.props;
        if (disabled) {
            return;
        }
        const { showLinkCreator } = this.state;
        if (this.editorContainerRef && onFocus) {
            onFocus(e, index);
        }
        if (this.editor && !showLinkCreator && this.props.isActiveVersion) {
            this.editor.focus();
        }
    }

    public blur(e) {
        const focusStaysWithinThisEditor = this.rteRoot.contains(e.relatedTarget);
        if (focusStaysWithinThisEditor) {
            // if the focus is going to an element within this editor, don't blur
            return;
        }
        this.editor.blur();
        this.setState({ showToolbar: false });
    }

    private onPropagateChange(change: { state, version }) {
        const { onChange } = this.props;
        onChange(change);
    }

    public finishOnChange(editorState, currentEditorState, lastPropagatedState, version, callback) {
        let lastPropagated = lastPropagatedState;
        const currentContentState = lastPropagated.getCurrentContent();
        if (typeof callback === "function") {
            callback();
        }
        const newContentState = editorState.getCurrentContent();
        if (newContentState !== currentContentState) {
            this.onPropagateChange({ state: editorState, version });
            lastPropagated = editorState;
        }
        const newSelectionState = editorState.getSelection();

        // Collapsed means the selection is of length 0, so it's just a cursor without actual content selected
        if (!newSelectionState.isCollapsed() && !newSelectionState.equals(currentEditorState.getSelection())) {
            this.maybeShowToolbar(newSelectionState);
        } else {
            // If there is no selection, then we never want to show the toolbar
            this.setState({ showToolbar: false });
        }
        return lastPropagated;
    }

    public onChange(editorState: EditorState, callback?: () => void) {
        const { editorStateVersion: version } = this.props;
        const { editorState: currentEditorState, lastPropagatedState } = this.state;
        const lastPropagated = this.finishOnChange(editorState, currentEditorState, lastPropagatedState, version, callback);
        this.setState({
            editorState: this.handleSelectionAfterPaste(editorState),
            editorStateVersion: version,
            lastPropagatedState: lastPropagated,
            showClearFormattingMenu: false,
        });
    }

    public handleKeyBinding(e) {
        const { enableEmoji } = this.props;
        if (e.keyCode === 75 && KeyBindingUtil.isCtrlKeyCommand(e)) {
            return KEY_COMMANDS.LINK;
        }
        if (e.keyCode === 32 && KeyBindingUtil.isCtrlKeyCommand(e)) {
            return KEY_COMMANDS.NON_BREAKING_SPACE;
        }
        if (e.keyCode === 9) {
            this.onTab(e);
        }
        if (e.keyCode === 13) {
            this.onEnterAfterHeader();
        }
        if (enableEmoji) {
            this.emojiPlugin.keyBindingFn(e);
        }
        return getDefaultKeyBinding(e);
    }

    public handleKeyCommand(keyCommand) {
        const newState = RichUtils.handleKeyCommand(this.state.editorState, keyCommand);
        if (newState) {
            this.onChange(newState);
            return "handled";
        }
        if (keyCommand === KEY_COMMANDS.LINK) {
            this.onToggleLinkCreator();
            return "handled";
        }
        if (keyCommand === KEY_COMMANDS.NON_BREAKING_SPACE) {
            onNonBreakingSpaceInsert(this.onChange, this.state.editorState);
            return "handled";
        }
        return "not-handled";
    }

    private maybeShowClearFormatting(html) {
        if (html && formattingDetected(html)) {
            if (this.clearFormattingTimeout) {
                clearTimeout(this.clearFormattingTimeout);
            }
            setTimeout(() => {
                this.setState({
                    showClearFormattingMenu: true,
                });
                this.clearFormattingTimeout = setTimeout(() => {
                    this.setState({
                        showClearFormattingMenu: false,
                    });
                }, 5000);
            }, 500);
        }
    }

    public handlePastedText(text: string, html: string): DraftHandleValue {
        const { editorState } = this.state;

        if (REGEXPS.LINK.test(text)) {
            this.onChange(toggleLink(editorState, text, text, "_blank", false, true));
            if (this.editor) {
                this.editor.focus();
            }
            return "handled";
        }

        let newContent;
        if (html) {
            this.contentStateWithUnformattedPaste = spliceInPastedContent(editorState, text, { isHtml: false });
            newContent = spliceInPastedContent(editorState, html, { isHtml: true });
        } else {
            newContent = spliceInPastedContent(editorState, text, { isHtml: false });
        }
        const newEditorState = EditorState.push(editorState, newContent, "insert-fragment");
        this.onChange(EditorState.forceSelection(newEditorState, newContent.getSelectionAfter()));
        this.maybeShowClearFormatting(html);
        return "handled";
    }

    public handleSelectionAfterPaste(newEditorState: EditorState) {
        const { hasTextPasted } = this.state;
        if (hasTextPasted) {
            this.setState({ hasTextPasted: false });
            return EditorState.moveFocusToEnd(newEditorState);
        }
        return newEditorState;
    }

    private onEnterAfterHeader() {
        const editorState = this.state.editorState;
        const content = editorState.getCurrentContent();
        const selection = editorState.getSelection();
        const focus = content.getBlockForKey(selection.getFocusKey());
        // check if user pressed Enter after H<1-3>
        if (focus.getType().includes("header-")) {
            // needs a timeout so we wait till draft inserts new line with normal Enter key behaviour
            setTimeout(() => {
                const editorState = this.state.editorState;
                let content = editorState.getCurrentContent();
                content = Modifier.setBlockType(content, editorState.getSelection(), "unstyled");
                const newState = EditorState.push(editorState, content, "change-block-type");
                this.onChange(newState);
            }, 200);
        }
    }

    public onTab(e) {
        const maxDepth = 4;
        this.onChange(RichUtils.onTab(e, this.state.editorState, maxDepth));
    }

    private setShowToolbar(showToolbar: boolean) {
        this.setState({ showToolbar });
    }

    public clearFormatting() {
        const { editorState } = this.state;

        const selection = editorState.getSelection();
        const contentState = editorState.getCurrentContent();
        const styles = editorState.getCurrentInlineStyle();

        const removeStyles = styles.reduce(
            (state, style) => Modifier.removeInlineStyle(state, selection, style),
            contentState,
        );
        const state = EditorState.push(
            editorState,
            Modifier.setBlockType(removeStyles, selection, "unstyled"),
            "change-block-type",
        );
        this.onChange(clearFormatting(state));
    }

    public toggleInlineStyle(inlineStyle: string, state: EditorState) {
        if (!state) {
            state = this.state.editorState;
        }
        const newState = RichUtils.toggleInlineStyle(state, inlineStyle);
        this.onChange(newState);
        return newState;
    }

    public undo() {
        const { editorState } = this.state;
        this.onChange(EditorState.undo(editorState));
    }

    public redo() {
        const { editorState } = this.state;
        this.onChange(EditorState.redo(editorState));
    }

    public async onSaveHyperlink(hyperlink: Hyperlink) {
        const { text, url, target, isCallToLink } = hyperlink;
        this.onToggleLinkCreator();
        const pasted = false;
        // without this await, MT-4778 occurs
        await this.onChange(toggleLink(this.state.editorState, text, url, target, isCallToLink, pasted));
        if (this.editor) {
            this.editor.focus();
        }
    }

    public onToggle(type, value, state) {
        if (type === "inline") {
            return this.toggleInlineStyle(value, state);
        }
        return this.toggleBlockType(value, state);
    }

    public toggleBlockType(blockType, state) {
        if (!state) {
            state = this.state.editorState;
        }

        const newState = RichUtils.toggleBlockType(state, blockType);
        this.onChange(newState);
        return newState;
    }

    public onCloseLinkCreator() {
        this.onToggleLinkCreator();
    }

    public onToggleLinkCreator() {
        // Focus methods may prevent correct selection of the editorState
        // See more information at:
        // - https://github.com/facebook/draft-js/issues/485
        // - https://github.com/facebook/draft-js/issues/696
        this.setState({
            showLinkCreator: !this.state.showLinkCreator,
            showToolbar: false,
        });
        if (this.editor) {
            this.editor.blur();
        }
    }

    public onContentCut() {
        if (this.editor) {
            this.editor.focus();
        }
        document.execCommand("cut");
        this.setState({ showToolbar: false });
    }

    private insertUnformattedVersionOfPaste() {
        const { editorState } = this.state;
        const newEditorState = EditorState.push(editorState, this.contentStateWithUnformattedPaste, "insert-fragment");
        this.onChange(EditorState.forceSelection(newEditorState, this.contentStateWithUnformattedPaste.getSelectionAfter()));
        this.setState({
            showClearFormattingMenu: false,
        });
    }

    public renderToolbar(collapsed) {
        return (
            <Toolbar
                arrowLeft={this.state.toolbarArrowLeft}
                arrowPosition={this.state.toolbarArrow}
                clearFormatting={this.clearFormatting}
                collapsed={collapsed}
                editorState={this.state.editorState}
                insertNonBreakingSpace={this.onNonBreakingSpaceReplace}
                left={this.state.toolbarLeft}
                onContentCut={this.onContentCut}
                onToggle={this.onToggle}
                onToggleLinkCreator={this.onToggleLinkCreator}
                redo={this.redo}
                setShowToolbar={this.setShowToolbar}
                top={this.state.toolbarTop}
                undo={this.undo}
                yieldFocus={this.focus}
            />
        );
    }

    public maybeRenderLinkCreator() {
        const {
            showLinkCreator,
            toolbarArrow,
            toolbarArrowLeft,
            toolbarLeft,
            toolbarTop,
        } = this.state;
        if (!showLinkCreator) {
            return null;
        }
        return (
            <LinkCreator
                arrowLeft={toolbarArrowLeft}
                arrowPosition={toolbarArrow}
                hyperlink={this.state.selectedHyperlink}
                left={toolbarLeft}
                onClose={this.onCloseLinkCreator}
                onSave={this.onSaveHyperlink}
                top={this.calculateLinkCreatorTop(toolbarTop, toolbarArrow)}
            />
        );
    }

    public renderClearFormattingMenu() {
        const { showClearFormattingMenu, editorState } = this.state;
        if (!showClearFormattingMenu) {
            return null;
        }
        const toolbarPosition = calculateToolbarPosition(editorState.getSelection(), this.rteRoot, { forceBottom: true });
        if (!toolbarPosition) {
            return null;
        }
        const { top, left, isBottomArrow, arrowLeft } = toolbarPosition;
        return (
            <ClearFormattingMenu
                arrowLeft={arrowLeft}
                arrowPosition={isBottomArrow ? "bottom" : "top"}
                left={left}
                onClick={this.insertUnformattedVersionOfPaste}
                top={top}
            />
        )
    }

    public renderEditor() {
        const {
            disabled,
            enableEmoji,
            index,
            placeholderOverride,
            tabIndex,
            textAlignment,
        } = this.props;

        const placeholder = disabled ? "" : (placeholderOverride || this.t(TranslationKeys.Edit_EnterText));
        return (
            <Editor
                customStyleMap={this.inlineStyleMap}
                decorators={[linkDecorator]}
                editorState={this.state.editorState}
                handleKeyCommand={this.handleKeyCommand}
                handlePastedText={this.handlePastedText}
                keyBindingFn={this.handleKeyBinding}
                onChange={this.onChange}
                placeholder={placeholder}
                plugins={enableEmoji ? [this.emojiPlugin] : []}
                readOnly={disabled}
                ref={this.setEditorRef}
                tabIndex={tabIndex || index}
                textAlignment={textAlignment || "left"}
            />
        )
    }

    public render() {
        const {
            children,
            className,
            disabled,
            enableEmoji,
            style,
        } = this.props;

        const collapsed = !this.state.showToolbar || disabled;
        const inputWrapperExtraClass = collapsed ? "collapsed" : "focused";
        const toolbar = !disabled && this.renderToolbar(collapsed);
        const { EmojiSuggestions } = this;

        return (
            <div
                className={classnames("rte-root", className)}
                style={style}
                ref={this.setRteRootRef}
            >
                {children}
                <div className="rte-container">
                    {toolbar}
                    {this.maybeRenderLinkCreator()}
                    {this.renderClearFormattingMenu()}
                    <div
                        className={"clearfix rte-input-wrapper " + inputWrapperExtraClass}
                        onBlur={this.blur}
                        onFocus={this.focus}
                        ref={(r) => { this.editorContainerRef = r; }}
                        suppressContentEditableWarning={true}
                    >
                        {this.renderEditor()}
                        {enableEmoji ?
                            <div className={"emojiSuggestions-container"} >
                                <EmojiSuggestions />
                            </div> :
                            null}
                    </div>
                </div>
            </div>
        );
    }

    private setRteRootRef(ref) {
        this.rteRoot = ref;
    }

    private setEditorRef(ref) {
        this.editor = ref;
    }

    private calculateLinkCreatorTop(top, toolbarPosition) {
        // 106 = LinkCreator height - Toolbar height
        return top - (toolbarPosition === "bottom" ? 106 : 0);
    }

    private maybeShowToolbar(selection) {
        const toolbarPosition = calculateToolbarPosition(selection, this.rteRoot);
        if (toolbarPosition) {
            const { top, left, isBottomArrow, arrowLeft } = toolbarPosition;
            this.setState({
                showLinkCreator: false,
                showToolbar: !this.state.showLinkCreator,
                toolbarArrow: isBottomArrow ? "bottom" : "top",
                toolbarArrowLeft: arrowLeft,
                toolbarLeft: left,
                toolbarTop: top || 0,
            });
        }
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default (withTranslation as any)()(TextEditor);
