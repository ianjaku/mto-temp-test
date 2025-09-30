import * as React from "react";
import CaretRight from "../icons/CaretRight";
import Folder from "../icons/Folder";
import { ITreeNavigatorItem } from "./index";
import autobind from "class-autobind";
import colors from "../../variables";
import cx from "classnames";
import readerMode from "../icons/ReaderMode";
import "./TreeNavigator.styl";

export interface ITreeNavigatorRowProps {
    item: ITreeNavigatorItem;
    onSelect: (id, name, kind) => void;
    isSelected?: boolean;
    onNavigate: (item) => void;
    isDisabled?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class TreeNavigatorRow extends React.Component<ITreeNavigatorRowProps, any> {

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    constructor(props) {
        super(props);
        autobind(this, TreeNavigatorRow.prototype);
    }

    public render(): JSX.Element {
        const { item, isDisabled } = this.props;
        const isSelected = !this.props.isDisabled && this.props.isSelected;
        const color = isSelected ? colors.whiteColor : colors.darkGrayColor;
        return (
            <div className={cx("tree-navigator-row", { "is-selected": isSelected, "is-disabled": isDisabled })} onClick={this.onClick} onDoubleClick={this.onNavigate} >
                {item.kind === "collection" ?
                    Folder("tree-navigator-row-folder-icon", { fontSize: 16, color }) :
                    readerMode("tree-navigator-row-folder-icon", { fontSize: 16, color })
                }
                <label className="tree-navigator-row-label">
                    {item.name}
                </label>
                <span className="tree-navigator-row-enter" onClick={this.onNavigate} >
                    {item.kind === "collection" && CaretRight("tree-navigator-row-enter-icon", { fontSize: 20, color })}
                </span>
            </div>
        );
    }

    private onClick(e) {
        if (this.props.isDisabled) {
            return;
        }
        if (e.target.className.indexOf("tree-navigator-row-enter-icon") < 0) {
            this.props.onSelect(this.props.item.id, this.props.item.name, this.props.item.kind);
        }
    }

    private onNavigate(e) {
        // we always let users go inside if we view the item
        // becuase we can have higher role inside this collection
        e.preventDefault();
        this.props.onNavigate(this.props.item);
    }

}

export default TreeNavigatorRow;




