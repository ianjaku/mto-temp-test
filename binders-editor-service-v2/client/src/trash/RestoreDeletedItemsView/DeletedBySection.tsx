import * as React from "react";
import { APISearchUsers } from "../../users/api";
import FilterableDropdown from "@binders/ui-kit/lib/elements/dropdown/FilterableDropdown";
import { IDropdownElement } from "@binders/ui-kit/lib/elements/dropdown";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import debounce from "lodash.debounce";
import { useActiveAccountId } from "../../accounts/hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";

export const DeletedBySection: React.FC<{
    deletedById: string;
    deletedElementsUsers: User[];
    setDeletedById: (id: string) => void;
}> = ({ deletedById, deletedElementsUsers, setDeletedById }) => {
    const { t } = useTranslation();
    const activeAccountId = useActiveAccountId();

    const [ deletedByElements, setDeletedByElements ] = React.useState([]);
    const [ query, setQuery ] = React.useState("");

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const debouncedSearchDeletedElements = React.useCallback(debounce(async (query: number) => {
        if (activeAccountId == null) return;
        const result = await APISearchUsers({
            login: `${query}`,
            ignoreCase: true
        }, {
            maxResults: 100
        }, [activeAccountId]);

        setDeletedByElements(usersToDeletedByElements(result.hits));
    }, 250), [activeAccountId]);

    React.useEffect(() => {
        if (query) {
            debouncedSearchDeletedElements(query);
        } else {
            setDeletedByElements(usersToDeletedByElements(deletedElementsUsers));
        }
    }, [debouncedSearchDeletedElements, deletedElementsUsers, query]);

    const onSelectElement = React.useCallback((id: string) => {
        setDeletedById(id);
        setQuery("");
    }, [setDeletedById]);

    return (
        <div className="deletedItems-filter-content-row isIndented">
            <div className="deletedItems-filter-content-section">
                <div className="deletedItems-filter-content-subsection">
                    <label className="deletedItems-filter-content-label">
                        {t(TK.Trash_DeletedBy)}
                    </label>
                    <FilterableDropdown
                        selectedElementId={deletedById}
                        maxRows={5}
                        type={t(TK.Trash_Anyone)}
                        onSelectElement={onSelectElement}
                        elements={deletedByElements}
                        unselectable={true}
                        hideSelectedElementInList={true}
                        className="deletedItems-filter-content-filterableDropdown"
                        onTextChange={setQuery}
                    />
                </div>
            </div>
        </div>
    )
}

function usersToDeletedByElements(users: User[]): IDropdownElement[] {
    if (users == null) return [];
    return users.map(user => ({
        id: user.id,
        label: user.login
    }));
}