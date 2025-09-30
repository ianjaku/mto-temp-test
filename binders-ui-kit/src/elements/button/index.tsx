import * as React from "react";
import CircularProgress from "../circularprogress";
import autobind from "class-autobind";
import cx from "classnames";
import { withTheme } from "@material-ui/core/styles";
import "./Button.styl";

interface IButtonProps {
    CTA?: boolean;
    // Uses the branding primary color in the CTA & secondary buttons
    branded?: boolean;
    className?: string;
    downloadableName?: string;
    hrefAnchor?: string;
    icon?: React.ReactElement;
    iconRight?: React.ReactElement;
    id?: string;
    inactiveWithLoader?: boolean;
    isEnabled?: boolean;
    mouseOverActiveOnDisabled?: boolean;
    onBlur?: () => void;
    onClick?: (e?: React.MouseEvent<HTMLElement>) => void;
    onMouseEnter?: (e) => void;
    onMouseLeave?: (e) => void;
    onMouseOver?: (e) => void;
    onKeyDown?: React.KeyboardEventHandler<HTMLElement>;
    role?: string;
    secondary?: boolean;
    style?: React.CSSProperties;
    tabIndex?: number;
    text: string;
    theme?: { palette: { primary: { main: string; dark: string; } } };
    wrapper?: (children: React.ReactNode) => React.ReactNode;
    borderless?: boolean;
    "aria-label"?: string;
    "data-testid"?: string;
}

interface IButtonState {
    hovered: boolean;
}

class Button extends React.Component<IButtonProps & { forwardedRef?: React.Ref<HTMLDivElement> }, IButtonState> {
    public static defaultProps: Partial<IButtonProps> = {
        CTA: false,
        inactiveWithLoader: false,
        isEnabled: true,
        secondary: false,
    };
    constructor(props: IButtonProps) {
        super(props);
        this.onClick = this.onClick.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.state = {
            hovered: false,
        };
        autobind(this);
    }

    public render() {
        const { text, isEnabled, secondary, CTA, inactiveWithLoader,
            hrefAnchor, downloadableName, className, icon, iconRight, id, wrapper, borderless } = this.props;
        const classNames = cx(
            "button",
            !isEnabled ? "button--disabled" : "",
            inactiveWithLoader ? "button--unhoverable" : "",
            secondary ? "button--secondary" : "",
            CTA ? "button--CTA" : "",
            className,
            { branded: this.props.branded === true },
            { "button--borderless": borderless },
        );

        const button = (
            <div
                ref={this.props.forwardedRef}
                tabIndex={this.props.tabIndex}
                onBlur={this.props.onBlur}
                className={classNames}
                style={this.getThemeVariables()}
                onMouseOver={this.onMouseOver}
                onMouseLeave={this.onMouseLeave}
                onMouseEnter={this.props.onMouseEnter}
                onClick={inactiveWithLoader ? undefined : this.onClick}
                onKeyDown={inactiveWithLoader ? undefined : this.onKeyDown}
                id={id}
                role={this.props.role}
                arial-label={this.props["aria-label"]}
                {...this.props["data-testid"] ? { "data-testid": this.props["data-testid"] } : {}}
            >
                {icon}
                {text}
                <Loader enabled={inactiveWithLoader} isSecondary={secondary} />
                {hrefAnchor ? <a href={hrefAnchor} className="button-link" download={downloadableName} /> : ""}
                {iconRight}
            </div>
        );
        return wrapper ? wrapper(button) : button;
    }


    private onMouseOver(e) {
        const { onMouseOver, isEnabled, mouseOverActiveOnDisabled } = this.props;
        if (!isEnabled && !mouseOverActiveOnDisabled) {
            return;
        }
        this.setState({ hovered: true });
        if (onMouseOver) {
            onMouseOver(e);
        }
    }

    private onMouseLeave(e) {
        const { onMouseLeave, isEnabled, mouseOverActiveOnDisabled } = this.props;
        if (!isEnabled && !mouseOverActiveOnDisabled) {
            return;
        }
        this.setState({ hovered: false });
        if (onMouseLeave) {
            onMouseLeave(e);
        }
    }

    private getThemeVariables(): React.CSSProperties {
        const { theme } = this.props;

        // These are css variables intended to be used in the Style tag
        return {
            "--mainColor": theme.palette?.primary?.main,
            "--mainColor-hover": theme.palette?.primary?.dark,
        } as React.CSSProperties;
    }

    private onClick(e?: React.MouseEvent<HTMLElement>) {
        const { isEnabled, onClick } = this.props;
        if (isEnabled && onClick) {
            onClick(e);
        }
    }

    private onKeyDown(e?: React.KeyboardEvent<HTMLElement>): void {
        if (this.props.isEnabled) {
            this.props.onKeyDown?.(e);
        }
    }
}

const Loader: React.FC<{
    enabled?: boolean;
    isSecondary?: boolean;
}> = ({ enabled = false, isSecondary = false }) => {
    if (!enabled) return null;
    return CircularProgress(
        cx("button-loader", { "button-loader--secondary": isSecondary }),
        { position: "absolute" }
    );
}

const ForwardedRefButton = React.forwardRef<HTMLDivElement, IButtonProps>((props, ref) => {
    return <Button {...props} forwardedRef={ref} />;
});

export default withTheme(ForwardedRefButton);
