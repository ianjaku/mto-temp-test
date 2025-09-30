import * as React from "react";
import Icon from "../";

export const ICON_NAME = "menu";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const menu = (style= {}, color) => <Icon name={ICON_NAME} style={style} color={color}/>;

export default menu;
