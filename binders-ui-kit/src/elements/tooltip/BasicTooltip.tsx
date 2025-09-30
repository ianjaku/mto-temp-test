import React, { ReactNode, forwardRef } from "react";
import Tooltip from "@material-ui/core/Tooltip";
import { makeStyles } from "@material-ui/core/styles";

// Override tooltip distance depending on device type
const useStyles = makeStyles({
    root: {
        "&": {
            margin: "6px 0",
            "@media (pointer:coarse)": {
                margin: "18px 0",
            }
        },
    }
})

export const BasicTooltip: React.FC<{
    title: string,
    isOpen: boolean
}> = ({
    children,
    title,
    isOpen,
}) => {
    const classes = useStyles();
    return (
        <Tooltip classes={{ tooltip: classes.root }} title={title} open={isOpen} placement="top">
            <WrappedChildren>
                {children}
            </WrappedChildren>
        </Tooltip>
    );
};

const WrappedChildren = forwardRef<HTMLSpanElement, { children: ReactNode }>(({ children, ...rest }, ref) => {
    return (
        <span {...rest} ref={ref}>
            {children}
        </span>
    );
});
