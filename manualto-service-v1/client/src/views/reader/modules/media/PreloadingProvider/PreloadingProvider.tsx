import * as React from "react";
import { FC, createContext } from "react";
import {
    FEATURE_STREAMING_DEBUG
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { IBinderVisual } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { MediaPosition } from "../MediaPositionProvider";
import { VisualReadyState } from "./constants";
import { getPositionsCurrentlyAllowedToLoad } from "./helpers";
import { printPreloadInfo } from "./debugging";
import { useIsAccountFeatureActive } from "../../../../../stores/hooks/account-hooks";
import { useIsPreloadingDisabled } from "./hooks";
import { useReadyStates } from "./useReadyStates";

export interface PreloadingContext {
    imageChunks: IBinderVisual[][],
    readyStates: {[chunkPosDotCarouselPos: string]: VisualReadyState},
    carouselPositions: {[chunkPosition: number]: number},
    activeChunkPosition: number
    updateReadyState: (
        readyState: VisualReadyState,
        chunkPosition: number,
        carouselPosition: number,
    ) => unknown;
    allowedReadyStates: {[chunkPosDotCarouselPos: string]: VisualReadyState}
}

export const preloadingContext = createContext<PreloadingContext>({
    readyStates: {},
    imageChunks: [],
    carouselPositions: {},
    activeChunkPosition: 0,
    updateReadyState: () => {
        throw new Error("No PreloadingProvider found.")
    },
    allowedReadyStates: {}
});

export const PreloadingProvider: FC<{
    chunks: IBinderVisual[][];
    carouselPositions: Record<number, number>;
    activeChunkIndex: number;
}> = (props) => {
    const preloadingDisabled = useIsPreloadingDisabled();
    const debugEnabled = useIsAccountFeatureActive(FEATURE_STREAMING_DEBUG);
    const [readyStates, setReadyState] = useReadyStates(props.chunks, props.activeChunkIndex);

    const activePosition = React.useMemo<MediaPosition>(() => ({
        chunkPosition: props.activeChunkIndex,
        carouselPosition: props.carouselPositions[props.activeChunkIndex] ?? 0
    }), [props.activeChunkIndex, props.carouselPositions]);

    const allowedReadyStates = React.useMemo(() => {
        return getPositionsCurrentlyAllowedToLoad(
            activePosition,
            readyStates,
            props.chunks,
            preloadingDisabled
        );
    }, [activePosition, readyStates, props.chunks, preloadingDisabled]);

    const contextValues: PreloadingContext = {
        readyStates,
        imageChunks: props.chunks,
        activeChunkPosition: props.activeChunkIndex,
        carouselPositions: props.carouselPositions,
        updateReadyState: (readyState, chunkPosition, carouselPosition) => (
            setReadyState(readyState, chunkPosition, carouselPosition)
        ),
        allowedReadyStates,
    };

    React.useEffect(() => {
        if (debugEnabled) {
            printPreloadInfo(
                props.chunks,
                readyStates,
                allowedReadyStates,
                activePosition
            );
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [readyStates, props.activeChunkIndex, props.carouselPositions]);
    
    return (
        <preloadingContext.Provider value={contextValues}>
            {props.children}
        </preloadingContext.Provider>
    )
}
