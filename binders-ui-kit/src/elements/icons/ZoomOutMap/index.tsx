import * as React from "react";
import Icon from "../";

export const ICON_NAME = "zoom_out_map";

const zoomOutMap = (style = {}): JSX.Element => <Icon name={ICON_NAME} style={style} />;

export default zoomOutMap;
