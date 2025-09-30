import * as React from "react";
import Icon from "../";

export const ICON_NAME = "arrow_forward";

const rightArrow = (style = {}): JSX.Element => <Icon name={ICON_NAME} style={style} />;

export default rightArrow;
