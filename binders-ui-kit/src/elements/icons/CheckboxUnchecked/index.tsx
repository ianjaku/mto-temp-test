import * as React from "react";
import Icon from "..";

export const ICON_NAME = "check_box_outline_blank";

const icon = (style = {}): JSX.Element => <Icon name={ICON_NAME} style={style} />;

export default icon;