import * as React from "react";
import Dropdown from "@binders/ui-kit/lib/elements/dropdown";
import Input from "@binders/ui-kit/lib/elements/input";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { UserCardSortMethod } from "./UserLinkerList";
import { useTranslation } from "@binders/client/lib/react/i18n";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface Props {
    searchTerm: string;
    onUpdateSearchTerm: (searchTerm: string) => void;
    sortMethod: UserCardSortMethod;
    onUpdateSortMethod: (sortMethod: UserCardSortMethod) => void;
    searchable?: boolean;
    sortable?: boolean;
}

const UserLinkerListHeader: React.FC<Props> = ({
    searchTerm,
    onUpdateSearchTerm,
    sortMethod,
    onUpdateSortMethod,
    searchable,
    sortable,
}) => {
    const { t } = useTranslation();
    return (
        <div className="userLinkerListHeader">
            {searchable && (
                <Input
                    onChange={onUpdateSearchTerm}
                    value={searchTerm}
                    placeholder={`${t(TK.User_UserLinkerSearch)}...`}
                    className="userLinkerListHeader-input"
                />
            )}
            {sortable && (
                <div className="userLinkerListHeader-sort">
                    <label className="userLinkerListHeader-sort-lbl">{t(TK.General_Sort)}:</label>
                    <Dropdown
                        onSelectElement={onUpdateSortMethod}
                        elements={[
                            {
                                id: "lastonline",
                                label: t(TK.User_UserSortLastActive)
                            },
                            {
                                id: "name",
                                label: t(TK.General_Name)
                            },
                        ]}
                        selectedElementId={sortMethod}
                        type="sortMethod"
                        showBorders={false}
                        width={120}
                    />
                </div>
            )}
        </div>
    )
}

export default UserLinkerListHeader;