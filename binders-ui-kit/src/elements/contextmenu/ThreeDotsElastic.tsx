import * as React from "react";
import { FC } from "react";
import cx from "classnames";

import "./ThreeDotsElastic.styl";

export const ThreeDotsElastic: FC<{
    accent?: boolean;
    animated?: boolean;
}> = ({ accent, animated }) => {
    return (
        <div className={cx("dot-elastic-container", { accent, animated })}>
            <div className="dot-elastic"></div>
        </div>
    )
}
