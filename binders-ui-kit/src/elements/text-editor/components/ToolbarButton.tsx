import * as PropTypes from "prop-types";
import * as React from "react";
import Icon from "../../icons";
import ThemeColor from "../../../variables";

export interface IToolbarButtonProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chldren?: React.ReactElement<any> | Array<React.ReactElement<any>>;
    extraClassName?: string;
    icon?: string;
    onClick?: (e?: React.MouseEvent<HTMLElement>) => void;
    text?: string;
    title?: string;
    disabled?: boolean;
    id?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class ToolbarButton extends React.Component<IToolbarButtonProps, any> {

    public static propTypes = {
        clearFormatting: PropTypes.func,
        disabled: PropTypes.bool,
        extraClassName: PropTypes.string,
        icon: PropTypes.string,
        text: PropTypes.string,
        title: PropTypes.string,
    };

    public preventMouseDown(e: React.MouseEvent<HTMLButtonElement>): void {
        e.preventDefault();
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public renderChildren() {
        const { children, disabled, extraClassName, icon, text } = this.props;
        const fontSize = this.getFontSize(extraClassName);
        const color = this.getFontColor(extraClassName, disabled);

        if (children) {
            return children;
        }
        return icon ?
            <Icon name={icon} style={{ color, fontSize }}/> :
            text;
    }

    public render(): JSX.Element {
        const { disabled, extraClassName, onClick, title } = this.props;

        return (
            <button
                className={`rte-button ${extraClassName || ""}`}
                onMouseDown={this.preventMouseDown}
                onClick={onClick}
                title={title}
                disabled={typeof disabled !== "undefined" ? disabled : false}
                id={this.props.id}
            >
                {this.renderChildren()}
            </button>
        );
    }

    private getFontSize(extraClassName: string): string {
        return extraClassName && extraClassName.indexOf("font-size") > -1 ?
            "14px" :
            "21px";
    }

    private getFontColor(extraClassName: string, disabled: boolean): string {
        if (disabled) {
            return ThemeColor.disabledColor;
        }

        return extraClassName && extraClassName.match(/^(?!in)active/i) ?
            ThemeColor.accentColor :
            ThemeColor.whiteColor;

    }
}

export default ToolbarButton;
