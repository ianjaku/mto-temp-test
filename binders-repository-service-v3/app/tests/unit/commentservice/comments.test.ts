import {
    AuthorizationServiceContract,
    PermissionName,
    ResourceType
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { MockProxy, mock } from "jest-mock-extended";
import { BinderComment } from "../../../src/commentservice/repositories/models/binderComment";
import { CommentService } from "../../../src/commentservice/service";
import { CommentThread } from "../../../src/commentservice/repositories/models/commentThread";
import { CommentThreadOrigin } from "@binders/client/lib/clients/commentservice/v1/contract";
import { IBinderCommentsRepository } from "../../../src/commentservice/repositories/bindercomments";
import { ICommentThreadsRepository } from "../../../src/commentservice/repositories/commentthreads";

const COMMENT_ID = "cid-asdf";
const THREAD_ID = "tid-asdf";
const ACCOUNT_ID = "aid-asdf";
const USER_ID = "uid-asdf";
const BINDER_ID = "bid-asdf";

describe("deleteOwnComment", () => {
    let commentService: CommentService;
    let binderCommentsRepository: MockProxy<IBinderCommentsRepository>;
    let commentThreadsRepository: MockProxy<ICommentThreadsRepository>;
    let authorizationContract: MockProxy<AuthorizationServiceContract>;

    beforeEach(() => {
        binderCommentsRepository = mockWithFailure<IBinderCommentsRepository>();
        commentThreadsRepository = mockWithFailure<ICommentThreadsRepository>();
        authorizationContract = mockWithFailure<AuthorizationServiceContract>();
        commentService = new CommentService(
            mock(),
            mock(),
            binderCommentsRepository,
            commentThreadsRepository,
            authorizationContract,
            null,
            null,
            null,
            mock(),
        );
    });

    it("rejects when comment id was not found", async () => {
        binderCommentsRepository.getComments
            .calledWith(expect.objectContaining({ threadIds: [THREAD_ID] }))
            .mockResolvedValueOnce([]);

        await expect(() => commentService.deleteOwnComment(COMMENT_ID, THREAD_ID, ACCOUNT_ID, USER_ID, USER_ID))
            .rejects.toThrow(`Comment ${COMMENT_ID} not found`);
    });

    it("rejects when comment has another user than requester", async () => {
        const otherUserId = "other";
        const comment = createBinderComment({ id: COMMENT_ID, userId: otherUserId });
        binderCommentsRepository.getComments
            .calledWith(expect.objectContaining({ threadIds: [THREAD_ID] }))
            .mockResolvedValueOnce([comment]);

        await expect(() => commentService.deleteOwnComment(COMMENT_ID, THREAD_ID, ACCOUNT_ID, USER_ID, USER_ID))
            .rejects.toThrow(`Comment user does not match requester ${USER_ID}`);
    });

    it("rejects when thread with id is not found", async () => {
        const comment = createBinderComment({ id: COMMENT_ID, userId: USER_ID });
        binderCommentsRepository.getComments
            .calledWith(expect.objectContaining({ threadIds: [THREAD_ID] }))
            .mockResolvedValueOnce([comment]);
        commentThreadsRepository.findThreadById
            .calledWith(THREAD_ID)
            .mockResolvedValueOnce(null);

        await expect(() => commentService.deleteOwnComment(COMMENT_ID, THREAD_ID, ACCOUNT_ID, USER_ID, USER_ID))
            .rejects.toThrow(`Could not find the thread ${THREAD_ID}`);
    });

    it("rejects when user is lacking read permission on doc", async () => {
        const comment = createBinderComment({ id: COMMENT_ID, userId: USER_ID });
        binderCommentsRepository.getComments
            .calledWith(expect.objectContaining({ threadIds: [THREAD_ID] }))
            .mockResolvedValueOnce([comment]);
        const commentThread = createCommentThread();
        commentThreadsRepository.findThreadById
            .calledWith(THREAD_ID)
            .mockResolvedValueOnce(commentThread);
        authorizationContract.findResourcePermissions
            .calledWith(USER_ID, ResourceType.DOCUMENT, BINDER_ID, ACCOUNT_ID)
            .mockResolvedValueOnce([]);

        await expect(() => commentService.deleteOwnComment(COMMENT_ID, THREAD_ID, ACCOUNT_ID, USER_ID, USER_ID))
            .rejects.toThrow(`User ${USER_ID} is lacking read permission on ${BINDER_ID}`);
    });

    it("deletes comment & thread when there are no other comments", async () => {
        const comment = createBinderComment({ id: COMMENT_ID, userId: USER_ID });
        binderCommentsRepository.getComments
            .calledWith(expect.objectContaining({ threadIds: [THREAD_ID] }))
            .mockResolvedValueOnce([comment]);
        const commentThread = createCommentThread();
        commentThreadsRepository.findThreadById
            .calledWith(THREAD_ID)
            .mockResolvedValueOnce(commentThread);
        authorizationContract.findResourcePermissions
            .calledWith(USER_ID, ResourceType.DOCUMENT, BINDER_ID, ACCOUNT_ID)
            .mockResolvedValueOnce([PermissionName.VIEW]);
        binderCommentsRepository.deleteBinderComment
            .calledWith(COMMENT_ID)
            .mockResolvedValueOnce();
        commentThreadsRepository.deleteThread
            .calledWith(THREAD_ID)
            .mockResolvedValueOnce();

        await commentService.deleteOwnComment(COMMENT_ID, THREAD_ID, ACCOUNT_ID, USER_ID, USER_ID);
    });

    it("soft deletes comment when there are other comments in thread", async () => {
        const comment = createBinderComment({ id: COMMENT_ID, userId: USER_ID });
        const otherComment = createBinderComment({ id: "some_other_comment_id", userId: USER_ID });
        binderCommentsRepository.getComments
            .calledWith(expect.objectContaining({ threadIds: [THREAD_ID] }))
            .mockResolvedValueOnce([comment, otherComment]);
        const commentThread = createCommentThread();
        commentThreadsRepository.findThreadById
            .calledWith(THREAD_ID)
            .mockResolvedValueOnce(commentThread);
        authorizationContract.findResourcePermissions
            .calledWith(USER_ID, ResourceType.DOCUMENT, BINDER_ID, ACCOUNT_ID)
            .mockResolvedValueOnce([PermissionName.VIEW]);
        binderCommentsRepository.softDeleteComment
            .calledWith(COMMENT_ID)
            .mockResolvedValueOnce();

        await commentService.deleteOwnComment(COMMENT_ID, THREAD_ID, ACCOUNT_ID, USER_ID, USER_ID);
    });
});

const createBinderComment = ({ id, userId }): BinderComment => ({
    id: id ?? "",
    threadId: "",
    userId: userId ?? "",
    body: "",
    created: new Date(),
    updated: new Date(),
    isEdited: false,
});

function createCommentThread() {
    return new CommentThread(
        THREAD_ID,
        BINDER_ID,
        "0",
        "en",
        CommentThreadOrigin.Reader,
        false,
        null,
        null,
        new Date(),
        new Date(),
        "",
        "",
        ACCOUNT_ID
    );
}

const mockWithFailure = <T>(errorMessage = "not mocked") => mock<T>({} as never, {
    fallbackMockImplementation: () => {
        throw new Error(errorMessage);
    }
});
