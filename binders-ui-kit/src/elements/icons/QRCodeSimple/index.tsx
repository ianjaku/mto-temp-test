import * as React from "react";
import Icon from "../";

export const ICON_NAME = "qr_code";

const qrCodeSimple = (style = {}): JSX.Element => <Icon name={ICON_NAME} style={style} />;

export default qrCodeSimple;
