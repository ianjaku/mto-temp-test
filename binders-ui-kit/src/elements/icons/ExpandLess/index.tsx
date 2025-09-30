import * as React from "react";
import Icon from "../";

export const ICON_NAME = "expand_less";

const ExpandLess: React.StatelessComponent<{ color?: string }> = ({ color }) => (
    <Icon
        color={color}
        name={ICON_NAME}
    />
);

export default ExpandLess;
