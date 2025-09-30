import {
    IAllDocumentStatistics,
    ICollectionLanguageStatistics,
    IUserActionFilter,
    IUserActionSummary,
    UserActionsFindResult
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { UseQueryResult, useQuery } from "@tanstack/react-query";
import { TrackingServiceClient } from "@binders/client/lib/clients/trackingservice/v1/client";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config/configinstance";
import { useActiveAccountId } from "../accounts/hooks";

const client = TrackingServiceClient.fromConfig(config, "v1", browserRequestHandler);
const serviceName = "@binders/tracking-v1";

export const useCollectionLanguageStatistics = (
    collectionId: string | undefined,
): UseQueryResult<ICollectionLanguageStatistics> => {
    const accountId = useActiveAccountId();
    return useQuery({
        queryFn: async () => client.collectionLanguageStatistics(collectionId, {}, accountId),
        queryKey: [serviceName, "collectionLanguageStatistics", collectionId],
        enabled: !!collectionId,
    });
}

export const useAllBinderStatistics = (
    binderId: string | undefined,
): UseQueryResult<IAllDocumentStatistics> => {
    const accountId = useActiveAccountId();
    return useQuery({
        queryFn: async () => client.allBinderStatistics(binderId, {}, accountId),
        queryKey: [serviceName, "allBinderStatistics", binderId],
        enabled: !!binderId,
    });
}

export const useLastUserActionsAggregationTime = (): UseQueryResult<Date> => {
    const accountId = useActiveAccountId();
    return useQuery({
        queryFn: async () => client.lastUserActionsAggregationTime(accountId),
        queryKey: [serviceName, "lastUserActionsAggregationTime", accountId],
        enabled: !!accountId,
    });
}

export const useUserActions = (
    userActionsFilter: Omit<IUserActionFilter, "accountId">
): UseQueryResult<UserActionsFindResult<IUserActionSummary>> => {
    const accountId = useActiveAccountId();
    return useQuery({
        queryFn: async () => client.searchUserActions({
            ...userActionsFilter,
            accountId,
        }),
        queryKey: [serviceName, "searchUserActions", userActionsFilter],
        enabled: !!userActionsFilter && !!accountId,
    });
}
