import React from "react";
import stopPlayingAnimation from "./stopPlaying.json";
import { useLottie } from "lottie-react";

const StopPlaying: React.FC<{ height: string, width?: string }> = ({ height, width }) =>{
    const { View, setSpeed } = useLottie({
        animationData: stopPlayingAnimation,
        loop: false,
    }, {
        height,
        width
    });
    setSpeed(2.5);
    return <>{View}</>;
}

export default StopPlaying;