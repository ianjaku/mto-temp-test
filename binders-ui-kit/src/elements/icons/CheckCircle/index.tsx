import * as React from "react";
import Icon from "../";

export const ICON_NAME = "check_circle";

const done = (style: React.CSSProperties = {}): JSX.Element =>
    <Icon name={ICON_NAME} style={style} />;

export default done;
