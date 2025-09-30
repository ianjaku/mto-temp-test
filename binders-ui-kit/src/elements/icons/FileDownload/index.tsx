import * as React from "react";
import Icon from "../";

export const ICON_NAME = "file_download";

const fileDownload = (style = {}): JSX.Element => <Icon name={ICON_NAME} style={style} />;

export default fileDownload;
