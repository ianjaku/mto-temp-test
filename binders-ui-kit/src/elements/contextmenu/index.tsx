import * as React from "react";
import IconButton from "@material-ui/core/IconButton";
import MateriaIcon from "../icons";
import Menu from "@material-ui/core/Menu";
import Popover from "@material-ui/core/Popover";
import autobind from "class-autobind";
import cx from "classnames";
import debounce from "lodash.debounce";
import "./contextmenu.styl";

export interface IContextMenuProps extends React.HTMLProps<HTMLElement> {
    buttonClass?: string;
    menuIconName?: string;
    defaultOpened?: boolean;
    disableAutoFocus?: boolean;
    disableEnforceFocus?: boolean;
    open?: boolean;
    menuIconStyle?: { color?: string, fontSize?: string|number };
    // eslint-disable-next-line @typescript-eslint/ban-types
    menuStyle?: object;
    popOverStyle?: { top?: number | string };
    onChangeOpened?: (open) => void;
    isActive?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    anchorRef?: any;
    className?: string;
    handleMouseEnter?: (e, sourceIcon) => void;
    handleMouseLeave?: (e, sourceIcon) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    doNotShowUntilResolved?: Promise<any>;
    onClick?: (e) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    container?: any;
    onClose?: (e) => void;
    anchorOrigin?: {
        horizontal: "left" | "center" | "right" | number,
        vertical: "top" | "center" | "bottom" | number,
    };
    isDisabled?: boolean;
    renderAbovePopup?: boolean;
    testId?: string;
}
export interface IContextMenuState {
    defaultOpened: boolean;
    opened: boolean;
    anchorRef?: HTMLElement | null;
    isControlled: boolean;
    iconButton?: HTMLElement | null;
}

export const contextMenuPopoverClass = "context-menu-popover";
class ContextMenu extends React.Component<IContextMenuProps, IContextMenuState> {

    public static defaultProps: Partial<IContextMenuProps> = {
        anchorOrigin: {
            horizontal: "left",
            vertical: "bottom",
        },
        defaultOpened: false,
        disableAutoFocus: true,
        disableEnforceFocus: true,
        menuIconStyle: {},
        menuStyle: {},
        open: undefined,
    };

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    static getDerivedStateFromProps(nextProps, prevState) {
        const { defaultOpened, isControlled, opened } = prevState;
        let state = prevState;
        if (defaultOpened !== nextProps.defaultOpened) {
            state = {
                ...state,
                defaultOpened: nextProps.defaultOpened,
            };
        }
        if (isControlled && nextProps.open !== opened) {
            state = {
                ...state,
                opened: nextProps.open,
            };
        }
        if (nextProps.anchorRef && prevState.anchorRef !== nextProps.anchorRef) {
            state = {
                ...state,
                anchorRef: nextProps.anchorRef,
            };
        }
        return state;
    }

    private onRequestCloseMenuDebounced;
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    constructor(props) {
        super(props);
        autobind(this, ContextMenu.prototype);
        this.onIconMenuClick = this.onIconMenuClick.bind(this);
        this.renderIconMenu = this.renderIconMenu.bind(this);
        this.onRequestCloseMenuDebounced = debounce(this.onRequestCloseMenu, 100);
        this.state = {
            defaultOpened: props.defaultOpened,
            iconButton: undefined,
            isControlled: props.open !== undefined,
            opened: props.open !== undefined ? props.open : props.defaultOpened,
        };
    }

    public componentDidMount(): void {
        window.addEventListener("scroll", this.onRequestCloseMenuDebounced);
    }

    public componentWillUnmount(): void {
        window.removeEventListener("scroll", this.onRequestCloseMenuDebounced);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public componentDidUpdate(_, prevState) {
        const { onChangeOpened } = this.props;
        const { opened } = this.state;
        if (opened === true && !prevState.opened && typeof onChangeOpened === "function") {
            onChangeOpened(opened);
        }
    }

    public render(): JSX.Element {
        const {
            anchorOrigin,
            className,
            disableAutoFocus,
            disableEnforceFocus,
            menuIconName,
            onClose,
            popOverStyle,
        } = this.props;
        const { anchorRef, opened } = this.state;

        if (menuIconName) {
            return this.renderIconMenu();
        }

        return !anchorRef ?
            <div /> :
            (
                <Popover
                    disableScrollLock={true}
                    anchorEl={anchorRef}
                    anchorOrigin={anchorOrigin}
                    getContentAnchorEl={null}
                    className={className || ""}
                    onClose={onClose}
                    open={opened}
                    style={{
                        zIndex: 1300,
                        ...(popOverStyle || {}),
                    }}
                    disableAutoFocus={disableAutoFocus}
                    disableEnforceFocus={disableEnforceFocus}
                    BackdropProps={{
                        invisible: true,
                    }}
                    data-testid={this.props.testId}
                >
                    {this.prepareChildren()}
                </Popover>
            );
    }

    private renderIconMenu() {
        const {
            buttonClass,
            className,
            container,
            disableAutoFocus,
            disableEnforceFocus,
            onClick,
            menuStyle,
            menuIconStyle,
            isDisabled,
            renderAbovePopup,
        } = this.props;
        const { iconButton, opened } = this.state;
        const onMenuClick = (e) => {
            e.stopPropagation();
            onClick?.(e);
        }
        return (
            <div className="context-menu-wrapper" data-testid={this.props.testId}>
                <IconButton
                    aria-label="more"
                    aria-controls="long-menu"
                    aria-haspopup="true"
                    classes={buttonClass ? { root: buttonClass } : undefined}
                    style={{ ...menuStyle, color: menuIconStyle.color }}
                    onClick={this.onIconMenuClick}
                    ref={this.setIconButtonRef}
                    onMouseEnter={this.onMouseEnter}
                    onMouseLeave={this.onMouseLeave}
                    disabled={isDisabled}
                >
                    {this.renderMenuButtonIcon()}
                </IconButton>
                {iconButton && (
                    <Menu
                        disableScrollLock={true}
                        anchorEl={iconButton}
                        anchorOrigin={{ horizontal: "left", vertical: "top" }}
                        getContentAnchorEl={null}
                        className={className || ""}
                        container={container}
                        open={opened}
                        elevation={3}
                        onClick={onMenuClick}
                        onClose={this.onRequestCloseMenu}
                        transformOrigin={{ horizontal: "right", vertical: "top" }}
                        PopoverClasses={{
                            root: `${contextMenuPopoverClass} ${renderAbovePopup ? "context-menu-popover--abovePopup" : ""}`,
                            paper: "context-menu-popover-paper"
                        }}
                        disableAutoFocus={disableAutoFocus}
                        disableEnforceFocus={disableEnforceFocus}
                    >
                        {this.prepareChildren()}
                    </Menu>
                )}
            </div>

        );
    }

    private setIconButtonRef(ref) {
        const { iconButton } = this.state;
        if (iconButton === undefined) {
            this.setState({ iconButton: ref });
        }
    }

    private onIconMenuClick(e: React.MouseEvent<HTMLElement>) {
        e.stopPropagation();
        const { onClick, doNotShowUntilResolved, isDisabled } = this.props;
        if (isDisabled) {
            return;
        }
        const { isControlled, opened } = this.state;
        if (isControlled) {
            onClick(e);
            return;
        }
        if (doNotShowUntilResolved) {
            doNotShowUntilResolved.then(() => {
                this.setState({ opened: !opened });
            })
        } else {
            this.setState({ opened: !opened });
        }
    }

    private onMouseEnter(e) {
        const { handleMouseEnter, menuIconName } = this.props;
        if (handleMouseEnter) {
            handleMouseEnter(e, menuIconName);
        }
    }

    private onMouseLeave(e) {
        const { handleMouseLeave, menuIconName } = this.props;
        if (handleMouseLeave) {
            handleMouseLeave(e, menuIconName);
        }
    }

    private prepareChildren() {
        const { children } = this.props;

        return React.Children.map(children, child => {
            return child && React.cloneElement(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                child as React.ReactElement<any>,
                { onClose: this.onRequestCloseMenu },
            );
        });

    }

    private renderMenuButtonIcon() {
        const { isActive, menuIconName, menuIconStyle } = this.props;
        const { opened } = this.state;

        const fontIconClassName = cx(
            "contextMenu-icon",
            { "contextMenu-icon--active": opened || isActive },
        );

        return (
            <MateriaIcon name={menuIconName} className={fontIconClassName} style={menuIconStyle} />
        );
    }

    private onRequestCloseMenu() {
        this.onRequestChangeOpenState(false);
    }

    private onRequestChangeOpenState(opened) {
        const { onChangeOpened } = this.props;
        const { isControlled } = this.state;

        if (!isControlled) {
            this.setState({ opened });
        }
        if (typeof onChangeOpened === "function") {
            onChangeOpened(opened);
        }
    }
}

export default ContextMenu;
