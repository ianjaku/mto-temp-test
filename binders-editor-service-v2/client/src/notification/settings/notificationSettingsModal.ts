import { APIMultiGetGroupMembers, APIUsersById } from "../../users/api";
import {
    Binder,
    DocumentAncestors,
    DocumentCollection
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    NotificationTarget,
    NotifierKind
} from "@binders/client/lib/clients/notificationservice/v1/contract";
import { UseQueryResult, useQuery } from "@tanstack/react-query";
import { User, UsergroupDetails } from "@binders/client/lib/clients/userservice/v1/contract";
import { useEffect, useState } from "react";
import { APIFindNotificationTargets } from "../api";
import { APIGetAncestors } from "../../browsing/api";
import { useActiveAccountId } from "../../accounts/hooks";

export type NotificationTargetsResult = {
    notificationTargets: NotificationTarget[];
    ancestors: DocumentAncestors;
}

export const useNotificationTargets = (
    item: Binder | DocumentCollection
): UseQueryResult<NotificationTargetsResult> & NotificationTargetsResult => {
    const {
        refetch,
        ...rest
    } = useQuery<NotificationTargetsResult>({
        queryFn: async () => {
            const ancestors = await APIGetAncestors(item.id);
            const notificationTargets = await APIFindNotificationTargets(
                item.accountId,
                Object.keys(ancestors)
            );
            return { ancestors, notificationTargets };
        },
        queryKey: ["notification-targets", item.id],
    })
    const { notificationTargets = [], ancestors } = rest.data ?? {};
    return {
        ...rest,
        refetch,
        notificationTargets,
        ancestors
    }
}

export const useUsers = (
    notificationTargets: NotificationTarget[]
): { users: User[], fetchUsers: (userIds: string[]) => Promise<void> } => {
    const [users, setUsers] = useState<User[]>([]);

    const fetchUsers = async (userIds: string[]) => {
        const users = await APIUsersById(userIds, true);
        setUsers(oldUsers => {
            const userMap: Record<string, User> = {};
            oldUsers.forEach(user => userMap[user.id] = user);
            users.forEach(user => userMap[user.id] = user);
            return Object.values(userMap);
        });
    }

    useEffect(() => {
        const updateUsers = async () => {
            if (notificationTargets == null) return;
            if (notificationTargets.length === 0) return;
            const userIds = notificationTargets
                .filter(t => t.notifierKind === NotifierKind.USER_EMAIL)
                .map(t => t.targetId);
            fetchUsers(userIds);
        }
        updateUsers();
    }, [notificationTargets]);

    return {
        users,
        fetchUsers
    };
}

export const useGroups = (
    notificationTargets: NotificationTarget[]
): { groups: UsergroupDetails[], fetchGroups: (groupIds: string[]) => Promise<void> } => {
    const accountId = useActiveAccountId();
    const [groups, setGroups] = useState<UsergroupDetails[]>([]);

    const fetchGroups = async (groupIds: string[]) => {
        const groupDetails = await APIMultiGetGroupMembers(accountId, groupIds);
        setGroups(oldGroups => {
            const groupMap: Record<string, UsergroupDetails> = {};
            oldGroups.forEach(group => groupMap[group.group.id] = group);
            groupDetails.forEach(group => groupMap[group.group.id] = group);
            return Object.values(groupMap);
        });
    }

    useEffect(() => {
        const updateGroups = async () => {
            if (notificationTargets == null) return;
            if (notificationTargets.length === 0) return;
            const groupIds = notificationTargets
                .filter(t => t.notifierKind === NotifierKind.GROUP_EMAIL)
                .map(t => t.targetId);
            fetchGroups(groupIds)
        }
        updateGroups();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [notificationTargets]);

    return {
        groups,
        fetchGroups
    };
}
