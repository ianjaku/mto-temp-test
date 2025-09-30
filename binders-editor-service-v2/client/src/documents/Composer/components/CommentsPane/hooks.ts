import { UseMutationResult, useMutation } from "@tanstack/react-query";
import { addComment, deleteComment } from "../../../../bindercomments/actions";
import { invalidateCommentThreads } from "../../../hooks";
import { useCommentContext } from "./CommentContext";

export type CreateCommentParams = {
    body: string;
    threadId?: string;
}

export const useCreateEditorComment = (): UseMutationResult<void, unknown, CreateCommentParams> => {
    const { accountId, binderId, selectedChunkId: chunkId, selectedLanguageCode: languageCode, userId } = useCommentContext();
    return useMutation({
        mutationFn: async (params) => {
            return addComment(accountId, binderId, chunkId, languageCode, params.threadId, userId, params.body);
        },
        onSuccess: () => invalidateCommentThreads(binderId),
    });
}

export type DeleteCommentParams = {
    commentId?: string;
    threadId?: string;
}

export const useDeleteEditorComment = (): UseMutationResult<void, unknown, DeleteCommentParams> => {
    const { accountId, binderId } = useCommentContext();
    return useMutation({
        mutationFn: async (params) => {
            return deleteComment(accountId, binderId, params.threadId, params.commentId);
        },
        onSuccess: () => invalidateCommentThreads(binderId),
    });
}
