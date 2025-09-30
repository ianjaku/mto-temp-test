import { useCallback, useMemo } from "react";
import { GroupOwnerGroup } from "./contract";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import { WebDataState } from "@binders/client/lib/webdata";
import { useAccountUsersWD } from "../../hooks";
import { useManageableUserGroups } from "../../query";

export const useGroupOwnerGroups = (): { groups: GroupOwnerGroup[] | undefined, isLoading?: boolean } => {
    const { data: allGroups, isLoading } = useManageableUserGroups();
    const accountUsersWD = useAccountUsersWD();
    const getUser = useCallback((userId: string): User | undefined => {
        if (accountUsersWD.state !== WebDataState.SUCCESS) return undefined;
        return accountUsersWD.data.find(u => u.id === userId);
    }, [accountUsersWD]);

    const groups = useMemo(
        () => {
            if (!allGroups) {
                return;
            }
            return allGroups
                .filter(usergroup => !usergroup.isAutoManaged)
                .map(usergroup => {
                    const owners = usergroup.ownerUserIds
                        .map(userId => getUser(userId))
                        .filter(user => user);
                    return { ...usergroup, owners };
                });
        },
        [allGroups, getUser]
    );

    return { groups, isLoading };
}
