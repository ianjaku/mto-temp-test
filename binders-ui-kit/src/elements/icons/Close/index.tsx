import * as React from "react";
import Icon from "../";

export const ICON_NAME = "close";

const close = (style = {}, color = ""): JSX.Element => (
    <Icon name={ICON_NAME} style={style} color={color} />
);

export default close;
