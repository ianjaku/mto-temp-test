import * as React from "react";
import { FC } from "react";

export const InfoBannerWrapper: FC = ({ children }) => {
    return (
        <div className="infoBanner infoBanner--top infoBanner--danger">
            <div className="infoBanner-message-stack">
                {children}
            </div>
        </div>
    );
}