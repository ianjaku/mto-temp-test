import * as React from "react";
import Icon from "../";

export const ICON_NAME = "more_vert";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const moreVert = (style = {}, color = "", hoverColor = "") => (
    <Icon
        name={ICON_NAME}
        style={style}
        color={color}
        hoverColor={hoverColor || color}
    />
);

export default moreVert;
