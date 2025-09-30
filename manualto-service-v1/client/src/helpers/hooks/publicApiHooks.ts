import { ApiGeneratePublicApiToken, ApiGetPublicApiToken } from "../../api/publicApiService";
import { UseMutationResult, UseQueryResult, useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "../../react-query";

const publicApi = "publicApiV1";

export const usePublicApiToken = (
    accountId: string
): UseQueryResult<string, Error> => {
    return useQuery({
        queryKey: [publicApi, "publicApiToken", accountId],
        queryFn: () => ApiGetPublicApiToken(accountId)
    });
}

export const useGeneratePublicApiToken = (
    accountId: string
): UseMutationResult<string, Error> => {
    return useMutation({
        mutationFn: () => ApiGeneratePublicApiToken(accountId),
        onSuccess: () => queryClient.invalidateQueries({
            queryKey: [publicApi, "publicApiToken"]
        })
    });
}
