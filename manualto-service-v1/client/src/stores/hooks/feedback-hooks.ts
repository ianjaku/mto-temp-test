import {
    FeedbackParams,
    IBinderFeedback
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { UseMutationResult, UseQueryResult, useMutation, useQuery } from "@tanstack/react-query";
import { AccountStoreGetters } from "../zustand/account-store";
import {
    BinderRepositoryServiceClient
} from "@binders/client/lib/clients/repositoryservice/v3/client";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { getServiceLocation } from "@binders/client/lib/config/configinstance";
import { sanitizeUserInput } from "@binders/ui-kit/lib/helpers/sanitization";
import { useActiveAccountId } from "./account-hooks";

const repositoryApi = new BinderRepositoryServiceClient(
    getServiceLocation("binders") + "/binders/v3",
    browserRequestHandler,
    AccountStoreGetters.getActiveAccountId,
);

export interface SendPublicationUserFeedbackParams extends FeedbackParams {
    publicationId: string,
}
export const useSendPublicationUserFeedback = (
    onUpdate: (feedback: IBinderFeedback) => void
): UseMutationResult<void, unknown, SendPublicationUserFeedbackParams> => {
    const accountId = useActiveAccountId();
    return useMutation({
        mutationFn: async (params) => {
            const { publicationId, ...feedbackParams } = params;
            if (feedbackParams.message) {
                feedbackParams.message = sanitizeUserInput(feedbackParams.message);
            }
            const feedback = await repositoryApi.createOrUpdateFeedback(accountId, publicationId, feedbackParams);
            onUpdate(feedback);
        },
    });
}

export const useMostRecentPublicationUserFeedback = (publicationId: string, hideFeedback = false): UseQueryResult<IBinderFeedback | null> => {
    return useQuery({
        queryFn: async () => {
            return publicationId == null || hideFeedback ?
                null :
                await repositoryApi.getMostRecentPublicationUserFeedback(publicationId);
        },
        queryKey: ["publicationFeedback", publicationId]
    });
}
