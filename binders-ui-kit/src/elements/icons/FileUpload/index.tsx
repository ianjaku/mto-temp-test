import * as React from "react";
import Icon from "../";

export const ICON_NAME = "file_upload";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const fileUpload = (style = {}) => <Icon name={ICON_NAME} style={style} />;

export default fileUpload;
