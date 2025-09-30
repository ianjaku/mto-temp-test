import { IBoundary } from "@binders/client/lib/highlight/highlight";
import { ITTSTrack } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { create } from "zustand";

export enum PlayState {
    None,
    Playing,
    Ended,
    Paused
}

export interface PlayData {
    track: ITTSTrack;
    audio: HTMLAudioElement;
    destructor: () => void;
}

export type PlayStateRequest = {
    identifier: string;
    playState: PlayState;
};
export type BoundaryRequest = {
    identifier: string;
    boundary: IBoundary;
};

export type TtsActions = {
    setPlayData: (playData: PlayData) => void;
    setPlayState: (playStateRequest: PlayStateRequest) => void;
    setLanguages: (languages: string[]) => void;
    setBoundary: (b: BoundaryRequest) => void;
};

export type TtsStoreState = {
    playData: PlayData | null;
    playState: PlayState;
    languages: string[];
    boundary: IBoundary | null;
    actions: TtsActions;
};

const useTtsStore = create<TtsStoreState>(set => ({
    playData: null,
    playState: PlayState.None,
    languages: [],
    boundary: null,

    actions: {
        setPlayData: newPlayData => set(state => {
            const currentPlayData = state.playData;
            currentPlayData?.destructor();
            return {
                ...state,
                boundary: null,
                playData: newPlayData
            };
        }),
        setPlayState: playStateRequest => set(state => {
            const { identifier, playState: newPlayState } = playStateRequest;
            if (identifier !== state.playData?.track?.identifier) {
                return state;
            }
            return {
                ...state,
                playState: newPlayState
            }
        }),
        setLanguages: newLanguages => set(state => ({
            ...state,
            languages: newLanguages
        })),
        setBoundary: boundaryRequest => set(state => {
            const { identifier, boundary: newBoundary } = boundaryRequest;
            if (identifier !== state.playData?.track?.identifier) {
                return state;
            }
            return {
                ...state,
                boundary: newBoundary
            };
        }),
    }
}));

export const useBoundary = (): IBoundary|null => useTtsStore(store => store.boundary);
export const usePlayData = (): PlayData|null => useTtsStore(store => store.playData);
export const usePlayState = (): PlayState => useTtsStore(store => store.playState);
export const useLanguages = (): string[] => useTtsStore(store => store.languages);

export const useActions = (): TtsActions => useTtsStore(store => store.actions);
