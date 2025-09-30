import * as React from "react";
import Icon from "../";

export const ICON_NAME = "view_module";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const viewModule = ({color}) => (
    <Icon
        name={ICON_NAME}
        color={color}
    />
);

export default viewModule;
