import * as React from "react";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Icon = require("../../../../public/icons/play-solid.svg");

export const PlayArrowIcon: React.FC<{
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

export default PlayArrowIcon;

