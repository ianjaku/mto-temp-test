import * as React from "react";
import { CSSProperties } from "@material-ui/core/styles/withStyles";
import Icon from "../";

export const ICON_NAME = "download";

const download = (style: CSSProperties = {}): JSX.Element => <Icon name={ICON_NAME} style={style} />;

export default download;
