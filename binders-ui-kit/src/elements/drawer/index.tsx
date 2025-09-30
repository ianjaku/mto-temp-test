import * as React from "react";
import Close from "../icons/Close";
import IconButton from "@material-ui/core/IconButton";
import MaterialDrawer from "@material-ui/core/Drawer";
import colors from "../../variables";
import cx from "classnames";
import "./drawer.styl";

export interface IDrawerProps {
    opened?: boolean;
    title: string;
    onClose?: () => void;
    className?: string;
    onOpen?: () => void;
    side?: "right" | "left";
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const containerStyle = {
    backgroundColor: colors.baseColor,
    color: "white",
    overflow: "visible",
    padding: "32px 16px",
    transform: "none",
};

const iconStyle = {
    color: "white",
    marginRight: "-10px",
    marginTop: "-10px",
};


// eslint-disable-next-line @typescript-eslint/no-explicit-any
class Drawer extends React.Component<IDrawerProps, any> {

    public static defaultProps: Partial<IDrawerProps> = {
        opened: false,
        side: "right",
    };

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public componentDidUpdate(prevProps) {
        const { onOpen, opened } = this.props;
        if ((!prevProps.opened && opened) && onOpen) {
            onOpen();
        }
    }

    public render(): JSX.Element {
        // @TODO fix containerClassName and ContainerStyle
        const { className, opened, onClose, title, side } = this.props;
        return (
            <MaterialDrawer
                anchor={side}
                classes={{
                    docked: "drawer-container--docked",
                    paperAnchorLeft: "drawer-container",
                    paperAnchorRight: "drawer-container",
                    root: cx("drawer", { "is-opened": opened }, className),
                }}
                open={opened}
                variant="persistent"
            >
                <header className="drawer-container-header">
                    <span className="drawer-container-header-title">{title}</span>
                    <IconButton
                        onClick={onClose}
                        style={iconStyle}
                        className={`drawer-container-header-icon ${title}`}
                    >
                        {Close({color: "white" })}
                    </IconButton>
                </header>
                <div className="drawer-container-body">
                    {this.props.children}
                </div>
            </MaterialDrawer>
        );
    }
}

export default Drawer;
