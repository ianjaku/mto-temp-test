import * as React from "react";
import RoundButton, { IRoundButtonProps } from "./RoundButton";
import DeleteChunkIcon from "../icons/DeleteChunk";
import cx from "classnames";

const button: React.StatelessComponent<IRoundButtonProps> = props => (
    <RoundButton
        {...props}
        icon={<DeleteChunkIcon />}
        className={cx("button-delete-chunk", props.className)}
    />
);
export default button;
