import * as React from "react";
import CaretLeft from "../icons/CaretLeft";
import CircularProgress from "../circularprogress";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import TreeNavigatorRow from "./TreeNavigatorRow";
import autobind from "class-autobind";
import colors from "../../variables";
import cx from "classnames";
import { withTranslation } from "@binders/client/lib/react/i18n";
import "./TreeNavigator.styl";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function takeLast(arr) {
    return arr ? arr.slice(-1)[0] : undefined;
}

export interface ITreeNavigatorProps {
    parentItems: ITreeNavigatorItem[];
    rootItems: ITreeNavigatorItem[];
    items?: ITreeNavigatorItem[];
    allowRootSelection?: boolean;
    selectedId?: string;
    onNavigate: (item, isBack) => void;
    onSelect: (collectionId, parentItems, name, kind) => void;
    collectionsOnly?: boolean; // Changes the empty state text to say "No collections here", instead of "No items here"
}

export interface ITreeNavigatorState {
    parentItem: ITreeNavigatorItem;
    parentItems: ITreeNavigatorItem[];
    items: ITreeNavigatorItem[];
}

export interface ITreeNavigatorItem {
    id: string;
    name: string;
    kind?: string;
    disabled?: boolean;
}

class TreeNavigator extends React.Component<ITreeNavigatorProps, ITreeNavigatorState> {
    public static defaultProps: Partial<ITreeNavigatorProps> = {
        allowRootSelection: true,
        items: undefined,
        rootItems: undefined,
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    static getDerivedStateFromProps(nextProps, prevState) {
        const { items, parentItems } = nextProps;
        const newParentItem = takeLast(parentItems);
        return {
            items,
            parentItem: newParentItem,
            parentItems,
        };
    }

    private parentItem: ITreeNavigatorItem;
    private t;

    constructor(props) {
        super(props);
        this.t = props.t;
        autobind(this, TreeNavigator.prototype);
        const { parentItems, items } = props;
        const parentItem = takeLast(parentItems);
        this.state = {
            items,
            parentItem,
            parentItems,        };
    }

    public render() {
        const { rootItems } = this.props;
        const { items, parentItem } = this.state;
        const parentId = parentItem && parentItem.id;
        const isRoot = !!
        (rootItems && rootItems.length === 1 && rootItems[0].id === parentId) ||
            parentItem === undefined;
        const itemsToRender = parentItem === undefined ? rootItems : items;
        return (
            <div className={cx("tree-navigator", { "is-root": isRoot })}>
                {this.renderParentItemHeader()}
                <div className="tree-navigator-rows">
                    {(itemsToRender === undefined) && <div className="tree-navigator-loader">{CircularProgress()}</div>}
                    {itemsToRender && itemsToRender.length === 0 && (
                        <div className="tree-navigator-rows-empty">
                            {!this.props.collectionsOnly && this.t(TranslationKeys.General_NoItems)}
                            {this.props.collectionsOnly && this.t(TranslationKeys.General_NoCollections)}
                        </div>
                    )}
                    {itemsToRender && itemsToRender.map(item => (
                        <TreeNavigatorRow
                            key={item.id}
                            item={item}
                            isSelected={this.props.selectedId === item.id}
                            onSelect={this.onSelectItem}
                            onNavigate={this.onNavigate}
                            isDisabled={item.disabled}
                        />))}
                </div>
            </div>
        );
    }

    private renderParentItemHeader() {
        const { parentItem } = this.state;
        const isSelected = parentItem && this.props.selectedId === parentItem.id;
        const color = isSelected ? colors.whiteColor : colors.darkGrayColor;
        const name = parentItem ? parentItem.name : "";
        return (
            <div className={cx("tree-navigator-parent", { "is-selected": isSelected })} onClick={this.onClickParent} onDoubleClick={this.onNavigateToParent}>
                <span className="tree-navigator-parent-back" onClick={this.onNavigateToParent}>
                    {CaretLeft("tree-navigator-parent-back-icon", { fontSize: 20, color })}
                </span>
                <label className="tree-navigator-parent-label">
                    {name}
                </label>
            </div>
        );
    }

    private onClickParent(e) {
        if (e.target.className.indexOf("tree-navigator-parent-back-icon") < 0) {
            const { parentItem } = this.state;
            const id = parentItem && parentItem.id;
            if (!parentItem.disabled) {
                this.onSelectItem(id, parentItem.name, parentItem.kind);
            }
        }
    }

    private onSelectItem(selectedId, name, kind) {
        if (this.props.selectedId === selectedId) {
            return;
        }
        const { parentItems } = this.state;
        this.props.onSelect(selectedId, parentItems, name, kind);
    }

    private onNavigate(item) {
        this.props.onNavigate(item, false);
    }

    private onNavigateToParent() {
        const { onNavigate, rootItems } = this.props;
        const { parentItems } = this.state;
        if (parentItems.length > 1) {
            // take one before last - out new root
            onNavigate(parentItems[parentItems.length - 2], true);
            return;
        }
        onNavigate(rootItems, true);
    }
}

export default withTranslation()(TreeNavigator);
