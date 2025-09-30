export const BINDER_COMMENT_ID_PREFIX = "bcid-";

export interface BinderComment {
    id: string,
    threadId: string,
    userId: string,
    body: string,
    created: Date,
    updated: Date,
    isEdited: boolean,
    markedAsDeleted?: boolean,
}
