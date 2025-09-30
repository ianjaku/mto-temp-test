import * as React from "react";
import ThemedInput, { IInputProps } from "./index";
import { omit } from "ramda";
import "./input.styl";

export interface IIconInputProps extends IInputProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    icon?: any;
}

const InputWithIcon: React.FC<Omit<IIconInputProps, "ref">> = (props) => {
    return (
        <div className="input-wrapper input-wrapper-icon">
            {props.icon && (
                <span className="input-icon">{props.icon}</span>
            )}
            <ThemedInput {...omit(["icon"], props)} />
        </div>
    );
}

export default InputWithIcon;
