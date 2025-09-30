import * as React from "react";
import Icon from "../";

export const ICON_NAME = "volume_off";

const mute = (style = {}, hoverColor = ""): JSX.Element => (
    <Icon
        name={ICON_NAME}
        style={style}
        hoverColor={hoverColor}
    />
);

export default mute;
