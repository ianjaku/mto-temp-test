import * as React from "react";
import Icon from "../";

export const ICON_NAME = "folder";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const folder = (className = "", style = {}) => (
    <Icon name={ICON_NAME} style={style} className={className} />
);

export default folder;
