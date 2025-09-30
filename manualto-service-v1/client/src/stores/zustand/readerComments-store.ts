import {
    generateVisualThumb,
    isVideoMime
} from "@binders/client/lib/clients/imageservice/v1/visuals";
import UUID from "@binders/client/lib/util/uuid";
import { create } from "zustand";

export type StagedAttachment = File & {
    clientId: string;
    isVideo: boolean;
    previewSrc?: string;
};
export type UploadingAttachment = StagedAttachment & {
    commentId: string;
    percentUploaded: number;
};

/**
 * All existing comments have an id, but a new one will not have been assigned
 * one just yet, so we'll need to use a placeholder
 */
const NEW_COMMENT_ID = "NEW_COMMENT_ID";

export type ReaderCommentsStoreActions = {
    clearStagedAttachmentsForNewComment: () => void;
    clearStagedAttachmentsForNonNewComments: () => void;
    addFilesAsStagedAttachmentsForComment: (files: File[], commentId?: string) => Promise<void>;
    removeStagedAttachmentForComment: (clientId: string, commentId?: string) => void;
    transitionNewCommentStagedAttachmentsToUploading: (commentId: string) => void;
    transitionExistingCommentStagedAttachmentsToUploading: (commentId: string) => void;
    updateAttachmentUploadPercentage: (clientId: string, percentage: number) => void;
    clearUploadingAttachmentsWithIds: (clientIds: string[]) => void;
    setCommentEditStatus: (commentId: string) => void;
    clearCommentEditStatus: (commentId: string) => void;
    discardAllStagedChanges: () => void;
};

export type ReaderCommentsStoreState = {
    stagedAttachmentsMap: Map<string, StagedAttachment[]>;
    uploadingAttachmentsByClientId: Map<string, UploadingAttachment>;
    editedCommentId?: string;
    actions: ReaderCommentsStoreActions;
};

export const useReaderCommentsStore = create<ReaderCommentsStoreState>(set => ({
    stagedAttachmentsMap: new Map<string, StagedAttachment[]>(),
    uploadingAttachmentsByClientId: new Map<string, UploadingAttachment>(),
    editedCommentId: undefined,
    actions: {
        clearStagedAttachmentsForNewComment: () => set((prev) => {
            const stagedAttachments = new Map(prev.stagedAttachmentsMap);
            stagedAttachments.delete(NEW_COMMENT_ID);
            return { stagedAttachmentsMap: stagedAttachments };
        }),
        clearStagedAttachmentsForNonNewComments: () => set((prev) => {
            const stagedAttachmentsByCommentId = new Map();
            if (prev.stagedAttachmentsMap.get(NEW_COMMENT_ID) != null) {
                stagedAttachmentsByCommentId.set(NEW_COMMENT_ID, prev.stagedAttachmentsMap.get(NEW_COMMENT_ID));
            }
            return { stagedAttachmentsMap: stagedAttachmentsByCommentId };
        }),
        addFilesAsStagedAttachmentsForComment: async (files, commentId = NEW_COMMENT_ID) => {
            const stagedAttachmentsToAdd = await Promise.all(files.map(toStagedAttachment));
            set(prev => {
                const stagedAttachmentsMap = new Map(prev.stagedAttachmentsMap);
                const commentStagedAttachments = [...(prev.stagedAttachmentsMap.get(commentId) ?? []), ...stagedAttachmentsToAdd];
                stagedAttachmentsMap.set(commentId, commentStagedAttachments);
                return { stagedAttachmentsMap }
            });
        },
        removeStagedAttachmentForComment: (clientId: string, commentId = NEW_COMMENT_ID) => set(prev => {
            const stagedAttachmentsMap = new Map(prev.stagedAttachmentsMap);
            const commentStagedAttachments = (stagedAttachmentsMap.get(commentId) ?? [])
                .filter(attachment => attachment.clientId !== clientId);
            stagedAttachmentsMap.set(commentId, commentStagedAttachments);
            return { stagedAttachmentsMap };
        }),
        transitionNewCommentStagedAttachmentsToUploading: (commentId) => set(prev => {
            const stagedAttachmentsMap = new Map(prev.stagedAttachmentsMap);
            stagedAttachmentsMap.delete(NEW_COMMENT_ID);

            const uploadingAttachmentsByClientId = new Map(prev.uploadingAttachmentsByClientId);
            const uploadingAttachmentsForComment = (prev.stagedAttachmentsMap.get(NEW_COMMENT_ID) ?? [])
                .map(attachment => toUploadingAttachment(attachment, commentId));
            uploadingAttachmentsForComment.forEach(attachment => uploadingAttachmentsByClientId.set(attachment.clientId, attachment));

            return { stagedAttachmentsMap, uploadingAttachmentsByClientId };
        }),
        transitionExistingCommentStagedAttachmentsToUploading: (commentId) => set(prev => {
            const stagedAttachmentsMap = new Map(prev.stagedAttachmentsMap);
            stagedAttachmentsMap.delete(commentId);

            const uploadingAttachmentsByClientId = new Map(prev.uploadingAttachmentsByClientId);
            const uploadingAttachmentsForComment = (prev.stagedAttachmentsMap.get(commentId) ?? [])
                .map(attachment => toUploadingAttachment(attachment, commentId));
            uploadingAttachmentsForComment.forEach(attachment => uploadingAttachmentsByClientId.set(attachment.clientId, attachment));

            return { stagedAttachmentsMap, uploadingAttachmentsByClientId };
        }),
        updateAttachmentUploadPercentage: (clientId, percentage) => set((prev) => {
            if (!prev.uploadingAttachmentsByClientId.has(clientId)) {
                return {};
            }
            const uploadingAttachmentsByClientId = new Map(prev.uploadingAttachmentsByClientId);
            const updatedAttachment = setUploadingAttachmentPercentage(uploadingAttachmentsByClientId.get(clientId), percentage);
            uploadingAttachmentsByClientId.set(clientId, updatedAttachment);
            return { uploadingAttachmentsByClientId };
        }),
        clearUploadingAttachmentsWithIds: (clientIds) => set((prev) => {
            const uploadingAttachmentsByClientId = new Map(prev.uploadingAttachmentsByClientId);
            clientIds.forEach((clientId) => uploadingAttachmentsByClientId.delete(clientId));
            return { uploadingAttachmentsByClientId };
        }),
        setCommentEditStatus: (commentId) => set(() => ({
            editedCommentId: commentId
        })),
        clearCommentEditStatus: (commentId = NEW_COMMENT_ID) => set((prev) => {
            const stagedAttachmentsMap = new Map(prev.stagedAttachmentsMap);
            stagedAttachmentsMap.delete(commentId);
            return {
                editedCommentId: null,
                stagedAttachmentsMap,
            };
        }),
        discardAllStagedChanges: () => set(() =>
            ({ stagedAttachmentsMap: new Map(), editedCommentId: null })
        ),
    }
}));

export const useReaderCommentsStoreActions = (): ReaderCommentsStoreActions =>
    useReaderCommentsStore(store => store.actions);

const toStagedAttachment = async (file: File): Promise<StagedAttachment> =>
    Object.assign(file, {
        clientId: UUID.random().toString(),
        isVideo: isVideoMime(file),
        previewSrc: await generateVisualThumb(file),
    });

const toUploadingAttachment = (attachment: StagedAttachment, commentId: string): UploadingAttachment =>
    Object.assign(attachment, { commentId, percentUploaded: 0 });

const setUploadingAttachmentPercentage = (attachment: UploadingAttachment, percentUploaded: number): UploadingAttachment =>
    Object.assign(attachment, { percentUploaded });

export const useCommentStagedAttachments = (commentId = NEW_COMMENT_ID): StagedAttachment[] =>
    useReaderCommentsStore(store => store.stagedAttachmentsMap.get(commentId)) ?? [];

export const useCommentUploadingAttachments = (commentId: string): UploadingAttachment[] => {
    const allUploadingAttachments = useReaderCommentsStore(store => store.uploadingAttachmentsByClientId);
    return [...allUploadingAttachments.values()]
        .filter(attachment => attachment.commentId === commentId);
};

export const useIsCurrentCommentInEditMode = (commentId: string): boolean =>
    commentId === useReaderCommentsStore(store => store.editedCommentId);

export const useIsAnyCommentInEditMode = (): boolean =>
    useReaderCommentsStore(store => !!store.editedCommentId);
