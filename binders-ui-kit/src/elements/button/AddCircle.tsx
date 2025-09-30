import * as React from "react";
import AddCircleButton from "../icons/AddCircle";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";

export interface IAddButtonProp {
    onClick: (e?) => void;
    tooltip?: string;
}

const BUTTON_STYLE = { width: "35px", height: "35px" };

const button: React.StatelessComponent<IAddButtonProp> = props => (
    <Tooltip title={props.tooltip}>
        <IconButton onClick={props.onClick} style={BUTTON_STYLE}>
            <AddCircleButton />
        </IconButton>
    </Tooltip>
);
export default button;
