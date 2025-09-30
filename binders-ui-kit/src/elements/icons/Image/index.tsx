import * as React from "react";
import Icon from "../";

export const ICON_NAME = "image";

const image = (style = {}): JSX.Element => <Icon name={ICON_NAME} style={style} />;

export default image;
