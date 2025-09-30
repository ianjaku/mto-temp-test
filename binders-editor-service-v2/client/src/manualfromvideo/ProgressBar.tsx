import React from "react";
import cx from "classnames";
import "./ProgressBar.styl";

interface ProgressBarProps {
    className?: string;
    complete?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ className, complete }) => {
    return (
        <div className={`progress-bar-container ${className || ""}`}>
            <div className="progress-bar-track">
                <div className="progress-bar-fill">
                    <div className={cx("progress-bar-indicator", { "progress-bar-indicator--complete": complete })} />
                </div>
            </div>
        </div>
    );
};