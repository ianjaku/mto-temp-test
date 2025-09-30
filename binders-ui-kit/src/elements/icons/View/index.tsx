import * as React from "react";
import Icon from "../";

export const ICON_NAME = "remove_red_eye";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const view = ({className = "", style = {}, color = "inherit", hoverColor = "" }) => (
    <Icon
        name={ICON_NAME}
        style={style}
        className={className}
        color={color}
        hoverColor={hoverColor}
    />
);

export default view;
