import React from "react";
import startPlayingAnimation from "./startPlaying.json";
import { useLottie } from "lottie-react";

const StartPlaying: React.FC<{ height: string, width?: string }> = ({ height, width }) => {
    const { View, setSpeed } = useLottie({
        animationData: startPlayingAnimation,
        loop: false,
    }, {
        height,
        width
    });
    setSpeed(2.5);
    return <>{View}</>;
}

export default StartPlaying;