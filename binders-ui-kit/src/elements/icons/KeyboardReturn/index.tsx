import * as React from "react";
import Icon from "../";

export const ICON_NAME = "keyboard_return";

const icon = (style = {}): JSX.Element => <Icon name={ICON_NAME} style={style} />;

export default icon;
