import * as React from "react";
import IconButton from "@material-ui/core/IconButton";
import Pdf from "../icons/Pdf";
import Tooltip from "@material-ui/core/Tooltip";
import colors from "../../variables";

export interface IAddButtonProp {
    onClick: () => void;
    tooltip?: string;
}

const style = {
    height: "auto",
    padding: "0",
    width: "auto",
};

const pdfButton = (onClick) => (
    <IconButton style={style} onClick={onClick}>
        <Pdf color={colors.whiteColor} hoverColor={colors.accentColor} />
    </IconButton>
);


const button: React.FunctionComponent<IAddButtonProp> = props => {
    return !props.tooltip ?
        pdfButton(props.onClick) :
        (
            <Tooltip title={props.tooltip}>
                {pdfButton(props.onClick)}
            </Tooltip>
        );
};

export default button;
