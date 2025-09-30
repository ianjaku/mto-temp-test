import { AccountStoreGetters } from "../stores/zustand/account-store";
import { FlashMessageActions } from "@binders/client/lib/react/flashmessages/actions";
import { ImageServiceClient } from "@binders/client/lib/clients/imageservice/v1/client";
import { VisualUsage } from "@binders/client/lib/clients/imageservice/v1/contract";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config";
import {
    handleVisualUploadError
} from "@binders/client/lib/clients/imageservice/v1/errorHandlers";

export const imageClient = ImageServiceClient.fromConfig(
    config,
    browserRequestHandler,
    AccountStoreGetters.getActiveAccountId,
);

export const uploadFeedbackAttachments = async (
    binderId: string,
    attachments: File[],
    onProgress: (visualId: string, percent: number) => void,
    onEnd: () => void,
    accountId: string,
    commentId: string,
): Promise<void> => {
    try {
        await imageClient.uploadVisual(
            binderId,
            attachments,
            accountId,
            onProgress,
            onEnd,
            {
                visualUsage: VisualUsage.ReaderComment,
                commentId,
            }
        );
    } catch (e) {
        handleVisualUploadError(e, msg => FlashMessageActions.error(msg));
    }
}
