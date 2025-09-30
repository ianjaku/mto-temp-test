import * as React from "react";
import { FontLoadContext } from "../../theme";
import MaterialIcon from "@material-ui/core/Icon";
import cx from "classnames";
import "./iconstyle.styl";

export interface IIconProps extends React.HTMLProps<HTMLBaseElement> {
    name: string;
    className?: string;
    themeColor?: "action" | "default" | "disabled" | "inherit" | "primary" | "secondary" | "error";
    color?: string;
    hoverColor?: string;
    rootClassName?: string;
    style?: React.CSSProperties;
    outlined?: boolean;
    "data-testid"?: string;
}

interface IIconState {
    isHovered: boolean;
}

class Icon extends React.Component<IIconProps, IIconState> {

    constructor(props: IIconProps) {
        super(props);

        this.onMouseEnter = this.onMouseEnter.bind(this);
        this.onMouseLeave = this.onMouseLeave.bind(this);
        this.state = {
            isHovered: false,
        };
    }

    public render(): JSX.Element {
        const { name, className, style, color: propColor, hoverColor, themeColor, rootClassName } = this.props;
        const { isHovered } = this.state;
        const color = isHovered ? hoverColor : propColor;
        return (
            <MaterialIcon
                className={cx(
                    className,
                    { "material-icons-notloaded": !this.context.iconsLoaded },
                    { "material-icons-outlined": this.props.outlined }
                )}
                style={{ ...style, color }}
                classes={{
                    root: rootClassName
                }}
                color={themeColor}
                onMouseEnter={this.onMouseEnter}
                onMouseLeave={this.onMouseLeave}
                {...(this.props["data-testid"] ? { "data-testid": this.props["data-testid"] } : {})}
            >
                {name}
            </MaterialIcon>
        );
    }

    private onMouseEnter(e) {
        if (this.props.onMouseEnter) {
            this.props.onMouseEnter(e);
        }
        this.setState({ isHovered: true });
    }

    private onMouseLeave(e) {
        if (this.props.onMouseLeave) {
            this.props.onMouseLeave(e);
        }
        this.setState({ isHovered: false });
    }
}

Icon.contextType = FontLoadContext;

export default Icon;
