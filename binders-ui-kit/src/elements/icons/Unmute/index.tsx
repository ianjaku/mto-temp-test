import * as React from "react";
import Icon from "../";

export const ICON_NAME = "volume_up";

const unmute = (style = {}, hoverColor = ""): JSX.Element => (
    <Icon
        name={ICON_NAME}
        style={style}
        hoverColor={hoverColor}
    />
);

export default unmute;
