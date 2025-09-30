import * as React from "react";
import ChunkSideButton from "./ChunkSideButton";
import SquigglyArrow from "../icons/SquigglyArrow";

export interface ITranslateChunkProps {
    isPositionLeft?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onClick?: any;
    className: string;
    disabled?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onMouseLeave?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onMouseEnter?: any;
}

const button: React.StatelessComponent<ITranslateChunkProps> = props => (
    <ChunkSideButton
        onMouseEnter={props.onMouseEnter}
        onMouseLeave={props.onMouseLeave}
        onClick={props.onClick}
        icon={SquigglyArrow(props.isPositionLeft)}
        className={props.className}
        disabled={props.disabled}
    />
);
export default button;
