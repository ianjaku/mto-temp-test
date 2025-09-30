import { UseQueryResult, useQuery } from "@tanstack/react-query";
import AccountStore from "../../../../accounts/store";
import { BinderRepositoryServiceClient } from "@binders/client/lib/clients/repositoryservice/v3/client";
import { IBinderFeedback } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { getServiceLocation } from "@binders/client/lib/config/configinstance";

const repositoryApi = new BinderRepositoryServiceClient(
    getServiceLocation("binders") + "/binders/v3",
    browserRequestHandler,
    AccountStore.getActiveAccountId.bind(AccountStore),
);

export const useFeedbackList = (binderId: string): UseQueryResult<IBinderFeedback[]> => {
    return useQuery({
        queryFn: async () => {
            if (binderId == null) return [];
            const feedbacks = await repositoryApi.getBinderFeedbacks(binderId);
            return feedbacks;
        },
        queryKey: ["binderFeedback", binderId]
    });
}
