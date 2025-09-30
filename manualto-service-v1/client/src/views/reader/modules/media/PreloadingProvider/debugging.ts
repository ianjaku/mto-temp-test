/* eslint-disable no-console */
import { getReadyState, isEqualPosition } from "./helpers";
import { IBinderVisual } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { MediaPosition } from "../MediaPositionProvider";
import { VisualReadyState } from "./constants";
import { equals } from "ramda";


// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lastData: any = null;

export const printPreloadInfo = (
    imageChunks: IBinderVisual[][],
    readyStates: Record<string, VisualReadyState>,
    allowedReadyStates: Record<string, VisualReadyState>,
    activePosition: MediaPosition
): void => {
    const result = [];
    for (const chunkPosition in imageChunks) {
        const line = [];
        if (imageChunks[chunkPosition].length === 0) {
            line.push("-EMPTY-");
        }
        for (const carouselPosition in imageChunks[chunkPosition]) {
            const visualPosition = {
                chunkPosition: Number.parseInt(chunkPosition),
                carouselPosition: Number.parseInt(carouselPosition)
            };
            const state = getReadyState(readyStates, visualPosition);
            const allowedState = getReadyState(allowedReadyStates, visualPosition, null);
            const activeVisualIndicator = isEqualPosition(visualPosition, activePosition) ? "> " : "";
            const changingStateIndicator = allowedState != null ? `-> ${VisualReadyState[allowedState]}` : "";
            line.push(`${activeVisualIndicator}${VisualReadyState[state]} ${changingStateIndicator}`);
        }
        result.push(line);
    }
    if (equals(result, lastData)) return;
    console.table(result);
    lastData = result;
}
