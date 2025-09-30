import * as React from "react";
import { ContentTitleAction, ContentTitleRow } from "../maintitle";
import { tableCellStyles, tableRowStyles } from "../../search/Table";
import { toastStyles, useToast } from "../../components/use-toast";
import {
    useAddAccountUser,
    useGetUserAccounts,
    useListAccounts,
    useRemoveAccountUser,
} from "../../api/hooks";
import { Button } from "../../components/button";
import FontAwesome from "react-fontawesome";
import { RouteComponentProps } from "react-router";
import UsersActions from "../../actions/users";

export const UserMemberships = (props: RouteComponentProps<{ userId: string }, unknown>) => {
    const { userId } = props.params;
    const memberships = useGetUserAccounts(userId);
    const allAccounts = useListAccounts();
    const { toast } = useToast();

    const addToAccount = useAddAccountUser({
        onSuccess: () => toast({ className: toastStyles.info, title: "User added", description: "User was added to account" }),
        onError: e => toast({ className: toastStyles.error, title: "Failed to add user", description: e.message })
    });
    const removeFromAccount = useRemoveAccountUser({
        onSuccess: () => toast({ className: toastStyles.info, title: "User removed", description: "User was removed from account" }),
        onError: e => toast({ className: toastStyles.error, title: "Failed to remove user", description: e.message })
    });

    const notInAccounts = allAccounts.data?.filter(account => {
        for (let i = 0; i < memberships.data?.length; i++) {
            if (memberships.data?.[i].id === account.id) {
                return false;
            }
        }
        return true;
    });

    const rowsInAccount = memberships.data?.map(account => (
        <tr className={tableRowStyles.base} key={account.id}>
            <td className={tableCellStyles.base}>{account.name}</td>
            <td className={tableCellStyles.actions}>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFromAccount.mutate({ accountId: account.id, userId })}
                ><FontAwesome name="minus" />Remove from account</Button>
            </td>
        </tr>
    ));
    const rowsNotInAccount = notInAccounts.map(account => (
        <tr key={account.id} className={tableRowStyles.base}>
            <td className={tableCellStyles.base}>{account.name}</td>
            <td className={tableCellStyles.actions}>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addToAccount.mutate({ accountId: account.id, userId })}
                ><FontAwesome name="plus" />Add to account</Button>
            </td>
        </tr>
    ));

    return <>
        <ContentTitleRow title={"Accounts for " + userId}>
            <ContentTitleAction icon="" label="Cancel" variant="outline" handler={UsersActions.switchToOverview} />
        </ContentTitleRow>
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                {rowsInAccount}
                {rowsNotInAccount}
            </tbody>
        </table>
    </>;
}

