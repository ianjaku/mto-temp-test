import { ExtendedCommentThread } from "@binders/client/lib/clients/commentservice/v1/contract";

/**
 * Resolves the set of chunk IDs for which comments should be displayed.
 * 
 * This function combines historical chunk IDs with the currently selected chunk ID
 * and handles special cases for orphaned comment threads. When the selected chunk
 * is the first chunk (index 0), orphaned comment threads (those referring to 
 * chunks that no longer exist in the binder log) are included to ensure they
 * remain visible to users.
 * 
 * @param allThreads - Array of all comment threads available
 * @param historicalChunkIds - Set of chunk IDs that have historical significance
 * @param selectedChunkId - The ID of the currently selected chunk
 * @param selectedChunkIndex - The index position of the currently selected chunk (0-based)
 * @returns A set containing all chunk IDs for which comments should be shown
 */
export const resolveChunkIdsToShowCommentsFor = (
    allThreads: ExtendedCommentThread[],
    historicalChunkIds: Set<string>,
    selectedChunkId: string,
    selectedChunkIndex: number,
): Set<string> => {
    const uniqueHistoricalChunkIds = new Set(historicalChunkIds);
    if (selectedChunkIndex === 0 && allThreads) {
        // For some unknown reason, we could stumble upon comment threads that refer to chunks
        // that do not exist in the binder log, so we include orphaned threads in the first chunk
        allThreads
            .filter(thread => thread.isOrphaned)
            .forEach(thread => uniqueHistoricalChunkIds.add(thread.chunkId));
    }
    return selectedChunkId ? uniqueHistoricalChunkIds.add(selectedChunkId) : uniqueHistoricalChunkIds;
}
