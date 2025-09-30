import * as React from "react";
import Icon from "../";

export const ICON_NAME = "picture_as_pdf";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const pdf = ({className = "", style = {}, color = "inherit", hoverColor }) => (
    <Icon
        name={ICON_NAME}
        style={style}
        className={className}
        color={color}
        hoverColor={hoverColor}
    />
);

export default pdf;
