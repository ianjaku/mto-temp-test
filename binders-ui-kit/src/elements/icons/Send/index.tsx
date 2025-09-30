import * as React from "react";
import Icon from "../";

export const ICON_NAME = "send";

const Send: React.FC<{
    style?: React.CSSProperties;
    hoverColor?: string;
}> = (props): JSX.Element => (
    <Icon
        name={ICON_NAME}
        style={props.style}
        hoverColor={props.hoverColor}
    />
);

export default Send;
