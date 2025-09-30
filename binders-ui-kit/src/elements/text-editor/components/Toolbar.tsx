import * as PropTypes from "prop-types";
import * as React from "react";
import {
    FONT_SIZE_INCREASE,
    FONT_SIZE_MAXIMUM,
    FONT_SIZE_MINIMUM,
    FONT_SIZE_PREFIX 
} from "../constants";
import BreakLinkIcon from "../../icons/BreakLink";
import DropDown from "../../dropdown";
import { EditorState } from "draft-js";
import Floater from "../../floater/Floater";
import ToolbarButton from "./ToolbarButton";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import autobind from "class-autobind";
import { withTranslation } from "@binders/client/lib/react/i18n";

export interface IToolbarProps {
    arrowLeft: number;
    arrowPosition: string;
    collapsed: boolean;
    clearFormatting: () => void;
    editorState: EditorState;
    insertNonBreakingSpace: (state: EditorState) => void;
    onToggle: (type: string, style: string, state?: EditorState) => EditorState;
    onToggleLinkCreator: () => void;
    onContentCut: () => void;
    yieldFocus: (e: React.MouseEvent<HTMLElement>) => void;
    undo: () => void;
    redo: () => void;
    left: string | number;
    top: string | number;
    setShowToolbar?: (showToolbar: boolean) => void;
}


export interface IToolbarState {
    isBlockstyleDropdownOpen: boolean;
}

class Toolbar extends React.Component<IToolbarProps, IToolbarState> {

    static propTypes = {
        collapsed: PropTypes.bool,
        editorState: PropTypes.object.isRequired,
        onToggleLinkCreator: PropTypes.func.isRequired,
        onToggle: PropTypes.func.isRequired,
        redo: PropTypes.func.isRequired,
        undo: PropTypes.func.isRequired,
        yieldFocus: PropTypes.func.isRequired,
    };

    private t;

    constructor(props) {
        super(props);
        this.t = props.t;
        autobind(this);
        this.state = {
            isBlockstyleDropdownOpen: false,
        };
    }

    componentDidUpdate(prevProps) {
        const { collapsed: wasCollapsed } = prevProps;
        const { collapsed } = this.props;
        if (wasCollapsed && !collapsed) {
            this.setState({
                isBlockstyleDropdownOpen: false,
            });
        }
    }

    public render() {
        const { arrowLeft, arrowPosition, left, top, collapsed } = this.props;
        return (
            <Floater
                collapsed={collapsed}
                left={left}
                top={top}
                arrowLeft={arrowLeft}
                arrowPosition={arrowPosition}
            >
                {this.renderButtons()}
            </Floater>
        );
    }


    private renderButtons() {
        const { editorState } = this.props;
        const { isBlockstyleDropdownOpen } = this.state;
        const allowUndo = editorState.getAllowUndo();
        const undoEnabled = allowUndo && editorState.getUndoStack().size > 0;
        const redoEnabled = allowUndo && editorState.getRedoStack().size > 0;
        const lists = (<React.Fragment>
            <ToolbarButton
                id="composer-toolbar-format_list_bulleted"
                key="button-format_list_bulleted"
                icon="format_list_bulleted"
                onClick={this.onButtonClick("block", "unordered-list-item")}
                extraClassName={this.getButtonActiveClass("block", "unordered-list-item")}
                title="UL"
                text={this.getChildText("format_bold", "UL")}
            />
            <ToolbarButton
                id="composer-toolbar-format_list_numbered"
                key="button-format_list_numbered"
                icon="format_list_numbered"
                onClick={this.onButtonClick("block", "ordered-list-item")}
                extraClassName={this.getButtonActiveClass("block", "ordered-list-item")}
                title={this.t(TranslationKeys.Edit_OrderedList)}
                text={this.getChildText("format_list_numbered", "OL")}
            />
        </React.Fragment>);
        return (
            <div className="rte-button-group">
                <ToolbarButton
                    id="composer-toolbar-format_list_bold"
                    key="button-bold"
                    icon="format_bold"
                    onClick={this.onButtonClick("inline", "BOLD")}
                    extraClassName={this.getButtonActiveClass("inline", "BOLD")}
                    title={this.t(TranslationKeys.Edit_Bold)}
                    text={this.getChildText("format_bold", "Bold")}
                />
                <ToolbarButton
                    id="composer-toolbar-format_underlined"
                    key="button-underlined"
                    icon="format_underlined"
                    onClick={this.onButtonClick("inline", "UNDERLINE")}
                    extraClassName={this.getButtonActiveClass("inline", "UNDERLINE")}
                    title={this.t(TranslationKeys.Edit_Underline)}
                    text={this.getChildText("format_underlined", "Underline")}
                />
                <ToolbarButton
                    id="composer-toolbar-format_italic"
                    key="button-italic"
                    icon="format_italic"
                    onClick={this.onButtonClick("inline", "ITALIC")}
                    extraClassName={this.getButtonActiveClass("inline", "ITALIC")}
                    title={this.t(TranslationKeys.Edit_Italic)}
                    text={this.getChildText("format_italic", "Italic")}
                />
                <ToolbarButton
                    id="composer-toolbar-format_decreaseFont"
                    key="decreaseFont"
                    icon="expand_more"
                    onClick={this.onDecreaseFont}
                    text="-"
                    disabled={!this.getFontSizeEnabled().decreaseEnabled}
                    extraClassName="font-size"
                />
                <ToolbarButton
                    id="composer-toolbar-format_size"
                    key="format_size"
                    icon="format_size"
                    onClick={this.onDecreaseFont}
                    text=" -"
                    disabled={!this.getFontSizeEnabled().decreaseEnabled}
                />
                <ToolbarButton
                    id="composer-toolbar-format_increaseFont"
                    key="increaseFont"
                    icon="expand_less"
                    onClick={this.onIncreaseFont}
                    text="+"
                    disabled={!this.getFontSizeEnabled().increaseEnabled}
                    extraClassName="font-size expand-less"
                />
                <div className="block-group">
                    {lists}
                </div>
                <ToolbarButton
                    id="composer-toolbar-format_undo"
                    key="undo"
                    icon="undo"
                    onClick={this.props.undo}
                    title={this.t(TranslationKeys.Edit_Undo)}
                    disabled={!undoEnabled}
                />
                <ToolbarButton
                    id="composer-toolbar-format_redo"
                    key="redo"
                    icon="redo"
                    onClick={this.props.redo}
                    title={this.t(TranslationKeys.Edit_Redo)}
                    disabled={!redoEnabled}
                />
                <ToolbarButton
                    id="composer-toolbar-format_cut"
                    key="cut"
                    icon="content_cut"
                    onClick={this.cutText}
                    title={this.t(TranslationKeys.Edit_Cut)}
                />
                <ToolbarButton
                    id="composer-toolbar-format_link"
                    key="link"
                    icon="link"
                    onClick={this.props.onToggleLinkCreator}
                    title={this.t(TranslationKeys.Edit_Link)}
                />
                <ToolbarButton
                    id="composer-toolbar-format_unlink"
                    key="space"
                    extraClassName="non-breaking"
                    disabled={editorState.getSelection().isCollapsed()}
                    onClick={this.insertNonBreakingSpace}
                    title={this.t(TranslationKeys.Edit_NonBreakingSpace)}
                >
                    <BreakLinkIcon />
                </ToolbarButton>
                <ToolbarButton
                    id="composer-toolbar-format_clear"
                    key="clear"
                    icon="clear"
                    onClick={this.props.clearFormatting}
                    title={this.t(TranslationKeys.Edit_ClearFormatting)}
                />
                <DropDown
                    id="composer-toolbar-format_block_style"
                    arrowColor="#FFF"
                    type=""
                    elements={BLOCKSTYLE_OPTIONS}
                    onSelectElement={this.onSelectElement}
                    selectedElementId={this.getCurrentBlockStyle() || "normal"}
                    onClick={this.toggleBlockstyleDropdown}
                    open={isBlockstyleDropdownOpen}
                />
            </div>
        );
    }

    private getCurrentBlockStyle() {
        const { editorState } = this.props;
        const selection = editorState.getSelection();
        return editorState
            .getCurrentContent()
            .getBlockForKey(selection.getStartKey())
            .getType();
    }

    private isButtonActive(type: string, style: string): boolean {
        const { editorState } = this.props;
        return type === "block" ?
            style === this.getCurrentBlockStyle() :
            editorState.getCurrentInlineStyle().has(style);
    }

    private getCurrentFontSize() {
        const { editorState } = this.props;
        const currentInlineStyle = editorState.getCurrentInlineStyle();
        const activeFontSizes = currentInlineStyle.filter(value => value.startsWith(FONT_SIZE_PREFIX));
        if (activeFontSizes.size === 1) {
            const activeFontSizeStyle = activeFontSizes.first();
            return { isSet: true, value: parseInt(activeFontSizeStyle.substr(FONT_SIZE_PREFIX.length), 10) };
        }

        return { isSet: false, value: 100 };
    }

    private getButtonActiveClass(type: string, style: string): string {
        return this.isButtonActive(type, style) ? "active" : "inactive";
    }

    private getChildText(icon: string, label: string) {
        return icon ? null : label;
    }

    private getFontSizeEnabled(): { decreaseEnabled: boolean; increaseEnabled: boolean } {
        const currentFontSize = this.getCurrentFontSize();
        const isHeader = this.getCurrentBlockStyle().startsWith("header-");
        const decreaseEnabled = !isHeader && currentFontSize.value > FONT_SIZE_MINIMUM;
        const increaseEnabled = !isHeader && currentFontSize.value < FONT_SIZE_MAXIMUM;
        return { decreaseEnabled, increaseEnabled };
    }

    private onButtonClick(type: string, style): () => void {
        return () => this.props.onToggle(type, style);
    }

    private onSetFontSize(delta) {
        const fontSize = this.getCurrentFontSize();
        let state;
        if (fontSize.isSet) {
            state = this.props.onToggle("inline", FONT_SIZE_PREFIX + fontSize.value);
        }
        this.props.onToggle("inline", FONT_SIZE_PREFIX + (fontSize.value + delta), state);
    }

    private onDecreaseFont(): void {
        return this.onSetFontSize(-FONT_SIZE_INCREASE);
    }

    private onIncreaseFont(): void {
        return this.onSetFontSize(FONT_SIZE_INCREASE);
    }

    private onSelectElement(style): void {
        this.toggleBlockstyleDropdown();
        this.props.onToggle("block", style);
        this.props.setShowToolbar(false);
    }

    private insertNonBreakingSpace() {
        this.props.insertNonBreakingSpace(this.props.editorState);
    }

    private toggleBlockstyleDropdown() {
        this.setState({ isBlockstyleDropdownOpen: !this.state.isBlockstyleDropdownOpen });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private cutText(e) {
        this.props.onContentCut();
    }
}

const BLOCKSTYLE_OPTIONS = [
    {
        id: "unstyled",
        label: "Normal",
    },
    {
        id: "header-one",
        label: "H1",
    },
    {
        id: "header-two",
        label: "H2",
    },
    {
        id: "header-three",
        label: "H3",
    },
    {
        id: "header-four",
        label: "H4",
    },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default (withTranslation as any)()(Toolbar);
