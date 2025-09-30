import { removeOutOfBoundsFromReadyStates, visualKey } from "./helpers";
import { useMemo, useState } from "react";
import { FEATURE_STREAMING_DEBUG } from "@binders/client/lib/clients/accountservice/v1/contract";
import { VisualReadyState } from "./constants";
import { useIsAccountFeatureActive } from "../../../../../stores/hooks/account-hooks";

export type ReadyStates = Record<string, VisualReadyState>;

export type UpdateReadyStateFunction = (
        newState: VisualReadyState,
        chunkPosition: number,
        carouselPosition: number
    ) => void;

export const useReadyStates = (
    chunks: unknown[][],
    activeChunkIndex: number
): [ReadyStates, UpdateReadyStateFunction] => {
    const debugEnabled = useIsAccountFeatureActive(FEATURE_STREAMING_DEBUG);
    const [readyStates, setReadyStates] = useState<ReadyStates>({});

    const readyStatesWithoutOutOfBounds = useMemo(() => {
        return removeOutOfBoundsFromReadyStates(
            chunks,
            readyStates,
            activeChunkIndex
        );
    }, [activeChunkIndex, chunks, readyStates]);

    const updateReadyState: UpdateReadyStateFunction = (
        newState,
        chunkPosition,
        carouselPosition
    ) => {
        const key = visualKey({ chunkPosition, carouselPosition });
        const currentState = readyStates[key] ?? VisualReadyState.NONE
        if (currentState < newState) {
            setReadyStates(readyStates => ({
                ...readyStates,
                [key]: newState
            }));
            if (debugEnabled) {
                // eslint-disable-next-line no-console
                console.log(
                    "[STREAMING DEBUG] Updating ready state for", key,
                    "to", VisualReadyState[newState],
                    "from", VisualReadyState[currentState]
                );
            }
        }
    }

    return [readyStatesWithoutOutOfBounds, updateReadyState] as [ReadyStates, UpdateReadyStateFunction];
}
