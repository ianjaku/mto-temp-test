import * as React from "react";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Icon = require("../../../../public/icons/pause-solid.svg");

export const PauseIcon: React.FC<{
    width?: string;
    height?: string;
    onClick?: (e: React.MouseEvent) => void;
}> = ({ width, height, onClick }) => {
    return (
        <img
            onClick={e => onClick && onClick(e)}
            style={{ width, height }}
            src={Icon}
        />
    )
}

export default PauseIcon;

