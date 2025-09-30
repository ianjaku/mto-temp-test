import * as React from "react";
import Icon from "../";

export const ICON_NAME = "keyboard_arrow_right";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const rightArrow = (className, style = {}, key?): JSX.Element => (
    <Icon key={key} name={ICON_NAME} style={style} className={className} />
);

export default rightArrow;
