import * as React from "react";
import CircularProgress from "@material-ui/core/CircularProgress";
import colors from "../../variables";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const circularProgress = (
    className = "",
    style = {},
    size = 16,
    color = colors.accentColor
) => (
    <CircularProgress
        className={className}
        style={{ ...style, color }}
        size={size}
    />
);

export default circularProgress;
