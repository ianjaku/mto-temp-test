import * as React from "react";
import Icon from "../icons";
import IconButton from "@material-ui/core/IconButton";
import autobind from "class-autobind";
import colors from "../../variables";
import cx from "classnames";

const style = {
    height: "40px",
    padding: "5px",
    width: "40px",
};

export interface IPaneItemProps {
    onClick?: (index: number) => void;
    className?: string;
    iconName: string;
    onClose?: () => void;
    isOpened?: boolean;
    index?: number;
    handleIconMouseEnter?: (e, sourceIcon) => void;
    handleIconMouseLeave?: (e, sourceIcon) => void;
    isDisabled?: boolean;
}

export interface IPaneItemState {
    isHovered: boolean;
    isOpened: boolean;
}

class ContextMenuItem extends React.Component<IPaneItemProps, IPaneItemState> {

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    constructor(props) {
        super(props);
        autobind(this, ContextMenuItem.prototype);
        this.state = {
            isHovered: false,
            isOpened: false,
        };
    }

    private calculateColor(isHovered, isOpened, isDisabled) {
        if(isDisabled) {
            return colors.disabledColor;
        }
        return isHovered || isOpened ? colors.accentColor : "white";
    }

    public render(): JSX.Element {
        const {
            className,
            isOpened,
            children,
            iconName,
            onClose,
            isDisabled,
        } = this.props;
        const { isHovered } = this.state;
        const color = this.calculateColor(isHovered, isOpened, isDisabled);

        return (
            <div>
                <IconButton
                    className={className}
                    onClick={this.onClick}
                    onTouchEnd={this.onClick}
                    style={{ ...style, color }}
                    onMouseEnter={this.onIconMouseEnter}
                    onMouseLeave={this.onIconMouseLeave}
                    disabled={isDisabled}

                >
                    <Icon
                        className={cx(
                            "pane-item-icon material-icons",
                            { "pane-item-icon--active": isOpened },
                            { "pane-item-icon--disalbed": isDisabled },

                        )}
                        name={iconName}
                    />
                </IconButton>
                {React.Children.map(children, child => React.cloneElement(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    child as React.ReactElement<any>,
                    { opened: isOpened, onClose, onClick: this.onClick },
                ))}
            </div >
        );
    }

    private onIconMouseEnter(e) {
        const { handleIconMouseEnter, iconName } = this.props;
        if (handleIconMouseEnter) {
            handleIconMouseEnter(e, iconName);
        }
        this.setState({ isHovered: true });
    }

    private onIconMouseLeave(e) {
        const { handleIconMouseLeave, iconName } = this.props;
        if (handleIconMouseLeave) {
            handleIconMouseLeave(e, iconName);
        }
        this.setState({ isHovered: false });
    }

    private onClick() {
        const { onClick } = this.props;
        if (onClick) {
            onClick(this.props.index);
        }
    }
}

export default ContextMenuItem;
