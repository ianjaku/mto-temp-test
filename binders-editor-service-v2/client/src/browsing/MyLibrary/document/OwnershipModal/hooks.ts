import {
    APIGetOwnershipForItems,
    APISetOwnershipForItem
} from "./actions";
import {
    DetailedItemOwnership,
    ItemOwnership
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { UseMutationResult, UseQueryResult, useMutation, useQuery } from "@tanstack/react-query";
import { minutesToMilliseconds } from "date-fns";
import { queryClient } from "../../../../application";
import { useActiveAccountId } from "../../../../accounts/hooks";

const serviceName = "@binders/binders-v3";

export const useOwnershipForItem = (itemId?: string): UseQueryResult<DetailedItemOwnership> => {
    const result = useOwnershipForItems(itemId ? [itemId] : undefined);
    return {
        ...result,
        data: result?.data?.[0]
    } as UseQueryResult<DetailedItemOwnership>;
}

const useOwnershipForItems = (itemIds: string[]): UseQueryResult<DetailedItemOwnership[]> => {
    const accountId = useActiveAccountId();
    return useQuery({
        queryFn: async () => APIGetOwnershipForItems(itemIds, accountId),
        queryKey: [serviceName, "getOwnershipForItems", itemIds],
        enabled: !!itemIds?.length,
        staleTime: minutesToMilliseconds(1),
    });
}

export const useSetOwnershipForItemMutation = (): UseMutationResult => {
    const accountId = useActiveAccountId();
    return useMutation(
        async (params: { itemId: string, ownership: ItemOwnership }) => {
            return APISetOwnershipForItem(params.itemId, params.ownership, accountId);
        },
        {
            onSuccess: async () => {
                await queryClient.invalidateQueries([serviceName, "getOwnershipForItems"]);
            }
        });
}