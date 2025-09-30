import * as React from "react";
import RoundButton from "./RoundButton";
import cx from "classnames";

export interface IChunkSideButtonProps {
    icon: JSX.Element;
    left?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onClick?: any;
    className: string;
    disabled?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onMouseLeave?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onMouseEnter?: any;
}

const ChunkSideButton: React.StatelessComponent<IChunkSideButtonProps> = props => (
    <RoundButton
        onMouseEnter={props.onMouseEnter}
        onMouseLeave={props.onMouseLeave}
        onClick={props.disabled ? Function.prototype : props.onClick}
        icon={props.icon}
        className={cx("side-chunk-button", { "side-chunk-button--disabled": props.disabled }, props.className)}
    />
);
export default ChunkSideButton;