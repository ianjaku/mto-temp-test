import * as React from "react";
import Icon from "../";

export const ICON_NAME = "translate";

const translate = (style = {}): JSX.Element => <Icon name={ICON_NAME} style={style} />;

export default translate;
