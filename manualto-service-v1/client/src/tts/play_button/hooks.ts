import { PlayState } from "../../stores/zustand/tts-store";
import React from "react";
import { usePrevious } from "@binders/client/lib/react/helpers/hooks";

export enum ButtonStates {
    START_PLAYING = "START_PLAYING",
    STOP_PLAYING = "STOP_PLAYING",
    STOPPED = "STOPPED",
}

export const useButtonState = (playState: PlayState): ButtonStates => {
    const prevPlayState = usePrevious(playState);
    const [ buttonState, setButtonState ] = React.useState(ButtonStates.STOPPED);
    React.useEffect(() => {
        if (buttonState === ButtonStates.START_PLAYING && playState !== PlayState.Playing) {
            setButtonState(ButtonStates.STOP_PLAYING);
        } else if (buttonState === ButtonStates.STOP_PLAYING && playState === PlayState.Playing) {
            setButtonState(ButtonStates.START_PLAYING);
        } else if (buttonState === ButtonStates.STOPPED && playState === PlayState.Playing) {
            setButtonState(ButtonStates.START_PLAYING);
        } else if (prevPlayState === PlayState.None && playState === PlayState.None) {
            // Resets animation on language change on the same binder
            setButtonState(ButtonStates.STOPPED);
        }
    }, [buttonState, playState, prevPlayState]);

    return buttonState;
}