import * as React from "react";

interface IProps {
    title: string;
    children: React.ReactNode;
    isRow?: boolean;
}

const MTSettingsSection: React.FC<IProps> = ({ title, children, isRow }) => {
    return (
        <div className={`media-settings-setting ${isRow ? "media-settings-setting-as-row" : ""}`}>
            <label className="media-settings-setting-label">
                {title}
            </label>
            <div>
                {children}
            </div>
        </div>
    )
}

export default MTSettingsSection;
