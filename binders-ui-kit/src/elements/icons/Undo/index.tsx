import * as React from "react";
import Icon from "../";

export const ICON_NAME = "undo";

const done = (style = {}): JSX.Element => <Icon name={ICON_NAME} style={style} />;

export default done;
