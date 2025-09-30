import * as React from "react";
import { ContentTitleAction, ContentTitleRow } from "../maintitle";
import { tableCellStyles, tableRowStyles } from "../../search/Table";
import { toastStyles, useToast } from "../../components/use-toast";
import {
    useAddAccountUser,
    useGetAccount,
    useRemoveAccountUser,
    useSearchUsers,
} from "../../api/hooks";
import { AccountsActions } from "../../actions/accounts";
import { Button } from "../../components/button";
import FontAwesome from "react-fontawesome";
import { RouteComponentProps } from "react-router";
import { Search } from "../../components/search";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import { useDebouncedValue } from "@binders/client/lib/react/hooks/useDebouncedValue";
import { useState } from "react";

export interface MembershipsProps {
    accountId: string;
}

export interface MembershipsState {
    requiresReload: boolean;
    usersInAccount: User[];
    usersNotInAccount: User[];
    currentUser: User;
}

export const AccountMembers = (props: RouteComponentProps<{ accountId: string }, unknown>) => {
    const { accountId } = props.params;
    const account = useGetAccount(accountId);
    const [filter, setFilter] = useState("");
    const debouncedFilter = useDebouncedValue(filter, 500);
    const { toast } = useToast();

    const accountUsersQuery = useSearchUsers({ ids: account.data?.members ?? [] });
    const searchedUsers = useSearchUsers({ searchPattern: debouncedFilter }, { enabled: debouncedFilter.length > 0 });

    const addToAccount = useAddAccountUser({
        onSuccess: () => toast({ className: toastStyles.info, title: "User added", description: "User was added to account" }),
        onError: e => toast({ className: toastStyles.error, title: "Failed to add user", description: e.message })
    });
    const removeFromAccount = useRemoveAccountUser({
        onSuccess: () => toast({ className: toastStyles.info, title: "User removed", description: "User was removed from account" }),
        onError: e => toast({ className: toastStyles.error, title: "Failed to remove user", description: e.message })
    });

    const accountUsers = accountUsersQuery.data?.filter(Boolean) ?? [];
    const accountUserIds = new Set(accountUsers.map(u => u.id))

    const usersNotInAccount = searchedUsers.data?.filter(user => !accountUserIds.has(user.id)) ?? [];

    return <>
        <ContentTitleRow title={"User members for " + account.data?.name}>
            <ContentTitleAction icon="" label="Cancel" variant="outline" handler={AccountsActions.switchToOverview} />
            <ContentTitleAction icon="shield" label="Admins" variant="default" handler={() => AccountsActions.switchToAccountAdmins(accountId)} title={`Go to admins for ${account.data?.name}`} />
        </ContentTitleRow>
        <div>
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {accountUsers.map(
                        user => {
                            const userLabel = getUserLabel(user);
                            return <tr key={user.id} className={tableRowStyles.base}>
                                <td className={tableCellStyles.base}>{userLabel}</td>
                                <td className={tableCellStyles.actions}>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeFromAccount.mutate({ accountId, userId: user.id })}
                                    ><FontAwesome name="minus" />Remove user</Button>
                                </td>
                            </tr>;
                        }
                    )}
                </tbody>
            </table>
            <h2>Add new member</h2>
            <div className="form-group">
                <label>Search</label>
                <Search id="user-search" value={filter} setValue={setFilter} />
            </div>
            {usersNotInAccount.length > 0 && <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {usersNotInAccount.map(user => {
                        const userLabel = getUserLabel(user)
                        return <tr className={tableRowStyles.base} key={user.id}>
                            <td className={tableCellStyles.base}>{userLabel}</td>
                            <td className={tableCellStyles.actions}>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => addToAccount.mutate({ accountId, userId: user.id })}
                                ><FontAwesome name="plus" />Add user</Button>
                            </td>
                        </tr>;
                    }
                    )}
                </tbody>
            </table>}
        </div>
    </>
}

const getUserLabel = (user: User) => {
    return user.displayName.length > 0 ?
        `${user.displayName} - ${user.login}` :
        user.login;
}

