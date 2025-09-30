import * as React from "react";
import Icon from "..";

export const ICON_NAME = "refresh";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const copy = ({ className = "", style = {}, color = "inherit", hoverColor = "inherit" }) => (
    <Icon
        name={ICON_NAME}
        style={style}
        className={className}
        color={color}
        hoverColor={hoverColor}
    />
);

export default copy;
