import * as React from "react";
import Icon from "../";

export const ICON_NAME = "error_outline";

const errorOutline = (style = {}): JSX.Element => <Icon name={ICON_NAME} style={style} />;

export default errorOutline;
