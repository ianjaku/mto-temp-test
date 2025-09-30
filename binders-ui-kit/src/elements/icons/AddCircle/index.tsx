import * as React from "react";
import Icon from "../";
import vars from "../../../variables";
export const ICON_NAME = "add_circle_outline";

const style = {
    fontSize: "25px",
    color: vars.baseColor,
};

const addCircle = (): JSX.Element => <Icon name={ICON_NAME} style={style} />;

export default addCircle;