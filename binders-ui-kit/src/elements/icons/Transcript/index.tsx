import * as React from "react";
import Icon from "../";

export const ICON_NAME = "sms";

const transcriptIcon = (style = {}, hoverColor = "", color = ""): JSX.Element => (
    <Icon
        name={ICON_NAME}
        style={style}
        hoverColor={hoverColor}
        color={color}
    />
);

export default transcriptIcon;
