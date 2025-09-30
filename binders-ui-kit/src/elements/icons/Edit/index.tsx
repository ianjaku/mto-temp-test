import * as React from "react";
import Icon from "../";

export const ICON_NAME = "edit";

const editIcon = (style: React.CSSProperties = {}, hoverColor = ""): JSX.Element => (
    <Icon
        name={ICON_NAME}
        style={style}
        hoverColor={hoverColor}
    />
);

export default editIcon;

