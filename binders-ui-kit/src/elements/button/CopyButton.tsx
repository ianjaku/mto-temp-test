import * as React from "react";
import Copy from "../icons/Copy";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import colors from "../../variables";

export interface ICopyButtonProp {
    onClick: () => void;
    tooltip?: string;
}

const style = {
    height: "auto",
    padding: "0",
    width: "auto",
};

const copyButton = (onClick) => (
    <IconButton style={style} onClick={onClick}>
        <Copy color={colors.middleBlackColor} hoverColor={colors.accentColor} />
    </IconButton>
);


const button: React.FunctionComponent<ICopyButtonProp> = props => {
    return !props.tooltip ?
        copyButton(props.onClick) :
        (
            <Tooltip title={props.tooltip}>
                {copyButton(props.onClick)}
            </Tooltip>
        );
};

export default button;
