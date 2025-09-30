// Used to create unique identifiers for text to speech

import { StoryTile } from "../binders/contract";

export function createTTSChunkIdentifier(
    chunkId: string,
    html: string,
    language: string
): string {
    const hash = fastHash(html);
    return `C-${hash}-${chunkId}-${language}`;
}

export function createStoryTileIdentifier(storyTile: StoryTile): string {
    const hash = fastHash(storyTile.title);
    return `C-${hash}-${storyTile.key}-${storyTile.languageCode}`;
}

/**
 * Insecure, low-collision hash function for strings.
 */
function fastHash(str: string) {
    const length = str.length
    let hash = 0
    let index = 0;
    if (length > 0)
        while (index < length)
            hash = (hash << 5) - hash + str.charCodeAt(index++) | 0;
    return hash;
}
