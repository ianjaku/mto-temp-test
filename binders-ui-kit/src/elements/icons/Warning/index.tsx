import * as React from "react";
import Icon from "../";

export const ICON_NAME = "warning";

const warning = (style = {}, className = ""): JSX.Element => (
    <Icon name={ICON_NAME} style={style} className={className} />
);

export default warning;
