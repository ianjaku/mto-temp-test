import * as React from "react";
import Icon from "../";

export const ICON_NAME = "settings";

const settingsIcon = (style = {}, hoverColor = ""): JSX.Element => (
    <Icon
        name={ICON_NAME}
        style={style}
        hoverColor={hoverColor}
    />
);

export default settingsIcon;

