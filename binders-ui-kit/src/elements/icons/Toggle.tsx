import * as React from "react";
import Icon from "./index";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const comment = (
    on: boolean,
    style = {},
    color = "",
) => <Icon name={on ? "toggle_on" : "toggle_off"} style={style} color={color} />;

export default comment;
