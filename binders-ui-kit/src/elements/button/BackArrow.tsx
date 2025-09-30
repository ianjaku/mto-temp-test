import * as React from "react";
import BackArrow from "../icons/BackArrow";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";

export interface IBackArrowProp {
    onClick: (e?) => void;
    tooltip?: string;
}

//const BUTTON_STYLE = { padding: "4px", width: "35px", height: "35px", marginTop: "3px" };

const button: React.StatelessComponent<IBackArrowProp> = props => (
    <Tooltip title={props.tooltip}>
        <IconButton onClick={props.onClick}>
            <BackArrow />
        </IconButton>
    </Tooltip>
);
export default button;
