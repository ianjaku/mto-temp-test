import * as React from "react";
import Icon from "../";

export const ICON_NAME = "arrow_drop_down";
export const CLASSNAME = "dropdown-arrow";

const DropdownArrow: React.StatelessComponent<{ color?: string }> = ({ color }) => (
    <Icon
        className={CLASSNAME}
        color={color}
        name={ICON_NAME}
    />
);

export default DropdownArrow;
