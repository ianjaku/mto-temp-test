import * as React from "react";
import { User, UserDetails, Usergroup } from "@binders/client/lib/clients/userservice/v1/contract";
import { differenceWith, pick, toLower, uniq } from "ramda";
import { invalidateAllGroupQueries, useCreateUsergroup } from "../users/query";
import { FlashMessages } from "../logging/FlashMessages";
import { TK } from "@binders/client/lib/react/i18n/translations";
import { UseQueryResult } from "@tanstack/react-query";
import { importUsers } from "../users/actions";
import { useTranslation } from "@binders/client/lib/react/i18n";

const { useCallback, useState } = React;

export type UseImportUsersProps = {
    account: { id: string };
    domains: string[];
    myDetails: UserDetails | undefined;
    usergroups: UseQueryResult<Usergroup[]>;
    users: User[];
}

export type UseImportUsers<Payload> = {
    isImportingUsers: boolean;
    error: string | null;
    importUsers: (payload: Payload, close: () => void) => Promise<void>;
    reset: () => void;
}

export type UserImportPayload = {
    users: User[];
    usergroupId: string;
    replaceInGroup: boolean;
}[];


function getNewGroups(users: User[], accountGroups: { name: string }[]) {
    const allCSVGroups = users.reduce((acc, { groups }) => [...acc, ...groups], [] as string[]);
    const accountUsergroups = accountGroups.map(({ name }) => name);
    const equalityFunction = (x: string, y: string) => toLower(x).trim() === toLower(y).trim();
    return differenceWith(equalityFunction, uniq(allCSVGroups), accountUsergroups);
}

const pickNameAndId = pick(["name", "id"]);

export function useImportUsers({ account, domains, myDetails, usergroups }: UseImportUsersProps): UseImportUsers<UserImportPayload> {
    const [isImportingUsers, setIsImportingUsers] = useState(false);
    const [error, setError] = useState<string | null>();
    const { t } = useTranslation();
    const createUsergroup = useCreateUsergroup();

    const reset = () => {
        setIsImportingUsers(false);
        setError(null);
    };

    const importUsersCallback = useCallback(async function(payload: UserImportPayload, close: () => void) {
        if (!myDetails) return;
        reset();
        try {
            const usergroupsData = usergroups.data ?? [];
            const allGroups = [...usergroupsData.map(pickNameAndId)];
            for (const { users, usergroupId, replaceInGroup } of payload) {
                const groupsToCreate = getNewGroups(users, usergroupsData);
                if (groupsToCreate.length) {
                    const newGroups = await Promise.all(groupsToCreate.map(g => createUsergroup.mutateAsync({ accountId: account.id, name: g })));
                    allGroups.push(...newGroups.map(pickNameAndId));
                }
                const groupMap = allGroups.reduce(
                    (prev, { id, name }) => ({ ...prev, [name]: id }), {}
                );
                await importUsers(
                    users,
                    account.id,
                    (domains && domains[0]) || "",
                    usergroupId,
                    replaceInGroup,
                    myDetails.user,
                    groupMap,
                );
                if (groupsToCreate.length || usergroupId) {
                    invalidateAllGroupQueries();
                }
            }
            FlashMessages.success(t(TK.User_CSVSuccess));
            close();
        } catch (ex) {
            const error = t(TK.User_CSVImportError);
            setError(error);
            FlashMessages.error(error);
            return
        } finally {
            setIsImportingUsers(false);
        }
    }, [account, createUsergroup, domains, myDetails, setIsImportingUsers, t, usergroups]);

    return {
        isImportingUsers,
        importUsers: importUsersCallback,
        error,
        reset,
    }
}

