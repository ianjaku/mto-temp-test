import { FEATURE_READER_TITLE_CHUNK } from "@binders/client/lib/clients/accountservice/v1/contract";
import { useIsAccountFeatureActive } from "../../../../../stores/hooks/account-hooks";

/**
 * Determines the chunk number offset from the chunk index based on the activation status of the title chunk feature.
 *
 * This function checks whether the title chunk feature associated with the feature flag
 * `FEATURE_READER_TITLE_CHUNK` is active. The reason behind it is: title chunks don't have a number in the editor,
 * so we don't need to "adjust" other chunk indices to match the editor chunks anymore.
 *
 * @returns {0 | 1} The chunk number offset, either `0` or `1`, depending on the status of the title chunk feature.
 */
export const useChunkNumberOffset = (): 0 | 1 => {
    const isTitleChunkFeatureActive = useIsAccountFeatureActive(FEATURE_READER_TITLE_CHUNK);
    return isTitleChunkFeatureActive ? 0 : 1;
}