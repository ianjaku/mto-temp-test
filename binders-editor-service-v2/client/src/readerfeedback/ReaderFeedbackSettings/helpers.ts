import { ReaderFeedbackConfig } from "@binders/client/lib/clients/repositoryservice/v3/contract";

const isDefined = (v: boolean | null | undefined) => typeof v === "boolean";

export function hasAnyReaderFeedbackDefined(
    readerFeedbackConfig?: ReaderFeedbackConfig
): boolean {
    if (!readerFeedbackConfig) return false;
    return hasReaderCommentsDefined(readerFeedbackConfig) ||
        hasReaderRatingDefined(readerFeedbackConfig) ||
        hasReadConfirmationDefined(readerFeedbackConfig);
}

export function hasReaderCommentsDefined(
    readerFeedbackConfig?: ReaderFeedbackConfig
): boolean {
    if (!readerFeedbackConfig) return false;
    return isDefined(readerFeedbackConfig?.readerCommentsEnabled);
}

export function hasReaderRatingDefined(
    readerFeedbackConfig?: ReaderFeedbackConfig
): boolean {
    if (!readerFeedbackConfig) return false;
    return isDefined(readerFeedbackConfig?.readerRatingEnabled);
}

export function hasReadConfirmationDefined(
    readerFeedbackConfig?: ReaderFeedbackConfig
): boolean {
    if (!readerFeedbackConfig) return false;
    return isDefined(readerFeedbackConfig?.readConfirmationEnabled);
}