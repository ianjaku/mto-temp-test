import * as React from "react";

export interface PaneProps {
    label: string;
    onClick?: () => boolean | void;
    testId?: string;
}

export const Pane: React.FC<PaneProps> = (props) => {
    return (
        <div className="tabs-pane">
            {props.children}
        </div>
    );
};
