import * as React from "react";
import Icon from "../";

export const ICON_NAME = "chrome_reader_mode";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const readerMode = (className = "", style = {}) => <Icon name={ICON_NAME} style={style} className={className} />;

export default readerMode;
