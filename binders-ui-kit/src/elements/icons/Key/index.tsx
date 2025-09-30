import * as React from "react";
import Icon from "../";

export const ICON_NAME = "key";

const key = (style = {}, hoverColor = "", color?: string): React.ReactElement => (
    <Icon
        name={ICON_NAME}
        style={style}
        hoverColor={hoverColor}
        color={color}
    />
);

export default key;
