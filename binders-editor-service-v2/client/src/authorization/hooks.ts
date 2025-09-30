import { APIAccountAcls, APIFindMyResourceGroups } from "./api";
import { Acl, PermissionName, ResourceType } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { UseQueryResult, useQuery } from "@tanstack/react-query";
import { checkHasFullPermissionAnywhere } from "./tsHelpers";
import { queryClient } from "../application";
import { secondsToMilliseconds } from "date-fns";
import { useActiveAccountId } from "../accounts/hooks";

export const serviceName = "@binders/authorization-v1";

export const useAccountAcls = (): UseQueryResult<Acl[]> => {
    const accountId = useActiveAccountId();
    return useQuery({
        queryFn: async () => {
            return APIAccountAcls(accountId);
        },
        queryKey: [serviceName, "accountAcls"],
    });
}

const getAccountIdMyResourceGroups = (accountId: string) => APIFindMyResourceGroups (
    [accountId],
    ResourceType.DOCUMENT,
    [PermissionName.EDIT, PermissionName.ADMIN, PermissionName.VIEW, PermissionName.PUBLISH, PermissionName.REVIEW],
    true
);

const MY_RESOURCE_GROUPS_CACHE_STALE_TIME_MS = secondsToMilliseconds(5);

export const prefetchMyPermissionMap = async (accountId: string) => {
    await queryClient.prefetchQuery({
        queryKey: [serviceName, "myPermissionMap", accountId],
        queryFn: () => getAccountIdMyResourceGroups(accountId),
        staleTime: MY_RESOURCE_GROUPS_CACHE_STALE_TIME_MS,
    });
}

export const useMyPermissionMap = () => {
    const accountId = useActiveAccountId();
    return useQuery({
        queryKey: [serviceName, "myPermissionMap", accountId],
        queryFn: () => getAccountIdMyResourceGroups(accountId),
        staleTime: MY_RESOURCE_GROUPS_CACHE_STALE_TIME_MS
    });
}

export const useMyPermissionMapOrEmpty = () => {
    const permissions = useMyPermissionMap();
    return permissions.data || [];
}

export const useHasFullPermissionAnywhere = (): boolean | undefined => {
    const { data: permissions } = useMyPermissionMap();
    return permissions ? checkHasFullPermissionAnywhere(permissions, PermissionName.EDIT) : undefined;
};
