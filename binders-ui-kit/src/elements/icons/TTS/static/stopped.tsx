import Icon from "../../../../../public/icons/tts-stopped.svg";
import React from "react";

const Stopped: React.FC<{
    width?: string;
    height?: string;
    onClick?: (e: React.MouseEvent) => void;
}> = ({ width, height, onClick }) => {
    return (
        <img
            onClick={e => onClick && onClick(e)}
            style={{width, height}}
            src={Icon}
            alt="TTS Stopped"
        />
    );
}

export default Stopped;