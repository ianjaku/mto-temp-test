import * as React from "react";
import Icon from "../";

export const ICON_NAME = "link";

const link = (style = {}): JSX.Element => <Icon name={ICON_NAME} style={style} />;

export default link;
