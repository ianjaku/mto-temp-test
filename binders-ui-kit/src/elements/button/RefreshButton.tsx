import * as React from "react";
import IconButton from "@material-ui/core/IconButton";
import Refresh from "../icons/Refresh";
import Tooltip from "@material-ui/core/Tooltip";
import colors from "../../variables";

export interface IRefreshButtonProps {
    onClick: () => void;
    tooltip?: string;
    disabled?: boolean;
    color?: string;
    hoverColor?: string;
}

const style = {
    height: "auto",
    padding: "0",
    width: "auto",
};

export const RefreshButton: React.FC<IRefreshButtonProps> = ({
    disabled,
    onClick,
    tooltip,
    color = colors.middleBlackColor,
    hoverColor = colors.accentColor,
}) => {
    const markup = (
        <IconButton
            style={style}
            onClick={onClick}
            disabled={disabled}
        >
            <Refresh
                color={color}
                hoverColor={hoverColor}
            />
        </IconButton>
    )
    return tooltip ?
        (
            <Tooltip title={tooltip}>
                {markup}
            </Tooltip>
        ) :
        markup;
};

export default RefreshButton;
