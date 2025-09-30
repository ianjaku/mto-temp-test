import * as React from "react";
import Icon from "../";

export const ICON_NAME = "arrow_drop_up";
export const CLASSNAME = "dropup-arrow";

const DropupArrow: React.StatelessComponent<{ color?: string }> = ({ color }) => (
    <Icon
        className={CLASSNAME}
        color={color}
        name={ICON_NAME}
    />
);

export default DropupArrow;
