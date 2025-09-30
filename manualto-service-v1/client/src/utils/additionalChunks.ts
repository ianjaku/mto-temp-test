import { AccountFeatures, FEATURE_MANUALTO_CHUNK, FEATURE_READER_TITLE_CHUNK, FEATURE_READ_CONFIRMATION } from "@binders/client/lib/clients/accountservice/v1/contract";
import { ContentChunkKind } from "@binders/client/lib/clients/repositoryservice/v3/contract";

export function resolveAdditionalChunks(
    features: AccountFeatures,
    ratingEnabled?: boolean,
    readConfirmationEnabled?: boolean,
): ContentChunkKind[] {
    const chunks: ContentChunkKind[] = [];
    if (ratingEnabled) {
        chunks.push(ContentChunkKind.Feedback);
    }
    if (features.includes(FEATURE_MANUALTO_CHUNK)) {
        chunks.push(ContentChunkKind.MadeByManualTo);
    }
    if (features.includes(FEATURE_READER_TITLE_CHUNK)) {
        chunks.unshift(ContentChunkKind.TitleChunk);
    }
    if (features.includes(FEATURE_READ_CONFIRMATION) && readConfirmationEnabled) {
        chunks.push(ContentChunkKind.ReadConfirmation);
    }
    return chunks;
}
