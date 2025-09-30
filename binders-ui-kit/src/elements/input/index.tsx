import * as React from "react";
import autobind from "class-autobind";
import colors from "../../variables";
import cx from "classnames";
import { omit } from "ramda";
import { withTheme } from "@material-ui/core/styles";
import "./input.styl";

export interface IInputProps extends Omit<React.HTMLProps<HTMLInputElement>, "onChange"> {
    className?: string;
    disabled?: boolean;
    inverted?: boolean;
    isValid?: boolean;
    width?: number;
    setRef?: (ref) => void;
    onChange?: (val: string) => unknown;
    onEnterKey?: () => void;
    useState?: boolean;
    changeOnEnter?: boolean;
    hideFromAnalytics?: boolean;

    // The theme provided by withTheme, see style/theme.ts for the values (some values like dark & light get added automatically by material ui)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    theme?: any;
    autoComplete?: string;
}

export interface IInputState {
    value: string | number | readonly string[];
}

class Input extends React.Component<IInputProps, IInputState> {

    public static defaultProps: Partial<IInputProps> = {
        inverted: false,
        isValid: true,
    };

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    constructor(props: IInputProps) {
        super(props);
        this.state = {
            value: "",
        };
        autobind(this);
    }

    componentDidMount(): void {
        if (this.props.useState) {
            this.setState({
                value: this.props.value ?? "",
            });
        }
    }

    componentDidUpdate(prevProps: IInputProps): void {
        if (this.props.useState && (this.props.value !== prevProps.value)) {
            this.setState({
                value: this.props.value ?? "",
            });
        }
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public onChange = e => {
        if (this.props.useState) {
            this.setState({
                value: e.target.value,
            });
        }
        if (this.props.onChange) {
            this.props.onChange(e.target.value);
        }
    }

    private onKeyDown = e => {
        if (this.props.changeOnEnter && e.keyCode === 13) {
            this.onBlur(e);
        }
        if (e.key === "Enter") {
            this.props.onEnterKey?.();
        }
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public onFocus(e) {
        if (this.props.onFocus) {
            this.props.onFocus(e);
        }
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public onBlur(e) {
        if (this.props.onBlur) {
            this.props.onBlur(e);
        }
    }

    public render(): JSX.Element {
        const { isValid, className, inverted, value } = this.props;
        const classes = cx({ "is-invalid": !isValid }, className, "input", inverted === true ? "input--inverted" : undefined);
        const props = { ...this.props, inverted: undefined, isValid: undefined };
        return (
            <input
                {...omit(["isValid", "setRef", "muiTheme", "value", "useState", "changeOnEnter"], props)}
                value={this.props.useState ? this.state.value : value}
                ref={(ref) => this.props.setRef && this.props.setRef(ref)}
                onChange={this.onChange}
                className={classes}
                onFocus={this.onFocus}
                onBlur={this.onBlur}
                style={this.getInputStyle()}
                onKeyDown={this.onKeyDown}
                data-private-always={!!this.props.hideFromAnalytics || this.props.name?.toLowerCase()?.includes("password")}
            />
        );
    }

    private getInputStyle() {
        const { width } = this.props;

        return {
            width: `${width}px` || "auto",
            "--borderColor": colors.middleGrayColor,
            "--borderColor-focus": this.props?.theme?.palette?.primary?.main ?? colors.accentColor,
        } as React.CSSProperties;
    }
}

export default withTheme(Input);
