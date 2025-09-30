import * as React from "react";
import { ContentTitleAction, ContentTitleRow } from "../maintitle";
import { tableCellStyles, tableRowStyles } from "../../search/Table";
import FontAwesome from "react-fontawesome";
import { ManagedSearchTable } from "../../search/ManagedSearchTable";
import { Search } from "../../components/search";
import { SearchAwareText } from "../../search/SearchAwareText";
import { UsersActions } from "../../actions/users";
import { useDebouncedValue } from "@binders/client/lib/react/hooks/useDebouncedValue";
import { useListUsers } from "../../api/hooks";
import { useState } from "react";

export const UsersOverview = () => {
    const [filter, setFilter] = useState("");
    const debouncedFilter = useDebouncedValue(filter, 500);
    const minFilterLength = 2;
    const users = useListUsers(debouncedFilter);

    const noFilterView = filter.length <= minFilterLength ?
        <p>Start typing to search (at least {minFilterLength + 1} letters)</p> :
        null;

    const loadingView = users.isLoading ?
        <p>This shouldn't take long</p> :
        null;

    const errorView = users.isError ?
        <p>An error occurred. You can try and reload the table.</p> :
        null;

    const emptyView = !users.data?.length ?
        <p>No matching users found...</p> :
        null;

    return <div className="flex flex-col gap-4">
        <ContentTitleRow title="User overview">
            <ContentTitleAction icon="plus" label="Create" handler={UsersActions.switchToCreate} />
        </ContentTitleRow>
        <Search
            id="search-users"
            value={filter}
            setValue={setFilter}
        />
        {noFilterView ?? loadingView ?? errorView ?? emptyView ?? <ManagedSearchTable
            render={user => <tr key={user.id} className={tableRowStyles.base}>
                <td className={tableCellStyles.base}><SearchAwareText>{user.id}</SearchAwareText></td>
                <td className={tableCellStyles.base}><SearchAwareText>{user.login}</SearchAwareText></td>
                <td className={tableCellStyles.base}><SearchAwareText>{user.displayName}</SearchAwareText></td>
                <td className={tableCellStyles.actions}>
                    <FontAwesome name="pencil" onClick={() => UsersActions.switchToUserEditDetails(user.id)} title="Edit details" />
                    <FontAwesome name="users" onClick={() => UsersActions.switchToUserEditAccounts(user.id)} title="Accounts membership" />
                    <FontAwesome name="key" onClick={() => UsersActions.switchToUserEditPassword(user.id)} />
                </td>
            </tr>}
            data={users.data}
            query={filter}
            config={{
                index: ["id", "displayName", "firstName", "lastName", "login"],
                boost: { displayName: 3, login: 2 },
            }}
            headers={[
                "User ID",
                { label: "Login", sort: true, get: u => u.login },
                { label: "Display Name", sort: true, get: u => u.displayName },
                "Actions",
            ]}
        />}
    </div>
}

