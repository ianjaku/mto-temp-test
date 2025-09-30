import * as React from "react";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import View from "../icons/View";
import colors from "../../variables";

export interface IAddButtonProp {
    hoverColor?: string;
    onClick: () => void;
    tooltip?: string;
}

const style = {
    height: "auto",
    padding: "0",
    width: "auto",
};

const viewButton = (onClick) => (
    <IconButton style={style} onClick={onClick}>
        <View color={colors.whiteColor} hoverColor={colors.accentColor} />
    </IconButton>
)

const button: React.StatelessComponent<IAddButtonProp> = props => {
    return !props.tooltip ?
        viewButton(props.onClick) :
        (
            <Tooltip title={props.tooltip}>
                {viewButton(props.onClick)}
            </Tooltip>
        );
};

export default button;
