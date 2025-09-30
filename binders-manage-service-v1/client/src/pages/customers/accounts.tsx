import * as React from "react";
import { ContentTitleAction, ContentTitleRow } from "../maintitle";
import { tableCellStyles, tableRowStyles } from "../../search/Table";
import {
    useAddAccountToCustomer,
    useGetCustomer,
    useListAccounts,
    useListCustomers,
    useRemoveAccountFromCustomer,
} from "../../api/hooks";
import type { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import { CustomersActions } from "../../actions/customers";
import FontAwesome from "react-fontawesome";
import type { RouteComponentProps } from "react-router";
import { useMemo } from "react";

export const CustomerAccounts = (props: RouteComponentProps<{ customerId: string }, unknown>) => {
    const { customerId } = props.params;
    const customers = useListCustomers();
    const accounts = useListAccounts();
    const accountById = useMemo(
        () => (accounts.data ?? []).reduce((res, item) => res.set(item.id, item), new Map<string, Account>()),
        [accounts.data],
    )
    const customer = useGetCustomer(customerId);

    const assignedAccountIds = customers.data?.flatMap(c => c.accountIds) ?? [];
    const accountsInCustomer = customer.data?.accountIds
        .map(accountId => accountById.get(accountId))
        .filter(Boolean) ?? [];

    const accountsNotInCustomer = accounts.data
        ?.filter(acc => !(assignedAccountIds.includes(acc.id)))
        .filter(account => {
            for (let i = 0; i < accountsInCustomer.length; i++) {
                if (account.id === accountsInCustomer[i].id) {
                    return false;
                }
            }
            return true;
        }) ?? [];

    const addToCustomer = useAddAccountToCustomer();
    const removeFromCustomer = useRemoveAccountFromCustomer();

    const rowsInCustomer = accountsInCustomer.map((account: Account) => {
        return <tr key={account.id} className={tableRowStyles.base}>
            <td className={tableCellStyles.base}>{account.name}</td>
            <td className={tableCellStyles.actions}>
                <span>
                    <FontAwesome name="minus" onClick={() => removeFromCustomer.mutate({ accountId: account.id, customerId })} />
                </span>
            </td>
        </tr>;
    });

    const rowsNotInCustomer = accountsNotInCustomer.map((account: Account) => {
        return <tr className={tableRowStyles.base} key={account.id}>
            <td className={tableCellStyles.base}>{account.name}</td>
            <td className={tableCellStyles.actions}>
                <span>
                    <FontAwesome name="plus" onClick={() => addToCustomer.mutate({ accountId: account.id, customerId })} />
                </span>
            </td>
        </tr>;
    }
    );

    return <div>
        <ContentTitleRow title={`Accounts for ${customer.data?.name}`}>
            <ContentTitleAction icon="" label="Cancel" variant="outline" handler={CustomersActions.switchToOverview} />
        </ContentTitleRow>
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                {rowsInCustomer}
                {rowsNotInCustomer}
            </tbody>
        </table>
    </div>;
}
