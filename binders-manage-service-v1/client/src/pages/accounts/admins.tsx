import * as React from "react";
import { ContentTitleAction, ContentTitleRow } from "../maintitle";
import { tableCellStyles, tableRowStyles } from "../../search/Table";
import { toastStyles, useToast } from "../../components/use-toast";
import {
    useAddAccountAdmin,
    useGetAccount,
    useListAccountAdmins,
    useRemoveAccountAdmin,
    useSearchUsers,
} from "../../api/hooks";
import { useCallback, useMemo } from "react";
import { AccountsActions } from "../../actions/accounts";
import FontAwesome from "react-fontawesome";
import { RouteComponentProps } from "react-router";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";

export const AccountAdmins = (props: RouteComponentProps<{ accountId: string }, unknown>) => {
    const { accountId } = props.params;

    const {
        data: account,
        isLoading: accountLoading,
        error: accountError,
    } = useGetAccount(accountId);

    const {
        data: users,
        isLoading: usersLoading,
        error: usersError,
    } = useSearchUsers({ ids: account?.members ?? [] }, { enabled: !!account });

    const {
        data: { admins: accountAdmins, adminGroupId } = {},
        isLoading: adminsLoading,
        error: adminsError,
    } = useListAccountAdmins(accountId, { enabled: !!account });

    const [adminMembers, nonAdminMembers] = useMemo(() => [
        users?.filter(user => accountAdmins?.includes(user.id)) ?? [],
        users?.filter(user => !accountAdmins?.includes(user.id)) ?? [],
    ], [users, accountAdmins]);

    if (accountLoading || usersLoading || adminsLoading) {
        return <div>Loading...</div>;
    }

    if (accountError || usersError || adminsError) {
        return <div>Error loading data.</div>;
    }

    return <>
        <ContentTitleRow title={"Admins for " + account?.name}>
            <ContentTitleAction icon="" label="Cancel" variant="outline" handler={AccountsActions.switchToOverview} />
            <ContentTitleAction icon="users" label="Members" variant="default" handler={() => AccountsActions.switchToAccountMembers(accountId)} title={`Go to user members for ${account?.name}`} />
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
                    {adminMembers.map(user => <AdminRow accountId={accountId} adminGroupId={adminGroupId} user={user} isAdmin />)}
                    {nonAdminMembers.map(user => <AdminRow accountId={accountId} adminGroupId={adminGroupId} user={user} />)}
                </tbody>
            </table>
        </div>
    </>;
}

const AdminRow = ({ accountId, adminGroupId, isAdmin, user }: {
    accountId: string;
    adminGroupId: string;
    user: User;
    isAdmin?: boolean;
}) => {
    const { toast } = useToast();
    const userLabel = user.displayName.length > 0 ? user.displayName : user.login;
    const userId = user.id;
    const addAccountAdmin = useAddAccountAdmin({
        onError: e => toast({ className: toastStyles.error, title: "Failed to add admin", description: e.message })
    });
    const removeAccountAdmin = useRemoveAccountAdmin({
        onError: e => toast({ className: toastStyles.error, title: "Failed to remove admin", description: e.message })
    });
    const action = useCallback(() => {
        if (isAdmin) { removeAccountAdmin.mutate({ accountId, adminGroupId, userId }) }
        else { addAccountAdmin.mutate({ accountId, adminGroupId, userId }) }
    }, [accountId, addAccountAdmin, adminGroupId, isAdmin, removeAccountAdmin, userId]);
    return <tr key={user.id} className={tableRowStyles.base}>
        <td className={tableCellStyles.base}>{userLabel}</td>
        <td className={tableCellStyles.actions}>
            <span>
                <FontAwesome name={isAdmin ? "minus" : "plus"} onClick={action} />
            </span>
        </td>
    </tr>;
}

