import * as React from "react";
import Icon from "../";

export const ICON_NAME = "alternate_email";

const style = {
    fontSize: "20px",
};

const at = (): JSX.Element => <Icon name={ICON_NAME} style={style} />;

export default at;
