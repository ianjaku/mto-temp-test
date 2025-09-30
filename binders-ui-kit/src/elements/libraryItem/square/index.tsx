import * as React from "react";
import Thumbnail, { FitBehaviour } from "../../thumbnail";
import ContextMenu from "../../contextmenu/";
import Icon from "../../icons";
import { ItemType } from "./../row/index";
import MenuItem from "../../contextmenu/MenuItem";
import classNames from "classnames";
import "./librarysquare.styl";

export interface ILibraryItemProps {
    fitBehaviour?: FitBehaviour;
    title: string;
    thumbnail: string;
    type?: ItemType;
    librarySquareActions?: ILibraryItemAction[];
    onClick?: () => void;
    width?: string;
}

export interface ILibrarySquareState {
    isActive: boolean;
}

export interface ILibraryItemAction {
    title: string;
    iconName: string;
    onClick: () => void;
}

const iconStyles = {
    color: "#cdccca",
    fontSize: "20px",
};

const menuStyles = {
    height: "auto",
    padding: "2px 5px",
    width: "auto",
};

const menuIconStyles = {
    fontSize: "20px",
};

class LibrarySquare extends React.Component<ILibraryItemProps, ILibrarySquareState> {

    private type: ItemType;
    private icon;

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    constructor(props) {
        super(props);
        this.type = this.setItemType(props.type);
        this.icon = this.getIconType(this.type);
        this.setActive = this.setActive.bind(this);
        this.onClick = this.onClick.bind(this);
        this.state = {
            isActive: false,
        };
    }

    public render(): JSX.Element {

        const { title, thumbnail, librarySquareActions, fitBehaviour = FitBehaviour.CROP } = this.props;
        const { isActive } = this.state;
        const itemKindClass = this.setItemClass(this.type);
        const contextMenu = librarySquareActions && librarySquareActions.length > 0 ?
            <ContextMenu menuIconName={"more_vert"} onChangeOpened={this.setActive}  menuStyle={menuStyles} menuIconStyle={menuIconStyles}>
                {librarySquareActions.map(librarySquareAction => <MenuItem key={librarySquareAction.title} {...librarySquareAction} />)}
            </ContextMenu> :
            undefined;
        return (
            <div className={classNames("libraryItem", itemKindClass, {"is-active": isActive })} onClick={this.onClick} >
                <Thumbnail fitBehaviour={fitBehaviour} src={thumbnail} title={title} width={170} />
                <div className="libraryItem-content">
                    <div className="libraryItem-info">
                        <span className="libraryItem-title">{title}</span>
                        <span className="libraryItem-icon">{this.icon}</span>
                    </div>
                    <div className="libraryItem-menu">
                        {contextMenu}
                    </div>
                </div>
            </div>
        );
    }

    private setItemType(type: ItemType) {
        return type;
    }

    private getIconType(type: ItemType) {
        let iconName;
        switch (type) {
            case ItemType.COLLECTION:
                iconName = "folder_open";
                break;
            default:
                iconName = "";
        }
        return (<Icon style={iconStyles} name={iconName} />);
    }

    private setActive(isActive) {
        this.setState({
            isActive,
        });
    }

    private setItemClass(type: ItemType) {
        switch (type) {
            case ItemType.COLLECTION:
                return "collection";
            case ItemType.DOCUMENT:
                return "document";
            default:
                return "";
        }
    }

    private onClick({ target }) {
        if (!target.className.includes("contextMenu-icon") && this.props.onClick) {
            this.props.onClick();
        }
    }
}

export default LibrarySquare;
