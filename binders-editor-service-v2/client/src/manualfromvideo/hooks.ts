import { APIGenerateDocument, APIUploadVideo } from "./api";
import { EditorEvent, captureFrontendEvent } from "@binders/client/lib/thirdparty/tracking/capture";
import { UseMutationOptions, UseMutationResult, useMutation } from "@tanstack/react-query";
import { ManualFromVideoState } from "./ManualFromVideo";
import { useActiveAccountId } from "../accounts/hooks";
import { useActiveCollection } from "../browsing/hooks";
import { useCurrentUserId } from "../users/hooks";
import { useEffect } from "react";
import { usePrevious } from "@binders/client/lib/react/helpers/hooks";

export function useRedirectWhenGenerated(
    state: ManualFromVideoState,
    onRedirect: () => void,
    binderId?: string
) {
    const prevState = usePrevious(state);
    useEffect(() => {
        if (state === ManualFromVideoState.Generated && prevState !== ManualFromVideoState.Generated && binderId) {
            onRedirect();
        }
    }, [binderId, onRedirect, prevState, state]);
}

export interface UploadVideoParams {
    file: File;
}

export interface GenerateDocumentParams {
    videoId: string;
    title: string;
    context: string;
    collectionId: string;
}

export function useUploadVideo(
    options?: UseMutationOptions<string, Error, UploadVideoParams>
): UseMutationResult<string, Error, UploadVideoParams> {
    const accountId = useActiveAccountId();

    return useMutation<string, Error, UploadVideoParams>({
        ...options,
        mutationFn: async ({ file }) => {
            const startedAt = Date.now();
            const res = await APIUploadVideo(file, accountId);
            captureFrontendEvent(EditorEvent.AiGenerateManualUploadLLmFile, {
                durationMs: Date.now() - startedAt,
                fileSizeBytes: file.size,
                fileType: file.type,
            });
            return res;
        },
        onSuccess: (videoId, params, ctx) => {
            options?.onSuccess?.(videoId, params, ctx);
        },
        onError: (error, params, ctx) => {
            options?.onError?.(error, params, ctx);
        },
    });
}

export function useGenerateDocument(
    options?: UseMutationOptions<string, Error, GenerateDocumentParams>
): UseMutationResult<string, Error, GenerateDocumentParams> {
    const accountId = useActiveAccountId();
    const activeCollection = useActiveCollection();
    const userId = useCurrentUserId();
    return useMutation<string, Error, GenerateDocumentParams>({
        ...options,
        mutationFn: async ({ videoId, title, context, collectionId }) => {
            const startedAt = Date.now();
            const targetCollection = collectionId || activeCollection;
            const binderId = await APIGenerateDocument(videoId, title, context, accountId, targetCollection, userId);
            captureFrontendEvent(EditorEvent.AiGenerateManualSuccess, {
                durationMs: Date.now() - startedAt,
                binderId,
            });
            return binderId;
        },
        onSuccess: (binderId, params, ctx) => {
            options?.onSuccess?.(binderId, params, ctx);
        },
        onError: (error, params, ctx) => {
            options?.onError?.(error, params, ctx);
        },
    });
}
