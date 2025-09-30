import * as React from "react";
import { Theme, createStyles, makeStyles } from "@material-ui/core/styles";
import Icon from "../icons";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import MenuItem from "@material-ui/core/MenuItem";
import { Tooltip } from "@material-ui/core";
import autobind from "class-autobind";
import colors from "../../variables";
import cx from "classnames";
import { isIE } from "@binders/client/lib/react/helpers/browserHelper";
import "./contextmenu.styl";


export const menuItemOptionClass = "contextMenu-item-option";

export interface IContextMenuItemProps extends React.HTMLProps<HTMLInputElement> {
    classes?: {
        iconRoot: string;
        listItemIconRoot: string;
        listItemPrimary: string;
        listItemRoot: string;
        menuItemRoot: string;
    };
    className?: string;
    disabled?: boolean;
    fontSize?: string;
    icon?: unknown;
    iconName?: string;
    onClick?: (e?: React.MouseEvent) => void;
    onClose?: () => void;
    persistent?: boolean;
    title: string;
    tooltip?: string;
    noHoverAction?: boolean;
    wrapper?: (children: React.ReactNode) => React.ReactNode;
    testId?: string;
}

const swallowClick = e => e.stopPropagation();

class ContextMenuItem extends React.Component<IContextMenuItemProps, Record<string, unknown>> {
    private static defaultProps = {
        persistent: false,
    };

    constructor(props) {
        super(props);
        autobind(this, ContextMenuItem.prototype);
    }

    public render() {
        const { tooltip } = this.props;
        return !tooltip ?
            this.renderMenuItem() :
            (
                <Tooltip title={tooltip}>
                    <div onClick={swallowClick}>
                        {this.renderMenuItem()}
                    </div>
                </Tooltip>
            );
    }

    private renderMenuItem() {
        const { classes, className, disabled, style, noHoverAction, wrapper, testId } = this.props;
        const menuItem = (
            <MenuItem
                classes={{
                    root: cx(
                        "contextMenu-item",
                        { "is-disabled": disabled },
                        { "noHoverAction": noHoverAction },
                        className,
                        classes.menuItemRoot,
                    ),

                }}
                disabled={disabled}
                onClick={this.onClick}
                style={style}
                data-testid={testId}
            >
                {this.renderIcon()}
                {this.renderText()}
            </MenuItem>
        );
        return wrapper ? wrapper(menuItem) : menuItem;

    }

    private renderIconByName(name: string, classes) {
        return name && (
            <Icon
                rootClassName={`contextMenu-item-icon ${classes.iconRoot}`}
                name={name}
            />
        );
    }

    private renderIcon() {
        const { classes, icon, iconName } = this.props;
        const renderedIcon = icon || this.renderIconByName(iconName, classes);
        return renderedIcon && (
            <ListItemIcon classes={{ root: classes.listItemIconRoot }}>
                {renderedIcon}
            </ListItemIcon>
        );
    }

    private renderText() {
        const { classes, title } = this.props;

        return (
            <ListItemText
                classes={{
                    primary: `${menuItemOptionClass} ${classes.listItemPrimary}`,
                    root: `${menuItemOptionClass} ${classes.listItemRoot}`,
                }}
                primary={title}
            />
        );
    }

    private onClick(e) {
        e.stopPropagation();
        const { onClick, onClose, persistent, disabled } = this.props;
        if (disabled) {
            return;
        }
        onClick?.(e);
        if (!persistent) {
            onClose?.();
        }
    }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const useStyles = makeStyles((theme: Theme) => createStyles({
    iconRoot: {
        fontSize: "20px",
        margin: "5px",
        top: "2px",
    },
    listItemIconRoot: {
        minWidth: "48px",
    },
    listItemPrimary: {
        fontFamily: colors.defaultFontName,
        fontSize: "13px",
        paddingRight: "50px",
        lineHeight: isIE() ? "35px" : undefined,
    },
    listItemRoot: {
        lineHeight: "35px",
        marginLeft: "0px",
        marginRight: "8px",
        minHeight: "35px",
    },
    menuItemRoot: {
        maxHeight: isIE() ? undefined : "35px",
        minHeight: isIE() ? undefined : "35px",
        paddingBottom: "0px",
        paddingTop: "0px",
    },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default React.forwardRef((props: IContextMenuItemProps, ref: any) => (
    <ContextMenuItem
        {...props}
        classes={useStyles()}
        ref={ref}
    />
));
