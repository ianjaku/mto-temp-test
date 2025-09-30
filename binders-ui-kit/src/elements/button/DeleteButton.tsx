import * as React from "react";
import Tooltip, { TooltipPosition, hideTooltip, showTooltip } from "../tooltip/Tooltip";
import Delete from "../icons/Delete";
import IconButton from "@material-ui/core/IconButton";
import colors from "../../variables";
import cx from "classnames";

export interface IDeleteButtonProps {
    onClick: () => void;
    tooltip?: string;
    isDisabled?: boolean;
    className?: string;
}

const style = {
    cursor: undefined,
    height: "auto",
    padding: "0",
    width: "auto",
};

const iconColor = isDisabled => isDisabled ? colors.disabledColor : colors.whiteColor;

const button: React.FC<IDeleteButtonProps> = (props: IDeleteButtonProps) => {
    const { tooltip, isDisabled } = props;
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const tooltipRef = React.useRef(null);

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const renderTooltip = React.useCallback(() => (
        tooltip && <Tooltip key="tt" ref={tooltipRef} message={tooltip} />
    ), [tooltip, tooltipRef]);

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const handleMouseEnter = React.useCallback((e) => {
        showTooltip(e, tooltipRef.current, TooltipPosition.BOTTOM);
    }, [tooltipRef]);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const handleMouseLeave = React.useCallback((e) => {
        hideTooltip(e, tooltipRef.current);
    }, [tooltipRef]);
    return (
        <>
            <IconButton
                className={cx(props.className, "button", "button--delete", { "button--disabled": isDisabled })}
                style={{ ...style, color: iconColor(props.isDisabled) }}
                onClick={props.isDisabled ? undefined : props.onClick}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {Delete({}, colors.accentColor)}
            </IconButton>
            {renderTooltip()}
        </>
    );
};


export default button;
