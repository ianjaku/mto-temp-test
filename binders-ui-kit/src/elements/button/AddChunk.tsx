import * as React from "react";
import RoundButton, { IRoundButtonProps } from "./RoundButton";
import AddChunkIcon from "../icons/AddChunk";
import cx from "classnames";

const button: React.StatelessComponent<IRoundButtonProps> = props => (
    <RoundButton
        {...props}
        icon={<AddChunkIcon />}
        className={cx("button-add-chunk", props.className)}
    />
);
export default button;
