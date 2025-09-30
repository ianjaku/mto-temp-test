import React from "react";
import cx from "classnames";

interface Props {
    message: string;
    rightAnchor?: boolean;
}

export const ToolbarTooltip: React.FC<Props> = (props) => {
    return (
        <div
            className={cx("toolbarTooltip", { "toolbarTooltip--rightAnchor": props.rightAnchor })}
        >
            {props.message}
        </div>
    )
}
