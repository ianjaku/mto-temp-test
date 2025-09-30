/* eslint-disable quotes */
import React from "react";
import "./RoundedCornersOnly.styl";

interface Props {
    children: React.ReactNode;
}

export const RoundedCornersOnly: React.FC<Props> = ({ children }) => {
    return (
        <div className="rounded-corners-only">
            {children}
        </div>
    )
}