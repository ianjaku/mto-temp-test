import * as React from "react";
import Avatar from "@material-ui/core/Avatar";
import { IDropdownElement } from "./index";
import Icon from "../icons";
import { NavbarMenuItemType } from "../navbar";
import autobind from "class-autobind";
import classnames from "classnames";
import cx from "classnames";
import "./dropdown.styl";

export interface IDropdownElementProps {
    element: IDropdownElement;
    onElementClick: (id: string | number) => void;
    bottomBorder?: boolean;
    prefix?: string;
    maxWidthLabel?: number;
    usage?: "label";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class DropdownElement extends React.Component<IDropdownElementProps, any> {

    private static defaultProps = {
        prefix: "",
    };

    private dragging = false;

    constructor(props: IDropdownElementProps) {
        super(props);
        autobind(this, DropdownElement.prototype);

    }

    public render(): JSX.Element {
        const { children, element: { id, label, avatar, isGrayedOut, type, url }, prefix } = this.props;
        const classes = classnames(
            "dropdown-field-label",
            { "contains-avatar": !!avatar },
            { "is-grayed-out": isGrayedOut },
        );

        return type === NavbarMenuItemType.reader ?
            (
                <li className={classes}>
                    <a href={url} target="_blank">{label}</a>
                </li>
            ) :
            (
                <li
                    key={id}
                    onMouseDown={this.handleClick}
                    onTouchStart={this.handleTouchStart}
                    onTouchEnd={this.handleTouchEnd}
                    onTouchMove={this.handleTouchMove}
                    className={classes}
                    data-testid={this.props.usage === "label" ? "dropdown-label" : "dropdown-element"}
                >
                    <div className="dropdown-field-label-group">
                        {this.renderAvatar()}
                        {this.renderIcon()}
                        <span
                            className={cx("dropdown-field-label-group-text", { "dropdown-field-label-group-text--hasMaxWidthLabel": !!this.props.maxWidthLabel })}
                            style={{
                                maxWidth: this.props.maxWidthLabel ? `${this.props.maxWidthLabel}px` : undefined,
                            }}
                            title={`${prefix}${label}`}
                        >
                            {`${prefix}${label}`}
                        </span>
                    </div>
                    {children}
                </li>
            );
    }

    private renderAvatar() {
        const { avatar, bgColor, fitBehaviour, rotation } = this.props.element;

        return !avatar ?
            undefined :
            (
                <Avatar
                    src={avatar}
                    className={cx("avatar", fitBehaviour ?? null)}
                    style={{
                        backgroundColor: bgColor ? `#${bgColor}` : "white",
                        transform: rotation ? `rotate(${rotation}deg)` : undefined,
                    }}
                />
            );
    }
    private renderIcon() {
        const { icon, iconEl } = this.props.element;
        if (icon) {
            return (
                <Icon
                    rootClassName={"icon"}
                    name={icon}
                />
            )
        }
        return iconEl ? iconEl() : null;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private handleTouchStart(e) {
        this.dragging = false;
    }

    private handleTouchEnd(e) {
        if (!this.dragging) {
            this.handleClick(e);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private handleTouchMove(e) {
        this.dragging = true;
    }

    private handleClick(e) {
        e.preventDefault();
        if (this.props.element.disabled) {
            return;
        }
        this.props.onElementClick(this.props.element.id);
    }
}

export default DropdownElement;
