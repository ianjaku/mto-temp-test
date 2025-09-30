import * as React from "react";

export const PaneSection: React.FC<React.PropsWithChildren<{
    label: string,
    visible?: boolean,
    isVerticalAlignHack?: boolean
}>> = ({
    children,
    label,
    visible = true,
    isVerticalAlignHack = false,
}) => visible ?
    (
        <div className="settings-pane-section">
            <h3 style={isVerticalAlignHack ? { lineHeight: "42px" } : {}}>{label}</h3>
            {children || <></>}
        </div>
    ) :
    <></>;

export const TabPane: React.FC<React.PropsWithChildren<{ visible?: boolean }>> = ({ children, visible = true }) => {
    return visible ?
        (
            <div className="settings-pane">
                {children || <></>}
            </div>
        ) :
        <></>;
}

