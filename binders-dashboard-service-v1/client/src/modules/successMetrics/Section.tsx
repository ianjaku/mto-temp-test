import * as React from "react";

export const Section: React.FC<{title?: string}> = ({ title, children }) => {
    return (
        <div className="account-metrics-section">
            <h2>{title}</h2>
            {children}
        </div>
    );
};