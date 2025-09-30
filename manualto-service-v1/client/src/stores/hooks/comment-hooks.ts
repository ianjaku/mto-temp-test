import {
    CommentEdits,
    ReaderComment
} from "@binders/client/lib/clients/commentservice/v1/contract";
import { UseQueryResult, useMutation, useQuery } from "@tanstack/react-query";
import { useActiveAccountFeatures, useActiveAccountId } from "./account-hooks";
import {
    useCommentStagedAttachments,
    useReaderCommentsStoreActions
} from "../zustand/readerComments-store";
import { AccountStoreGetters } from "../zustand/account-store";
import { CommentServiceClient } from "@binders/client/lib/clients/commentservice/v1/client";
import { FEATURE_NOCDN } from "@binders/client/lib/clients/accountservice/v1/contract";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { getServiceLocation } from "@binders/client/lib/config/configinstance";
import { queryClient } from "../../react-query";
import { sanitizeUserInput } from "@binders/ui-kit/lib/helpers/sanitization";
import { uploadFeedbackAttachments } from "../../api/imageService";

const commentApi = new CommentServiceClient(
    getServiceLocation("binders") + "/comment/v1",
    browserRequestHandler,
    AccountStoreGetters.getActiveAccountId,
);

type CreateReaderCommentParams = {
    publicationId: string,
    binderId: string,
    chunkId: string,
    text: string,
}

type EditReaderCommentParams = {
    binderId: string,
    commentEdits: CommentEdits,
}

export const useCreateReaderComment = (): {
    createReaderComment: (params: CreateReaderCommentParams) => Promise<string>,
    isLoading: boolean
} => {
    const accountId = useActiveAccountId();
    const stagedAttachments = useCommentStagedAttachments();
    const stagedAttachmentsClientIds = stagedAttachments.map(attachment => attachment.clientId);
    const {
        clearUploadingAttachmentsWithIds,
        transitionNewCommentStagedAttachmentsToUploading,
        updateAttachmentUploadPercentage,
    } = useReaderCommentsStoreActions();

    const onEnd = async () => {
        await queryClient.refetchQueries(["readerComments"]);
        clearUploadingAttachmentsWithIds(stagedAttachmentsClientIds);
    }

    const { isLoading, mutateAsync } = useMutation({
        mutationFn: async (params: CreateReaderCommentParams) => {
            const sanitizedText = sanitizeUserInput(params.text);
            return commentApi.createReaderComment(
                params.publicationId,
                params.chunkId,
                accountId,
                sanitizedText,
            );
        },
        onSuccess: () => queryClient.invalidateQueries({
            queryKey: ["readerComments"]
        })
    });

    const createReaderComment = async (params: CreateReaderCommentParams): Promise<string> => {
        const commentId = await mutateAsync(params);
        if (stagedAttachments.length > 0) {
            uploadFeedbackAttachments(
                params.binderId,
                stagedAttachments,
                updateAttachmentUploadPercentage,
                onEnd,
                accountId,
                commentId,
            );
            transitionNewCommentStagedAttachmentsToUploading(commentId);
        }
        return commentId;
    };
    return { createReaderComment, isLoading };
}

export const useEditReaderComment = (threadId: string, commentId: string): {
    editReaderComment: (params: EditReaderCommentParams) => Promise<boolean>,
    isLoading: boolean
} => {
    const accountId = useActiveAccountId();
    const stagedAttachments = useCommentStagedAttachments(commentId);
    const stagedAttachmentsClientIds = stagedAttachments.map(attachment => attachment.clientId);
    const {
        clearUploadingAttachmentsWithIds,
        transitionExistingCommentStagedAttachmentsToUploading,
        updateAttachmentUploadPercentage,
    } = useReaderCommentsStoreActions();
    const onEnd = async () => {
        await queryClient.refetchQueries(["readerComments"]);
        clearUploadingAttachmentsWithIds(stagedAttachmentsClientIds);
    }

    const { isLoading, mutateAsync } = useMutation({
        mutationFn: async (commentEdits: CommentEdits) => {
            if (commentEdits.text) {
                commentEdits.text = sanitizeUserInput(commentEdits.text);
            }
            await commentApi.updateReaderComment(threadId, commentId, commentEdits, accountId);
        },
        onSuccess: () => queryClient.invalidateQueries({
            queryKey: ["readerComments"]
        }),
    });

    const editReaderComment = async (params: EditReaderCommentParams): Promise<boolean> => {
        try {
            await mutateAsync(params.commentEdits);
            if (stagedAttachments.length > 0) {
                uploadFeedbackAttachments(
                    params.binderId,
                    stagedAttachments,
                    updateAttachmentUploadPercentage,
                    onEnd,
                    accountId,
                    commentId,
                );
                transitionExistingCommentStagedAttachmentsToUploading(commentId);
            }
            return true;
        } catch (e) {
            return false;
        }
    };
    return { editReaderComment, isLoading }
};

export const useReaderComments = (
    binderId: string
): UseQueryResult<ReaderComment[]> => {
    const accountId = useActiveAccountId();
    const accountFeatures = useActiveAccountFeatures();
    return useQuery({
        queryFn: async () => {
            if (binderId == null) return [];
            return commentApi.getReaderComments(
                binderId,
                accountId,
                {
                    visualSearchOptions: {
                        cdnnify: !(accountFeatures.includes(FEATURE_NOCDN)),
                    },
                }
            );
        },
        queryKey: ["readerComments", binderId, accountId]
    });
}

export const useDeleteReaderComment = (commentToDelete: ReaderComment): () => Promise<void> => {
    const accountId = useActiveAccountId();
    const { mutateAsync } = useMutation({
        mutationFn: async () => {
            return commentApi.deleteOwnComment(commentToDelete.commentId, commentToDelete.threadId, accountId);
        },
        onSuccess: () => {
            queryClient.setQueryData(["readerComments", commentToDelete.binderId, accountId], data => {
                if (data == null) return data;
                const readerComments = data as ReaderComment[];
                return readerComments.filter(comment => comment.commentId !== commentToDelete.commentId);
            })
        },
        retry: 2,
    });
    return mutateAsync;
}
