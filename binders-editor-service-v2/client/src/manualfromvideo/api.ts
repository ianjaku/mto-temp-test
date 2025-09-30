import { FlashMessages } from "../logging/FlashMessages";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { client } from "../content/api";
import {
    handleVisualUploadError
} from "@binders/client/lib/clients/imageservice/v1/errorHandlers";
import i18next from "@binders/client/lib/react/i18n";


export interface VideoUploadResponse {
    videoId: string;
}

export interface DocumentGenerationResponse {
    binderId: string;
}

export async function APIUploadVideo(
    file: File,
    accountId: string
): Promise<string> {
    try {
        const result = await client.fileUpload(accountId, [file]);
        return result.fileId;
    } catch (e) {
        handleVisualUploadError(e, msg => FlashMessages.error(msg));
        throw e;
    }
}

export async function APIGenerateDocument(
    videoId: string,
    title: string,
    context: string,
    accountId: string,
    targetCollectionId: string,
    userId: string,
): Promise<string> {
    try {
        const result = await client.generateManual({
            accountId,
            collectionId: targetCollectionId,
            fileIds: [videoId],
            title,
            context,
            userId,
        });
        return result.id;
    } catch (error) {
        FlashMessages.error(i18next.t(TK.DocManagement_DocFromVideo_GenerateFailed));
        throw error;
    }
}
