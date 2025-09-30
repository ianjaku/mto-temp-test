import * as React from "react";
import Close from "../icons/Close";
import IconButton from "@material-ui/core/IconButton";

export interface ICloseProps {
    onClick: () => void;
    className?: string;
}

const button: React.FC<ICloseProps> = props => (
    <IconButton onClick={props.onClick} className={props.className} >
        {Close({fontSize: "20px" })}
    </IconButton>
);
export default button;
