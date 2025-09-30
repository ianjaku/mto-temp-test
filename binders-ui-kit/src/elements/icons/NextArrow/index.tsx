import * as React from "react";
import Icon from "../";

export const ICON_NAME = "keyboard_arrow_right";
export const CLASSNAME = "breadcrumbs-arrow";

const breadcrumbArrow = (): JSX.Element => (
    <Icon
        name={ICON_NAME}
        className={CLASSNAME}
    />
);

export default breadcrumbArrow;
