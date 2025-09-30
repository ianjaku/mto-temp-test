import * as React from "react";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Radio from "@material-ui/core/Radio";
import { RadioProps } from "@material-ui/core/Radio";
import "./radio.styl";

export interface IRadioButtonProps extends RadioProps {
    disabled?: boolean;
    // eslint-disable-next-line @typescript-eslint/ban-types
    iconStyle?: object;
    // eslint-disable-next-line @typescript-eslint/ban-types
    inputStyle?: object;
    // eslint-disable-next-line @typescript-eslint/ban-types
    labelStyle?: object;
    // eslint-disable-next-line @typescript-eslint/ban-types
    style?: object;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    uncheckedIcon?: any;
    value?: string;
    className?: string;
    size?: "small" | "medium";
    label: React.ReactNode;
    inverted?: boolean;
    edge?: "start" | "end" | false;
    disableRipple?: boolean;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>, checked: boolean) => void;
    checked?: boolean;
    iconSize?: "medium" | "small";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class RadioButton extends React.Component<IRadioButtonProps, any> {
    private static defaultProps = {
        disableRipple: true,
        edge: false,
        inverted: false,
    };
    public render(): JSX.Element {
        const {
            classes,
            className,
            color,
            disabled,
            inverted,
            label,
            style,
            value,
            onChange,
            checked,
            iconSize,
        } = this.props;
        return (
            <FormControlLabel
                classes={{ root: className, label: inverted ? "radio--inverted" : undefined }}
                label={label}
                value={value}
                control={(
                    <Radio
                        disabled={disabled}
                        classes={{ ...classes, root: !inverted ? undefined : "radio--inverted" }}
                        color="primary"
                        style={{ ...style, color }}
                        value={value}
                        onChange={onChange}
                        checked={checked}
                        size={iconSize || "small"}
                    />
                )}
            />
        );
    }
}

export default RadioButton;
