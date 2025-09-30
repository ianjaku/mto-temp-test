import * as React from "react";
import RoundButton, { IRoundButtonProps } from "./RoundButton";
import ToggleNewCommentIcon from "../icons/ToggleNewComment";
import cx from "classnames";

const button: React.StatelessComponent<IRoundButtonProps> = props => (
    <RoundButton
        {...props}
        icon={<ToggleNewCommentIcon />}
        className={cx("button-comment", props.className)}
    />
);
export default button;
