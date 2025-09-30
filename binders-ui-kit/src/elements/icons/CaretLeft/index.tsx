import * as React from "react";
import Icon from "../";

export const ICON_NAME = "keyboard_arrow_left";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const leftArrow = (className, style = {}) => <Icon name={ICON_NAME} style={style} className={className} />;

export default leftArrow;
