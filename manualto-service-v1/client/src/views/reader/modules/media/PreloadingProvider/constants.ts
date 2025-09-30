
export enum VisualReadyState {
    NONE = 0,
    PREVIEW = 1,
    FULL = 2,
    ERROR = 3
}

// We only keep, at most, the next three, and the previous three chunks in the DOM
export const MAX_DISTANCE = 3

/**
 * If a chunk is more than MAX_ERROR_DISTANCE chunks away from the active chunk, 
 * and is in the error state, it will be unloaded
 * 
 * This gives errored chunks a chance to reload if the user revisits them.
 */
export const MAX_ERROR_DISTANCE = 1;

/**
 * This is the preloading order, the first position from the list will be the first position loaded
 * after the currently active visual has been loaded.
 * 
 * These positions are [chunkOffset, carouselOffset, ReadyState] in relation to the active position
 * Ex: [0, 1, Preview] -> activeChunkPos + 0, activeCarouselPos + 1, can load its preview
 */
export const PRELOAD_ORDER = [
    [0, 1, VisualReadyState.PREVIEW],
    [1, 0, VisualReadyState.PREVIEW],
    // We load the next chunk before the next carousel, to make manual.to seem smoother when scrolling
    [1, 0, VisualReadyState.FULL], 
    [0, 1, VisualReadyState.FULL],
    [2, 0, VisualReadyState.PREVIEW],
    [0, 2, VisualReadyState.PREVIEW],
    [-1, 0, VisualReadyState.PREVIEW],
    [-1, 0, VisualReadyState.FULL]
];

/**
 * This is the loading order for accounts where preloading is disabled.
 * We still need to load the previews for the next chunks, but we don't need anything else
 */
export const MINIMAL_PRELOAD_ORDER = [
    [0, 1, VisualReadyState.PREVIEW],
    [1, 0, VisualReadyState.PREVIEW],
    [-1, 0, VisualReadyState.PREVIEW],
]

/**
 * The amount of items from the preload order that will be loaded at once.
 * If preloading is disabled, this value will always default to 1
 */
export const PRELOAD_BATCH_SIZE = 2;
