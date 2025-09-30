import * as React from "react";
import { useContext, useEffect, useState } from "react";
import { repeat } from "ramda";

export type ChunkState = {
    isReadOnly?: boolean;
    loadingState: ChunkLoadingState;
    hasAiFormattingState?: boolean;
}

export enum ChunkLoadingState {
    Loading,
    Loaded,
}

type ChunkStateContextType = {
    chunkStates: ChunkState[];
    setChunkStates: React.Dispatch<React.SetStateAction<ChunkState[]>>;
}

const ChunkStateContext = React.createContext<ChunkStateContextType>({
    chunkStates: [],
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    setChunkStates: () => { },
});

type Props = {
    children: React.ReactElement;
    chunkStates: ChunkState[];
};

export const ChunkStateContextProvider: React.FC<Props> = ({ children, chunkStates: initialChunkStates }: Props) => {
    const [chunkStates, setChunkStates] = useState(initialChunkStates);

    useEffect(() => setChunkStates(initialChunkStates), [initialChunkStates]);

    return (
        <ChunkStateContext.Provider value={{ chunkStates, setChunkStates }}>
            {children}
        </ChunkStateContext.Provider>
    );
}

export const useChunkStateContext = (): ChunkStateContextType => useContext(ChunkStateContext);

export const useChunkState = (chunkIdx: number): {
    chunkState: ChunkState;
    setChunkState: (chunkIdx: number, state: ChunkState) => void;
} => {
    const { chunkStates } = useChunkStateContext();
    const setChunkState = useChunkStateSetter();
    const chunkState = chunkStates[chunkIdx] ?? { loadingState: ChunkLoadingState.Loaded, hasAiFormattingState: false };
    return { chunkState, setChunkState };
}

export const useChunkStateSetter = (): (chunkIdx: number, state: ChunkState) => void => {
    const { setChunkStates } = useChunkStateContext();
    return (chunkIdx: number, state: ChunkState) => {
        setChunkStates(prev => [
            ...prev.slice(0, chunkIdx),
            state,
            ...prev.slice(chunkIdx + 1)
        ])
    }
}

export const useAllChunksState = (): {
    setChunksStates: (state: ChunkState) => void;
} => {
    const { setChunkStates } = useChunkStateContext();
    const setChunksStates = (newState: ChunkState) => {
        setChunkStates(prev => repeat(newState, prev.length))
    }
    return { setChunksStates };
}
