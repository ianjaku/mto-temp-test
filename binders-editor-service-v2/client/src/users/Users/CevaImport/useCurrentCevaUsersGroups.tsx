import { Usergroup, UsergroupDetails } from "@binders/client/lib/clients/userservice/v1/contract";
import { useUserCredentialStatuses, userServiceName } from "../../query";
import AccountStore from "../../../accounts/store";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config";
import { useActiveAccountId } from "../../../accounts/hooks";
import { useCurrentUserId } from "../../hooks";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

export const CurrentCevaUsersGroup = "currentCevaUsersGroup";

const client = UserServiceClient.fromConfig(
    config,
    "v1",
    browserRequestHandler,
    AccountStore.getActiveAccountId.bind(AccountStore),
);

export interface UseCurrentCevaUsersGroupsResult {
    usergroups?: UsergroupDetails[];
    isLoading: boolean;
}

const useCurrentCevaUsersGroups = (
): UseCurrentCevaUsersGroupsResult => {
    const accountId = useActiveAccountId();
    const userId = useCurrentUserId();
    const { data: usergroups, isLoading: usergroupsLoading } = useQuery<Usergroup[]>(
        [userServiceName, CurrentCevaUsersGroup, "getManageableGroups"],
        async () => {
            return client.getManageableGroups(accountId, userId);
        }
    )

    const { data: usergroupsInclMembers, isLoading: usergroupDetailsLoading } = useQuery(
        [userServiceName, CurrentCevaUsersGroup, "multiGetGroupMembers", usergroups?.map(g => g.id)],
        async () => {
            return client.multiGetGroupMembers(accountId, usergroups?.map(g => g.id), { includeUserTags: true });
        },
        {
            enabled: usergroups?.length > 0
        }
    )

    const allMemberIds = useMemo(
        () => usergroupsInclMembers?.flatMap(g => g.members?.map(m => m.id) || []) || [],
        [usergroupsInclMembers]
    );

    const { data: credentialStatuses, isLoading: credentialStatusesLoading } = useUserCredentialStatuses(allMemberIds);
    const resultingUserGroups = useMemo(() => {
        return usergroupsInclMembers?.map(g => ({
            ...g,
            members: g.members?.map(u => ({
                ...u,
                credentialStatus: credentialStatuses[u.id] ?? null,
                userGroupId: g.group.id,
            })),
        }));
    }, [credentialStatuses, usergroupsInclMembers]);


    return {
        isLoading: usergroupsLoading || usergroupDetailsLoading || credentialStatusesLoading,
        usergroups: resultingUserGroups,
    }
}

export default useCurrentCevaUsersGroups;
