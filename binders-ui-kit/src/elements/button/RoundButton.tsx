import * as React from "react";
import cx from "classnames";
import "./Button.styl";

export interface IRoundButtonProps extends React.HTMLProps<HTMLButtonElement> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    icon?: any;
}

const button: React.StatelessComponent<IRoundButtonProps> = ({ icon, className, ...props }) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const onDragStart = React.useCallback((e) => e.preventDefault(), []);
    return (
        <button
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            {...(props as any)}
            className={cx("button-round", className)}
            onDragStart={onDragStart}
        >
            {icon}
            {props.children}
        </button>
    );
};
export default button;
