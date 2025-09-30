import * as React from "react";
import RoundButton, { IRoundButtonProps } from "./RoundButton";
import MergeChunkIcon from "../icons/MergeChunk";
import cx from "classnames";

const button: React.StatelessComponent<IRoundButtonProps> = props => (
    <RoundButton
        {...props}
        icon={<MergeChunkIcon />}
        className={cx("button-merge-chunks", props.className)}
    />
);
export default button;
