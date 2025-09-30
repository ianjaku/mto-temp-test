/* eslint-disable no-console */
import { ActionableComment, ActionableFeedback, FeedbackMap } from "./sendFeedbackDigest";
import {
    IBinderFeedback,
    UserOwner
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    BinderRepositoryServiceClient
} from "@binders/client/lib/clients/repositoryservice/v3/client";
import { CommentServiceClient } from "@binders/client/lib/clients/commentservice/v1/client";
import { IBinderComment } from "@binders/client/lib/clients/commentservice/v1/contract";
import { groupBy } from "ramda";

type CommentInfo = IBinderComment & {
    binderId: string;
    accountId: string;
    commentThreadOrigin: string;
}

const getActionableComments = async (
    comments: IBinderComment[],
    commentClient: CommentServiceClient,
    repoClient: BinderRepositoryServiceClient,
    accountId?: string,
): Promise<ActionableComment[]> => {
    const threadIds = comments.map(c => c.threadId);
    const uniqueThreadIds = Array.from(new Set(threadIds));
    const threads = await commentClient.findCommentThreads({ ids: uniqueThreadIds, accountId });
    const commentInfos = comments.reduce((acc, comment) => {
        const thread = threads.find(t => t.id === comment.threadId);
        if (thread) {
            acc.push({
                ...comment,
                binderId: thread.binderId,
                accountId: thread.accountId,
                commentThreadOrigin: thread.origin,
            });
        }
        return acc;
    }, [] as CommentInfo[]);
    return await filterAndExtendWithOwnership<CommentInfo, ActionableComment>(commentInfos, repoClient);
}

const getActionableFeedbacks = async (
    feedbacks: IBinderFeedback[],
    repoClient: BinderRepositoryServiceClient,
): Promise<ActionableFeedback[]> => {
    return await filterAndExtendWithOwnership<IBinderFeedback, ActionableFeedback>(feedbacks, repoClient);
}

const filterAndExtendWithOwnership = async <I extends IBinderFeedback | CommentInfo, R extends I & { userOwners: UserOwner[] }>(
    userFeedbackList: I[],
    repoClient: BinderRepositoryServiceClient,
): Promise<R[]> => {
    const actionableFeedbackList: R[] = [];
    const userFeedbackByAccountId = groupBy(feedback => feedback.accountId, userFeedbackList);
    for (const [accountId, userFeedbackInAccount] of Object.entries(userFeedbackByAccountId)) {
        const userFeedbackByBinderId = groupBy(feedback => feedback.binderId, userFeedbackInAccount);
        try {
            const bindersOwnerships = await repoClient.getOwnershipForItems(Object.keys(userFeedbackByBinderId), accountId, true);
            for (const binderOwnership of bindersOwnerships) {
                if (!binderOwnership.owners?.length) {
                    continue;
                }
                userFeedbackByBinderId[binderOwnership.itemId].forEach(item => actionableFeedbackList.push({
                    ...item,
                    userOwners: binderOwnership.owners,
                } as R));
            }
        } catch (e) {
            console.error(`Could not resolve ownership for user feedback with ids ${JSON.stringify(userFeedbackInAccount.map(feedback => feedback.id))} continuing...`);
            console.error(`Actual error ${e.message}`);
        }
    }
    return actionableFeedbackList;
}

export const createDigestInfo = async (
    comments: IBinderComment[],
    feedbacks: IBinderFeedback[],
    commentClient: CommentServiceClient,
    repoClient: BinderRepositoryServiceClient,
    accountId?: string,
): Promise<FeedbackMap> => {
    const actionableComments = await getActionableComments(comments, commentClient, repoClient, accountId);
    const actionableFeedbacks = await getActionableFeedbacks(feedbacks, repoClient);

    const feedbackMap: FeedbackMap = {};
    for (const comment of actionableComments) {
        for (const owner of comment.userOwners) {
            if (comment.userId === owner.id) continue;
            if (!feedbackMap[owner.id]) {
                feedbackMap[owner.id] = {
                    comments: [],
                    feedbacks: [],
                };
            }
            feedbackMap[owner.id].comments.push(comment);
        }
    }
    for (const feedback of actionableFeedbacks) {
        for (const owner of feedback.userOwners) {
            if (feedback.userId === owner.id) continue;
            if (!feedbackMap[owner.id]) {
                feedbackMap[owner.id] = {
                    comments: [],
                    feedbacks: [],
                };
            }
            feedbackMap[owner.id].feedbacks.push(feedback);
        }
    }
    return feedbackMap;
}
