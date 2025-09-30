import { MAX_DISTANCE, MAX_ERROR_DISTANCE, MINIMAL_PRELOAD_ORDER, PRELOAD_BATCH_SIZE, PRELOAD_ORDER } from "./constants";
import { MediaPosition } from "../MediaPositionProvider";
import { VisualReadyState } from "./constants";


export const visualKey = (visualPosition: MediaPosition): string => {
    return `${visualPosition.chunkPosition}.${visualPosition.carouselPosition ?? 0}`;
}

export const isEqualPosition = (a: MediaPosition, b: MediaPosition): boolean => {
    return a.chunkPosition === b.chunkPosition &&
        a.carouselPosition === b.carouselPosition;
}

/**
 * This counts how many chunks there are between chunkPositionA and chunkPositionB.
 */
const countChunksWithVisualsBetweenPositions = (
    chunkPositionA: number,
    chunkPositionB: number
): number => {
    const chunkPositionDifference = Math.abs(chunkPositionA - chunkPositionB);
    if (chunkPositionDifference <= 1) {
        return 0; // Chunk positions are same or one away
    }
    return chunkPositionDifference - 1;  // -1 to get the number in-between the two positions
}

// Unloads visuals that are more than MAX_DISTANCE chunks away from the active chunk
export const removeOutOfBoundsFromReadyStates = (
    chunks: unknown[][],
    readyStates: Record<string, VisualReadyState>,
    activeChunkPosition: number
): Record<string, VisualReadyState> => {
    const newReadyStates: typeof readyStates = {};
    for (let chunkPos = 0; chunkPos < chunks.length; chunkPos++) {
        for (let carouselPos = 0; carouselPos < chunks[chunkPos].length; carouselPos++) {
            if (chunks[chunkPos].length === 0) continue;

            const position = { chunkPosition: chunkPos, carouselPosition: carouselPos };
            
            // If the active chunk is MAX_DISTANCE chunks away from the current chunk, we unload it
            // We only count chunks that contain visuals
            const chunksWithVisualsBetweenPositions = countChunksWithVisualsBetweenPositions(chunkPos, activeChunkPosition);
            if (chunksWithVisualsBetweenPositions >= MAX_DISTANCE &&
                    getReadyState(readyStates, position) > VisualReadyState.NONE
            ) {
                newReadyStates[visualKey(position)] = VisualReadyState.NONE;

            // If the active chunk is MAX_ERROR_DISTANCE chunks away from the current chunk, 
            // AND this chunk is in an error state, we downgrade it to a preview state
            // We only count chunks that contain visuals
            } else if (chunksWithVisualsBetweenPositions >= MAX_ERROR_DISTANCE &&
                    getReadyState(readyStates, position) === VisualReadyState.ERROR
            ) {
                newReadyStates[visualKey(position)] = VisualReadyState.PREVIEW;
            } else {
                newReadyStates[visualKey(position)] = readyStates[visualKey(position)] ?? VisualReadyState.NONE
            }
        }
    }
    return newReadyStates;
}

export const getReadyState = (
    readyStates: Record<string, VisualReadyState>,
    visualPosition: MediaPosition,
    defaultValue = VisualReadyState.NONE
): VisualReadyState => {
    return readyStates[visualKey(visualPosition)] ?? defaultValue;
}

/**
 * Gets the chunk position that is `chunkOffset` chunks down from `startingChunkPosition`.
 * Skips chunks that don't have any images.
 * Returns imageChunks.length if there are no more chunks to be found.
 */
const getChunkPositionWithOffset = (
    imageChunks: unknown[][],
    startingChunkPosition: number,
    chunkOffset: number,
) => {
    if (chunkOffset <= 0) return startingChunkPosition;
    // If a negative offset is given, we have search backwards in the chunk list
    // If a position offset is given, we have to search forwards in the chunk list
    const addOrSubtract = chunkOffset > 0 ? 1 : -1;
    // Start from the chunk after the starting chunk
    // Loop until we find a chunk that has images, or until we hit imageChunks.length
    for (
        let chunkPos = startingChunkPosition + addOrSubtract;
        chunkPos < imageChunks.length;
        chunkPos += addOrSubtract
    ) {
        // If the chunk has no images, we skip it
        if (imageChunks[chunkPos].length === 0) continue;
        // If the chunk has images, we start over from that chunk with the remaining offset
        return getChunkPositionWithOffset(imageChunks, chunkPos, chunkOffset - addOrSubtract);
    }
    // We return null when there are no more chunks with images to be found for the current offset
    return null;
}

/**
 * Load the currently active chunk, or go through PRELOAD_ORDER to determine which chunks to load next.
 */
export const getPositionsCurrentlyAllowedToLoad = (
    activePosition: MediaPosition,
    readyStates: Record<string, VisualReadyState>,
    imageChunks: unknown[][],
    disablePreloading = false
): Record<string, VisualReadyState> => {
    if (imageChunks.length === 0) {
        return {};
    }
    if (!(imageChunks[activePosition.chunkPosition])) {
        // eslint-disable-next-line no-console
        console.error(`imageChunks[${activePosition.chunkPosition}] is undefined`, "imageChunks:", imageChunks);
        return {};
    }

    const activeReadyState = getReadyState(readyStates, activePosition);
    if (activeReadyState < VisualReadyState.FULL && imageChunks[activePosition.chunkPosition].length > 0) {
        return { [visualKey(activePosition)]: VisualReadyState.FULL };
    }

    const positionsToLoad: Record<string, VisualReadyState> = {};

    const preloadOrder = disablePreloading ? MINIMAL_PRELOAD_ORDER : PRELOAD_ORDER;
    for (const [chunkOffset, carouselOffset, allowedReadyState] of preloadOrder) {
        if (positionsToLoad[visualKey(activePosition)] != null) continue;

        const position: MediaPosition = {
            chunkPosition: getChunkPositionWithOffset(imageChunks, activePosition.chunkPosition, chunkOffset),
            carouselPosition: activePosition.carouselPosition + carouselOffset
        }
        if (position.chunkPosition == null) continue;
        
        if (imageChunks[position.chunkPosition] == null) continue;
        if (imageChunks[position.chunkPosition][position.carouselPosition] == null) continue;
        
        const chunkReadyState = getReadyState(readyStates, position);
        if (chunkReadyState >= allowedReadyState) continue;

        positionsToLoad[visualKey(position)] = allowedReadyState;

        if (disablePreloading && Object.keys(positionsToLoad).length >= 1) break;
        if (Object.keys(positionsToLoad).length >= PRELOAD_BATCH_SIZE) break;
    }
    
    return positionsToLoad;
}


