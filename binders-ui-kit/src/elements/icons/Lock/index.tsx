import * as React from "react";
import Icon from "../";

export const ICON_NAME = "lock";

const lock = (style = {}, hoverColor = "", color?: string): JSX.Element => (
    <Icon
        name={ICON_NAME}
        style={style}
        hoverColor={hoverColor}
        color={color}
    />
);

export default lock;
