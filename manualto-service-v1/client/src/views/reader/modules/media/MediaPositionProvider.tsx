import * as React from "react";
import { FC } from "react";

export interface MediaPosition {
    chunkPosition: number;
    carouselPosition: number;
}

const context = React.createContext<MediaPosition>({
    chunkPosition: -1,
    carouselPosition: -1,
});

export const MediaPositionProvider: FC<{
    chunkPosition: number;
    carouselPosition: number;
}> = (props) => {
    return (
        <context.Provider
            value={{
                chunkPosition: props.chunkPosition,
                carouselPosition: props.carouselPosition,
            }}
        >
            {props.children}
        </context.Provider>
    )
}

export const useMediaPosition = (): MediaPosition => {
    const position = React.useContext(context);
    if (position.carouselPosition === -1 && position.chunkPosition === -1) {
        throw new Error("No MediaPositionProvider found.");
    }
    return position;
}
