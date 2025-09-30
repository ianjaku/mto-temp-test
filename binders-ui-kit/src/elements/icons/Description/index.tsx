import * as React from "react";
import Icon from "../";

export const ICON_NAME = "description_outline";

const description = (style = {}): JSX.Element => <Icon name={ICON_NAME} style={style} />;

export default description;
