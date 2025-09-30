import * as React from "react";
import { ContentTitleAction, ContentTitleRow } from "../maintitle";
import { tableCellStyles, tableRowStyles } from "../../search/Table";
import { useCustomersList, useDeleteCustomer } from "../../api/hooks";
import { CustomersActions } from "../../actions/customers";
import FontAwesome from "react-fontawesome";
import { ManagedSearchTable } from "../../search/ManagedSearchTable";
import { Search } from "../../components/search";
import { SearchAwareText } from "../../search/SearchAwareText";
import { browserHistory } from "react-router";
import { useState } from "react";

export const CustomersOverview = () => {
    const [filter, setFilter] = useState("");
    const customers = useCustomersList();
    const deleteCustomer = useDeleteCustomer();

    const loadingView = customers.isLoading ?
        <p>This shouldn't take long</p> :
        null;

    const errorView = customers.isError ?
        <p>An error occurred. You can try and reload the table.</p> :
        null;

    const emptyView = !customers.data?.length ?
        <p>No matching customers found...</p> :
        null;

    return <div className="flex flex-col gap-4">
        <ContentTitleRow title="Customers overview">
            <ContentTitleAction icon="refresh" label="Reload" variant="outline" handler={() => { }} />
            <ContentTitleAction icon="plus" label="Create" handler={() => browserHistory.push("/customers/create")} />
        </ContentTitleRow>
        <Search
            id="search-customers"
            value={filter}
            setValue={setFilter}
        />
        {loadingView ?? errorView ?? emptyView ?? <ManagedSearchTable
            render={customer => <tr key={customer.id} className={tableRowStyles.base}>
                <td className={tableCellStyles.base}><SearchAwareText>{customer.id}</SearchAwareText></td>
                <td className={tableCellStyles.base}><SearchAwareText>{customer.name}</SearchAwareText></td>
                <td className={tableCellStyles.base}><SearchAwareText>{customer.accountIds.length}</SearchAwareText></td>
                <td className={tableCellStyles.actions}>
                    <FontAwesome name="pencil" onClick={() => CustomersActions.switchToCustomerEditDetails(customer.id)} title="Edit details" />
                    <FontAwesome name="industry" onClick={() => CustomersActions.switchToCustomerAccounts(customer.id)} title="Accounts" />
                    <FontAwesome name="trash-o" onClick={() => {
                        if (customer.accountIds.length > 0) {
                            alert("You can't delete a customer linked with accounts. Delete account first.");
                            return;
                        }
                        const shouldDeleteCustomer = confirm(`Do you want to delete customer ${customer.name}?`)
                        if (shouldDeleteCustomer) {
                            deleteCustomer.mutate(customer.id);
                        }
                    }} title="Delete" />
                </td>
            </tr>}
            data={customers.data}
            query={filter}
            config={{ index: ["name"] }}
            headers={[
                { label: "Customer ID", sort: true, get: a => a.id },
                { label: "Name", sort: true, get: a => a.name },
                { label: "n° accounts", sort: true, get: a => a.accountIds.length },
                "Actions",
            ]}
        />}
    </div>
}
