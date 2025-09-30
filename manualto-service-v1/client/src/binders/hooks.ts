import { UseQueryResult, useQuery } from "@tanstack/react-query";
import { APIGetOwnershipForItem } from "./api";
import { DetailedItemOwnership, } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { useActiveAccountId } from "../stores/hooks/account-hooks";
import { useCurrentUser } from "../stores/hooks/user-hooks";

const serviceName = "@binders/binders-v3";

export const useOwnershipForItem = (
    itemId?: string
): UseQueryResult<DetailedItemOwnership> => {
    const accountId = useActiveAccountId();
    const user = useCurrentUser();
    return useQuery({
        queryFn: async () => {
            return APIGetOwnershipForItem(itemId, accountId, true);
        },
        queryKey: [serviceName, "getOwnershipForItem", itemId],
        enabled: !!itemId && !!user,
    });
}
